// ══════════════════════════════════════════════════════════════════
// UCA — Netlify Function : verify-email
// Runtime : Node.js 18+
//
// Rôle : appelée par gate.html via POST avec l'email de l'utilisateur
//   1. Vérifie si l'email existe dans Beehiiv (abonné actif)
//   2. Détecte le tier : free ou premium
//   3. Si nouvel email → inscrit automatiquement dans Beehiiv
//   4. Crée un cookie signé (HMAC-SHA256) valide 1 an
//   5. Retourne { status, email } — gate.html redirige vers le contenu
//
// Variables d'environnement Netlify requises :
//   BEEHIIV_API_KEY    → clé API Beehiiv
//   BEEHIIV_PUB_ID     → pub_b115a58f (ou override)
//   UCA_COOKIE_SECRET  → chaîne aléatoire 32+ chars
// ══════════════════════════════════════════════════════════════════

const { createHmac } = require('crypto');

const BEEHIIV_PUB_ID      = process.env.BEEHIIV_PUB_ID      || 'pub_b115a58f';
const BEEHIIV_API_KEY     = process.env.BEEHIIV_API_KEY;
const COOKIE_SECRET       = process.env.UCA_COOKIE_SECRET    || 'dev-secret-change-me';
const COOKIE_NAME         = 'uca_access';
const COOKIE_MAX_AGE      = 365 * 24 * 60 * 60; // 1 an en secondes
const COOKIE_MAX_AGE_MS   = COOKIE_MAX_AGE * 1000;

// ── Rate limiting en mémoire ──────────────────────────────────────
// 5 tentatives par IP par heure — bloque les abus automatisés
const rateLimitMap = new Map();
const RATE_LIMIT   = 5;
const RATE_WINDOW  = 60 * 60 * 1000; // 1 heure

function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

exports.handler = async (event) => {

  // ── CORS : autorise uniquement uncrandavance.com ──────────────
  const headers = {
    'Access-Control-Allow-Origin':  'https://uncrandavance.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  // ── Rate limiting ─────────────────────────────────────────────
  const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Trop de tentatives. Réessayez dans une heure.' }) };
  }

  // ── Validation de l'email ─────────────────────────────────────
  let email;
  try {
    const body = JSON.parse(event.body || '{}');
    email = (body.email || '').trim().toLowerCase();
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Corps de requête invalide' }) };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Adresse email invalide' }) };
  }

  if (!BEEHIIV_API_KEY) {
    console.error('BEEHIIV_API_KEY manquante — configurer dans Netlify Dashboard');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuration serveur manquante' }) };
  }

  try {
    // ── Interroger Beehiiv ──────────────────────────────────────
    const beehiivStatus = await getBeehiivStatus(email);

    let status;
    if (beehiivStatus === 'premium') {
      status = 'premium';
    } else if (beehiivStatus === 'active') {
      status = 'free';
    } else {
      // Nouvel abonné — l'inscrire dans Beehiiv
      await subscribeToBeehiiv(email);
      status = 'free';
    }

    // ── Créer le cookie signé ───────────────────────────────────
    const payload = { email, status, exp: Date.now() + COOKIE_MAX_AGE_MS };
    const token   = createToken(payload);

    // Cookie HttpOnly : inaccessible au JS, protège contre XSS
    const cookieStr = [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      `Path=/`,
      `Max-Age=${COOKIE_MAX_AGE}`,
      `SameSite=Lax`,
      `HttpOnly`,
      `Secure`, // HTTPS uniquement
    ].join('; ');

    return {
      statusCode: 200,
      headers: { ...headers, 'Set-Cookie': cookieStr },
      body: JSON.stringify({ status, email }),
    };

  } catch (err) {
    console.error('verify-email error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur lors de la vérification' }),
    };
  }
};

// ── Beehiiv — vérifier le statut d'un abonné ──────────────────────
async function getBeehiivStatus(email) {
  const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions/by_email/${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` },
  });

  if (res.status === 404) return 'unknown'; // pas abonné
  if (!res.ok) throw new Error(`Beehiiv API error ${res.status}`);

  const { data } = await res.json();
  if (!data) return 'unknown';

  // Vérifier le statut actif d'abord
  if (data.status !== 'active') return 'inactive';

  // Vérifier le tier premium
  // Beehiiv retourne tier = 'premium' pour les membres payants
  if (data.tier === 'premium') return 'premium';

  // Vérifier aussi via les custom fields si le tier n'est pas explicite
  // (certaines configs Beehiiv utilisent un tag ou un segment)
  const tags = (data.tags || []).map(t => t.toLowerCase());
  if (tags.includes('premium') || tags.includes('membre')) return 'premium';

  return 'active'; // abonné free actif
}

// ── Beehiiv — inscrire un nouvel abonné ───────────────────────────
async function subscribeToBeehiiv(email) {
  const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${BEEHIIV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      reactivate_existing: true,   // réactive si précédemment désabonné
      send_welcome_email: true,    // déclenche l'automation J+0 Beehiiv
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beehiiv subscribe error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Signature HMAC-SHA256 du cookie ───────────────────────────────
function createToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig  = createHmac('sha256', COOKIE_SECRET).update(data).digest('base64');
  return `${data}.${sig}`;
}
