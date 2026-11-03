// ══════════════════════════════════════════════════════════════════
// UCA — Configuration des éditions
// Source de vérité unique pour les dates de publication et les accès
//
// RÈGLE : ajouter une ligne quand tu crées une édition
//         ne jamais modifier une ligne passée
//         le site gère tout automatiquement
// ══════════════════════════════════════════════════════════════════

export const UCA_CONFIG = {

  // ── Identifiants Beehiiv / Netlify ────────────────────────────
  BEEHIIV_PUB_ID: 'pub_b115a58f',

  // ── Mode archive (décision du PO, 2026-11-03) ─────────────────
  // Un Cran d'Avance est suspendu dans sa forme « plateforme pour DSI ».
  // ARCHIVE = true : tout le contenu publié est en accès libre, sans
  // courriel ni paiement ; plus aucune offre n'est vendue.
  ARCHIVE: true,

  // Éditions retirées le temps d'une relecture de leurs chiffres
  // (sources à revérifier avant de les rouvrir). Les rouvrir = retirer
  // le slug de cette liste.
  EN_RELECTURE: [
    'dossier-2026-01-ia-en-2026',
    'dossier-2026-02-agentique',
    'dossier-2026-03-roi-ia',
    'dossier-2026-04-gouvernance',
    'dossier-2026-05-ia-production',
    'nl-2026-01-27',
    'nl-2026-02-17',
    'nl-2026-03-24',
    'nl-2026-05-12',
  ],

  // ── Durée du cookie d'accès ────────────────────────────────────
  // 1 an : un abonné ne ressaisit son email qu'une seule fois dans sa vie
  // (re-vérification silencieuse si cookie expiré + email en localStorage)
  COOKIE_MAX_AGE_SECONDS: 365 * 24 * 60 * 60,

  // ── Éditions ──────────────────────────────────────────────────
  // slug          : nom du fichier HTML sans l'extension
  // publishDate   : date de publication ISO (AAAA-MM-JJ)
  //                 contenu invisible côté SERVEUR avant cette date
  // access        : 'free' = email requis / 'premium' = membre payant requis
  // type          : 'nl' = newsletter / 'dossier' = dossier mensuel
  // label         : libellé affiché sur la page "À paraître"
  EDITIONS: [

    // ── JANVIER 2026 ───────────────────────────────────────────
    {
      slug:        'nl-2026-01-06',
      publishDate: '2026-01-06',
      access:      'free',
      type:        'nl',
      label:       'N°1 — 6 janvier 2026',
    },
    {
      slug:        'nl-2026-01-13',
      publishDate: '2026-01-13',
      access:      'free',
      type:        'nl',
      label:       'N°2 — 13 janvier 2026',
    },
    {
      slug:        'nl-2026-01-20',
      publishDate: '2026-01-20',
      access:      'free',
      type:        'nl',
      label:       'N°3 — 20 janvier 2026',
    },
    {
      slug:        'nl-2026-01-27',
      publishDate: '2026-01-27',
      access:      'free',
      type:        'nl',
      label:       'N°4 — 27 janvier 2026',
    },
    {
      slug:        'dossier-2026-01-ia-en-2026',
      publishDate: '2026-01-06',
      access:      'premium',
      type:        'dossier',
      label:       'Dossier N°1 — L\'IA en 2026',
    },

    // ── FÉVRIER 2026 ───────────────────────────────────────────
    {
      slug:        'nl-2026-02-03',
      publishDate: '2026-02-03',
      access:      'free',
      type:        'nl',
      label:       'N°5 — 3 février 2026',
    },
    {
      slug:        'nl-2026-02-10',
      publishDate: '2026-02-10',
      access:      'free',
      type:        'nl',
      label:       'N°6 — 10 février 2026',
    },
    {
      slug:        'nl-2026-02-17',
      publishDate: '2026-02-17',
      access:      'free',
      type:        'nl',
      label:       'N°7 — 17 février 2026',
    },
    {
      slug:        'nl-2026-02-24',
      publishDate: '2026-02-24',
      access:      'free',
      type:        'nl',
      label:       'N°8 — 24 février 2026',
    },
    {
      slug:        'dossier-2026-02-agentique',
      publishDate: '2026-02-03',
      access:      'premium',
      type:        'dossier',
      label:       'Dossier N°2 — L\'IA Agentique',
    },

    // ── MARS 2026 ──────────────────────────────────────────────
    {
      slug:        'nl-2026-03-03',
      publishDate: '2026-03-03',
      access:      'free',
      type:        'nl',
      label:       'N°9 — 3 mars 2026',
    },
    {
      slug:        'nl-2026-03-10',
      publishDate: '2026-03-10',
      access:      'free',
      type:        'nl',
      label:       'N°10 — 10 mars 2026',
    },
    {
      slug:        'nl-2026-03-17',
      publishDate: '2026-03-17',
      access:      'free',
      type:        'nl',
      label:       'N°11 — 17 mars 2026',
    },
    {
      slug:        'nl-2026-03-24',
      publishDate: '2026-03-24',
      access:      'free',
      type:        'nl',
      label:       'N°12 — 24 mars 2026',
    },
    {
      slug:        'dossier-2026-03-roi-ia',
      publishDate: '2026-03-03',
      access:      'premium',
      type:        'dossier',
      label:       'Dossier N°3 — ROI de l\'IA',
    },

    // ── AVRIL 2026 — préparé en avance, invisible avant la date ─
    {
      slug:        'nl-2026-04-01',
      publishDate: '2026-04-01',
      access:      'free',
      type:        'nl',
      label:       'N°13 — 1er avril 2026',
    },
    {
      slug:        'nl-2026-04-08',
      publishDate: '2026-04-08',
      access:      'free',
      type:        'nl',
      label:       'N°14 — 8 avril 2026',
    },
    {
      slug:        'nl-2026-04-15',
      publishDate: '2026-04-15',
      access:      'free',
      type:        'nl',
      label:       'N°15 — 15 avril 2026',
    },
    {
      slug:        'nl-2026-04-22',
      publishDate: '2026-04-22',
      access:      'free',
      type:        'nl',
      label:       'N°16 — 22 avril 2026',
    },
    {
      slug:        'dossier-2026-04-gouvernance',
      publishDate: '2026-04-01',
      access:      'premium',
      type:        'dossier',
      label:       'Dossier N°4 — Gouvernance IA',
    },

    // ── MAI 2026 ──────────────────────────────────────────────
    {
      slug:        'nl-2026-05-05',
      publishDate: '2026-05-05',
      access:      'free',
      type:        'nl',
      label:       '5 mai 2026',
    },
    {
      slug:        'nl-2026-05-12',
      publishDate: '2026-05-12',
      access:      'free',
      type:        'nl',
      label:       '12 mai 2026',
    },
    {
      slug:        'nl-2026-05-19',
      publishDate: '2026-05-19',
      access:      'free',
      type:        'nl',
      label:       '19 mai 2026',
    },
    {
      slug:        'dossier-2026-05-ia-production',
      publishDate: '2026-05-21',
      access:      'premium',
      type:        'dossier',
      label:       'Dossier N°5 — IA en Production',
    },
    {
      slug:        'nl-2026-05-26',
      publishDate: '2026-05-26',
      access:      'free',
      type:        'nl',
      label:       '26 mai 2026',
    },

  ],
};

// ── Helpers ────────────────────────────────────────────────────────

/** Trouve une édition par son slug. Retourne null si inconnue. */
export function getEdition(slug) {
  return UCA_CONFIG.EDITIONS.find(e => e.slug === slug) || null;
}

/**
 * Vérifie si une édition est publiée à la date serveur fournie.
 * On passe la date explicitement (pas new Date()) pour éviter
 * les bugs liés au fuseau horaire dans l'Edge Function.
 */
export function isPublished(edition, nowISO) {
  const now  = new Date(nowISO);
  const pub  = new Date(edition.publishDate);
  // Comparaison à minuit UTC pour éviter les décalages
  now.setUTCHours(0, 0, 0, 0);
  pub.setUTCHours(0, 0, 0, 0);
  return pub <= now;
}

/** Vrai si l'édition est retirée le temps d'une relecture (mode archive). */
export function isEnRelecture(slug) {
  return UCA_CONFIG.EN_RELECTURE.includes(slug);
}

/** Retourne toutes les éditions publiées à une date donnée. */
export function getPublishedEditions(nowISO) {
  return UCA_CONFIG.EDITIONS.filter(e => isPublished(e, nowISO));
}
