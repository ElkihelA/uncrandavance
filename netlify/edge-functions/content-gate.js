// ══════════════════════════════════════════════════════════════════
// UCA — Edge Function : content-gate
// Runtime : Deno (Netlify Edge)
//
// Rôle : intercepte chaque requête vers NL / dossier / membres
//   1. Vérifie la date de publication (côté serveur — hermétique)
//   2. Vérifie le niveau d'accès via cookie signé
//   3. Redirige vers /gate.html si besoin, sinon sert le fichier
// ══════════════════════════════════════════════════════════════════

import { UCA_CONFIG, getEdition, isPublished, isEnRelecture } from '../../uca-config.js';

const COOKIE_NAME = 'uca_access';

// ── Point d'entrée ─────────────────────────────────────────────────
export default async function handler(request, context) {
  const url  = new URL(request.url);
  const slug = url.pathname.replace(/^\//, '').replace(/\.html$/, '');

  const edition = getEdition(slug);

  // Fichier non géré par la config → servir normalement
  if (!edition) return context.next();

  // ── Vérification 1 : date de publication ──────────────────────
  // La date vient du serveur Edge (Deno.now) — impossible à manipuler côté client
  const nowISO = new Date().toISOString();

  if (!isPublished(edition, nowISO)) {
    return new Response(comingSoonHTML(edition), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // ── Mode archive : accès libre, sauf édition en relecture ──────
  if (UCA_CONFIG.ARCHIVE) {
    if (isEnRelecture(slug)) {
      return new Response(enRelectureHTML(edition), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    return context.next();
  }

  // ── Vérification 2 : accès utilisateur ────────────────────────
  const cookie  = parseCookies(request.headers.get('cookie') || '');
  const token   = cookie[COOKIE_NAME];
  const secret  = Deno.env.get('UCA_COOKIE_SECRET') || 'dev-secret-change-me';
  const payload = token ? await verifyToken(token, secret) : null;

  // Pas de cookie valide → gate
  if (!payload) {
    return redirectToGate(url, 'auth');
  }

  // Contenu premium → vérifier le tier
  if (edition.access === 'premium' && payload.status !== 'premium') {
    return redirectToGate(url, 'premium');
  }

  // ✅ Accès autorisé → servir le fichier
  return context.next();
}

// ── Helpers ────────────────────────────────────────────────────────

function redirectToGate(url, reason) {
  const dest = `/gate.html?redirect=${encodeURIComponent(url.pathname)}&reason=${reason}`;
  return Response.redirect(dest, 302);
}

function parseCookies(str) {
  return Object.fromEntries(
    str.split(';')
      .map(s => s.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k.trim(), decodeURIComponent(v.join('='))])
  );
}

async function verifyToken(token, secret) {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;

    const expected = await hmacSign(data, secret);
    if (sig !== expected) return null;

    const payload = JSON.parse(atob(data));
    if (payload.exp < Date.now()) return null; // expiré

    return payload;
  } catch {
    return null;
  }
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const raw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

// ── HTML "À paraître" ──────────────────────────────────────────────
function comingSoonHTML(edition) {
  const pubDate = new Date(edition.publishDate + 'T00:00:00Z');
  const dateStr = pubDate.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'UTC',
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>À paraître — Un Cran d'Avance</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Barlow+Condensed:wght@400;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:'Playfair Display',serif;
    background:#0A0A14;color:#F7F3E8;
    display:flex;align-items:center;justify-content:center;
    min-height:100vh;padding:40px 24px;
  }
  .wrap{text-align:center;max-width:480px}
  .brand{
    font-family:'Barlow Condensed',sans-serif;
    font-size:11px;letter-spacing:4px;text-transform:uppercase;
    color:#B8973A;margin-bottom:48px;
  }
  .lock{font-size:32px;margin-bottom:24px;opacity:0.6}
  h1{font-size:clamp(22px,4vw,30px);font-weight:400;line-height:1.5;margin-bottom:16px}
  h1 em{font-style:italic;color:#B8973A}
  .subtitle{font-size:15px;color:rgba(247,243,232,0.55);line-height:1.8;margin-bottom:36px}
  .date-badge{
    font-family:'Barlow Condensed',sans-serif;
    font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;
    color:#B8973A;border:1px solid rgba(184,151,58,0.35);
    padding:12px 24px;display:inline-block;margin-bottom:48px;
  }
  .back{
    font-family:'Barlow Condensed',sans-serif;
    font-size:11px;letter-spacing:2px;text-transform:uppercase;
    color:rgba(247,243,232,0.35);text-decoration:none;
    transition:color 0.2s;
  }
  .back:hover{color:#B8973A}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">✦ Un Cran d'Avance</div>
  <div class="lock">◷</div>
  <h1>Cette édition n'est pas encore<br><em>publiée.</em></h1>
  <p class="subtitle">
    ${edition.label ? `<strong>${edition.label}</strong><br>` : ''}
    Elle sera disponible le
  </p>
  <div class="date-badge">${dateStr}</div>
  <br>
  <a href="/page-newsletter.html" class="back">← Voir les éditions disponibles</a>
</div>
</body>
</html>`;
}


// ── HTML "En relecture" (mode archive) ─────────────────────────────
function enRelectureHTML(edition) {
  return comingSoonHTML(edition)
    .replace('<title>À paraître — Un Cran d\'Avance</title>', '<title>En relecture — Un Cran d\'Avance</title>')
    .replace(/<h1>[\s\S]*?<\/h1>/, '<h1>Cette édition est en<br><em>relecture.</em></h1>')
    .replace(/<p class="subtitle">[\s\S]*?<\/p>\s*<div class="date-badge">[\s\S]*?<\/div>/,
      `<p class="subtitle">${edition.label ? `<strong>${edition.label}</strong><br>` : ''}Nous revérifions ses chiffres et leurs sources avant de la rouvrir en accès libre.</p>`)
    .replace('href="/page-newsletter.html"', 'href="/archives.html"')
    .replace('← Voir les éditions disponibles', '← Voir les archives');
}
