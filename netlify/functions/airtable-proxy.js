// ══════════════════════════════════════════════════════════════════
// UCA — Netlify Function : airtable-proxy
//
// Rôle : proxy sécurisé entre UCA_Formulaire_Redaction_v2.html
//        et l'API Airtable.
//
// Le formulaire de rédaction n'appelle PLUS l'API Airtable directement.
// Il appelle ce proxy, qui détient le jeton côté serveur.
//
// Opérations autorisées :
//   GET  /signals  → liste les signaux sélectionnés (decision=selectionne)
//
// Variables d'environnement Netlify requises :
//   AIRTABLE_TOKEN       → nouveau jeton après révocation de l'ancien
//   AIRTABLE_BASE_ID     → app1bcu3yGKcJMuoG
//   AIRTABLE_TABLE_ID    → tbl4xZGH2zpSYCie8
//
// Accès restreint : en-tête X-UCA-Form-Key doit matcher UCA_FORM_KEY
//   → protège contre quelqu'un qui découvrirait l'URL du proxy
// ══════════════════════════════════════════════════════════════════

const AIRTABLE_TOKEN    = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID  = process.env.AIRTABLE_BASE_ID  || 'app1bcu3yGKcJMuoG';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tbl4xZGH2zpSYCie8';
const UCA_FORM_KEY      = process.env.UCA_FORM_KEY; // clé partagée formulaire ↔ proxy

const ALLOWED_ORIGIN = 'https://uncrandavance.com';

exports.handler = async (event) => {

  const headers = {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-UCA-Form-Key',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  // ── Vérification de la clé formulaire ────────────────────────
  // UCA_FORM_KEY est une clé partagée simple — pas cryptographique,
  // mais suffit pour bloquer les appelants non autorisés.
  if (UCA_FORM_KEY) {
    const formKey = event.headers['x-uca-form-key'] || '';
    if (formKey !== UCA_FORM_KEY) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Accès refusé' }) };
    }
  }

  if (!AIRTABLE_TOKEN) {
    console.error('airtable-proxy: AIRTABLE_TOKEN manquant');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuration manquante' }) };
  }

  try {
    // ── Récupérer les signaux sélectionnés depuis Airtable ───────
    const filterFormula = encodeURIComponent(`{decision} = "selectionne"`);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`
              + `?maxRecords=10`
              + `&filterByFormula=${filterFormula}`
              + `&sort[0][field]=score_total&sort[0][direction]=desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable ${res.status}: ${err}`);
    }

    const data = await res.json();

    // Ne retourner que les champs nécessaires au formulaire
    // (pas les données internes inutiles)
    const records = (data.records || []).map(r => ({
      id:           r.id,
      title:        r.fields.title  || r.fields.titre || '',
      source:       r.fields.source || '',
      score_total:  r.fields.score_total || 0,
      decision:     r.fields.decision || '',
      justification:r.fields.justification || '',
      leap:         r.fields.leap || 'A',
      categorie:    r.fields.categorie || 'Marché',
    }));

    return { statusCode: 200, headers, body: JSON.stringify({ records }) };

  } catch (err) {
    console.error('airtable-proxy error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur Airtable' }) };
  }
};
