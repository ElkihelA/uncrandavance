// ══════════════════════════════════════════════════════════════════
// UCA — Netlify Function : stripe-webhook
//
// Rôle : reçoit l'événement Stripe checkout.session.completed
//   1. Vérifie la signature Stripe (rejette tout ce qui ne vient pas de Stripe)
//   2. Récupère l'email du client
//   3. S'assure qu'il est abonné Beehiiv (l'inscrit si nécessaire)
//   4. Le marque comme premium via le tag Beehiiv "premium"
//
// Variables d'environnement Netlify requises :
//   STRIPE_WEBHOOK_SECRET  → Stripe Dashboard → Webhooks → Signing secret
//   BEEHIIV_API_KEY        → Beehiiv Settings → API (nouvelle clé après révocation)
//   BEEHIIV_PUB_ID         → pub_b115a58f
//
// Dans Stripe Dashboard → Webhooks :
//   URL endpoint : https://uncrandavance.com/.netlify/functions/stripe-webhook
//   Événement à écouter : checkout.session.completed
// ══════════════════════════════════════════════════════════════════

const crypto = require('crypto');

const BEEHIIV_PUB_ID       = process.env.BEEHIIV_PUB_ID      || 'pub_b115a58f';
const BEEHIIV_API_KEY      = process.env.BEEHIIV_API_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// ── Masquage PII dans les logs ────────────────────────────────────
// Ne jamais logger un email en clair (compliance RGPD + exposition
// dans les logs Netlify). On garde les 3 premiers caractères + le
// domaine pour le debug (ex : "eli***@gmail.com").
function maskEmail(email) {
  if (!email || typeof email !== 'string') return '<empty>';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const prefix = local.slice(0, 3);
  return `${prefix}***@${domain}`;
}

exports.handler = async (event) => {

  // ── Stripe n'envoie que des POST ──────────────────────────────
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // ── Vérification de la signature Stripe ──────────────────────
  // Sans ça, n'importe qui peut POST sur cette URL et créer de faux
  // membres premium. La signature garantit que c'est vraiment Stripe.
  const signature = event.headers['stripe-signature'];
  if (!signature || !STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: signature ou secret manquant');
    return { statusCode: 400, body: 'Signature manquante' };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('stripe-webhook: signature invalide', err.message);
    return { statusCode: 400, body: 'Signature invalide' };
  }

  // ── Traiter uniquement checkout.session.completed ─────────────
  if (stripeEvent.type !== 'checkout.session.completed') {
    // Retourner 200 pour tous les autres événements (Stripe recommande ça)
    return { statusCode: 200, body: 'Événement ignoré' };
  }

  const session = stripeEvent.data.object;
  const email   = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();

  if (!email) {
    console.error('stripe-webhook: email absent dans la session', session.id);
    return { statusCode: 200, body: 'Email absent — ignoré' };
  }

  console.log(`stripe-webhook: paiement confirmé pour ${maskEmail(email)}`);

  try {
    // ── 1. Vérifier si l'abonné existe déjà dans Beehiiv ─────────
    const existing = await getBeehiivSubscriber(email);

    if (existing) {
      // Abonné existant → ajouter le tag premium
      await addPremiumTagBeehiiv(existing.id, email);
    } else {
      // Pas encore abonné → inscrire + tag premium
      await subscribeAndTagPremium(email);
    }

    console.log(`stripe-webhook: ${maskEmail(email)} marqué premium dans Beehiiv`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, email }) };

  } catch (err) {
    console.error('stripe-webhook: erreur Beehiiv', err.message);
    // On retourne 500 pour que Stripe réessaie automatiquement
    return { statusCode: 500, body: 'Erreur interne — réessai Stripe attendu' };
  }
};

// ── Beehiiv : récupérer un abonné par email (search endpoint) ────
async function getBeehiivSubscriber(email) {
  // Beehiiv v2 : search par email via query param
  const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions?email=${encodeURIComponent(email)}&limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beehiiv search ${res.status}: ${err}`);
  }
  const json = await res.json();
  const list = json.data || [];
  console.log(`stripe-webhook: Beehiiv search ${maskEmail(email)} → ${list.length} résultat(s)`);
  return list.length > 0 ? list[0] : null;
}

// ── Beehiiv : ajouter le tag "premium" sur un abonné existant ─────
async function addPremiumTagBeehiiv(subscriberId, email) {
  // Beehiiv v2 : POST sur /tags pour ajouter un tag
  const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions/${subscriberId}/tags`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${BEEHIIV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags: ['premium'] }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`stripe-webhook: Beehiiv tag POST ${res.status}: ${err}`);
    // Fallback : PATCH sur l'abonnement
    return await patchSubscriberPremium(subscriberId);
  }
  console.log(`stripe-webhook: tag premium ajouté à ${maskEmail(email)}`);
  return res.json();
}

// ── Beehiiv : PATCH fallback si POST /tags échoue ─────────────────
async function patchSubscriberPremium(subscriberId) {
  const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions/${subscriberId}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${BEEHIIV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ custom_fields: [{ name: 'premium', value: 'true' }] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beehiiv PATCH ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Beehiiv : inscrire un nouvel abonné avec tag premium ──────────
async function subscribeAndTagPremium(email) {
  const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${BEEHIIV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      reactivate_existing: true,
      send_welcome_email:  false,
      tags: ['premium'],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Beehiiv subscribe ${res.status}: ${err}`);
  }
  console.log(`stripe-webhook: ${maskEmail(email)} inscrit avec tag premium`);
  return res.json();
}

// ── Vérification signature Stripe (sans SDK, ~20 lignes) ──────────
// Stripe signe chaque requête avec HMAC-SHA256.
// Reproduire la vérification du SDK officiel.
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  // signatureHeader format : "t=1234567890,v1=abc123,v1=def456"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('='))
  );
  const timestamp = parts.t;
  const signatures = signatureHeader
    .split(',')
    .filter(p => p.startsWith('v1='))
    .map(p => p.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new Error('Header stripe-signature malformé');
  }

  // Rejeter les webhooks de plus de 5 minutes (protection replay)
  const tolerance = 5 * 60;
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > tolerance) {
    throw new Error('Webhook trop ancien — possible attaque replay');
  }

  const payload   = `${timestamp}.${rawBody}`;
  const expected  = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const isValid   = signatures.some(sig => {
    // Comparaison en temps constant pour éviter timing attacks
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  });

  if (!isValid) throw new Error('Signature HMAC invalide');

  return JSON.parse(rawBody);
}
