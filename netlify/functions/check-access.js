// ══════════════════════════════════════════════════════════════════
// UCA — Netlify Function : check-access
//
// Rôle : appelé par uca-gate.js côté client (GET)
//   Lit le cookie HttpOnly uca_access (inaccessible au JS direct)
//   Vérifie la signature HMAC et l'expiration
//   Retourne { status: 'free' | 'premium' | 'none', email }
//
// Utilisé uniquement pour l'UI client-side (classes CSS has-email/has-premium)
// La sécurité réelle est dans l'Edge Function content-gate.js
// ══════════════════════════════════════════════════════════════════

const { createHmac } = require('crypto');

const COOKIE_NAME   = 'uca_access';
const COOKIE_SECRET = process.env.UCA_COOKIE_SECRET || 'dev-secret-change-me';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const cookieStr = event.headers.cookie || '';
  const token     = parseCookies(cookieStr)[COOKIE_NAME];

  if (!token) {
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'none' }) };
  }

  const payload = verifyToken(decodeURIComponent(token), COOKIE_SECRET);

  if (!payload) {
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'none' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ status: payload.status, email: payload.email }),
  };
};

function parseCookies(str) {
  return Object.fromEntries(
    str.split(';')
      .map(s => s.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join('='))])
  );
}

function verifyToken(token, secret) {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;

    const expected = createHmac('sha256', secret).update(data).digest('base64');
    if (sig !== expected) return null;

    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}
