/* ══════════════════════════════════════════════════════════════════
   UCA — GATE SYSTEM v3.1
   ══════════════════════════════════════════════════════════════════ */

/* ── 0. MODE ARCHIVE (décision du PO, 2026-11-03) ──
   Tout le contenu est en accès libre : aucune vérification de courriel,
   aucun appel réseau, aucune offre. Un bandeau dit que le site est une
   archive. Pour revenir au fonctionnement d'avant : UCA_ARCHIVE = false. */
var UCA_ARCHIVE = true;

/* ── 1. CLÉS LOCALSTORAGE ── */
var LS_HAS_EMAIL  = "uca_has_email";
var LS_EMAIL      = "uca_email";
var LS_IS_PREMIUM = "uca_is_premium";

/* ── 1b. WRAPPERS LOCALSTORAGE ── */
/* Safari en mode privé et Firefox avec storage désactivé lancent une
   exception sur accès à localStorage. On encapsule pour ne pas crasher
   le gate dans ces cas — l'utilisateur perd juste la persistance locale. */
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); }
  catch (e) { /* mode privé ou quota — persistance perdue, pas bloquant */ }
}
function lsRemove(key) {
  try { localStorage.removeItem(key); }
  catch (e) { /* ignore */ }
}

/* ── 2. HELPERS LOCALSTORAGE ── */
function hasEmailAccess()  { return UCA_ARCHIVE || lsGet(LS_HAS_EMAIL)  === "1"; }
function isPremiumUser()   { return UCA_ARCHIVE || lsGet(LS_IS_PREMIUM) === "1"; }
function getStoredEmail()  { return lsGet(LS_EMAIL) || ""; }

function setEmailAccess(email, status) {
  lsSet(LS_HAS_EMAIL, "1");
  if (email)                lsSet(LS_EMAIL, email);
  if (status === "premium") lsSet(LS_IS_PREMIUM, "1");
  else                      lsRemove(LS_IS_PREMIUM);
}
function clearAccess() {
  lsRemove(LS_HAS_EMAIL);
  lsRemove(LS_EMAIL);
  lsRemove(LS_IS_PREMIUM);
}

/* ── 3. RE-VÉRIFICATION SILENCIEUSE ── */
async function silentReVerify(email) {
  try {
    var res = await fetch("/.netlify/functions/verify-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: email })
    });
    if (!res.ok) return false;
    var data = await res.json();
    setEmailAccess(email, data.status);
    return true;
  } catch (e) {
    console.warn("UCA: re-vérification silencieuse échouée", e);
    return false;
  }
}

/* ── 4. COOKIE SERVEUR ── */
async function checkServerAccess() {
  try {
    var res = await fetch("/.netlify/functions/check-access");
    if (!res.ok) return { status: "none" };
    return await res.json();
  } catch (e) {
    return { status: "none" };
  }
}

/* ── 5. INIT ── */
async function initGate() {
  if (UCA_ARCHIVE) {
    injectArchiveBanner();
    applyNewsletterAccess();
    applyDossierAccess();
    applyNLAccess();
    initNavScroll();
    return;
  }
  applyUrlParams();
  var server = await checkServerAccess();
  if (server.status === "premium" || server.status === "free") {
    setEmailAccess(server.email, server.status);
  } else {
    var storedEmail = getStoredEmail();
    if (storedEmail) await silentReVerify(storedEmail);
  }
  applyNewsletterAccess();
  applyDossierAccess();
  applyNLAccess();
  bindNewsletterLockedLinks();
  bindLockedNav();
  initNavScroll();
  bindEnterKey();
}

/* ── 5b. BANDEAU D'ARCHIVE ── */
function injectArchiveBanner() {
  if (document.getElementById("uca-archive-banner")) return;
  var b = document.createElement("div");
  b.id = "uca-archive-banner";
  b.setAttribute("role", "note");
  b.style.cssText = [
    "background:#0A0A14","color:#F7F5F0","font-family:'Barlow',sans-serif",
    "font-size:14px","line-height:1.5","padding:12px 20px","text-align:center",
    "border-bottom:2px solid #B8973A","position:relative","z-index:1000"
  ].join(";");
  b.innerHTML = "<strong style=\"color:#B8973A\">Archives 2026</strong> · Un Cran d\u2019Avance a publi\u00e9 de janvier \u00e0 mai 2026. " +
    "Tout est en acc\u00e8s libre ; les chiffres sont ceux de la date de publication. " +
    "<a href=\"/archives.html\" style=\"color:#F7F5F0;text-decoration:underline\">Toutes les archives</a>";
  document.body.insertBefore(b, document.body.firstChild);
}

/* ── 6. SOUMISSION EMAIL ── */
function isValidEmail(email) {
  var val    = String(email).trim().toLowerCase();
  var banned = ["test@test.com","fake@mail.com","a@a.com","user@user.com"];
  var re     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(val) && banned.indexOf(val) === -1;
}

async function handleEmailSubmit(email) {
  if (!isValidEmail(email)) return false;
  try {
    var res = await fetch("/.netlify/functions/verify-email", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email: email })
    });
    if (!res.ok) return false;
    var data = await res.json();
    setEmailAccess(email, data.status);
    applyNewsletterAccess();
    applyDossierAccess();
    applyNLAccess();
    return true;
  } catch (e) {
    console.warn("UCA: handleEmailSubmit error", e);
    return false;
  }
}

function ucaHandleEmailGate() {
  var inputEl   = document.getElementById("gate-email-input");
  var errorEl   = document.getElementById("gate-email-error");
  var consentEl = document.getElementById("consent-gate");
  if (!inputEl) return;
  var email = inputEl.value.trim();

  /* Validation email */
  if (!isValidEmail(email)) {
    inputEl.style.borderColor = "#C8102E";
    if (errorEl) { errorEl.textContent = "⚠ Email invalide — vérifiez le format."; errorEl.style.display = "block"; }
    return;
  }
  inputEl.style.borderColor = "";

  /* Validation consentement */
  if (consentEl && !consentEl.checked) {
    consentEl.style.outline = "2px solid #C8102E";
    consentEl.style.outlineOffset = "2px";
    if (errorEl) { errorEl.textContent = "⚠ Merci de cocher la case de consentement pour continuer."; errorEl.style.display = "block"; }
    return;
  }
  if (consentEl) consentEl.style.outline = "";
  if (errorEl) errorEl.style.display = "none";

  /* Déverrouillage immédiat — ne pas attendre la vérification réseau */
  setEmailAccess(email, "free");
  applyNewsletterAccess();
  applyDossierAccess();
  applyNLAccess();

  /* Redirect vers bienvenue si on est sur la page newsletter */
  if (window.location.pathname.indexOf('page-newsletter') !== -1) {
    setTimeout(function() { window.location.href = 'membre-welcome.html'; }, 400);
  } else {
    setTimeout(function() {
      var first = document.getElementById("nl-content-full") ||
                  document.querySelector(".content-email-private,.content-email,#content-email-private");
      if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }

  /* Vérification réseau en arrière-plan (non bloquante) */
  handleEmailSubmit(email).catch(function() {});
}
function handleEmailGate() { ucaHandleEmailGate(); }

/* ── 7. UI NEWSLETTER ── */
function applyNewsletterAccess() {
  var ok = hasEmailAccess();
  document.body.classList.toggle("has-email",   ok);
  document.body.classList.toggle("has-premium", isPremiumUser());

  var gate         = document.querySelector(".nl-gate-email, #nl-gate-email");
  var archivesFull = document.querySelector(".nl-archives-full");
  var gateOld      = document.getElementById("gate-email-block");
  var archivesOld  = document.getElementById("content-email-private");

  if (ok) {
    if (gate)         gate.style.display        = "none";
    if (archivesFull) archivesFull.style.display = "block";
    if (gateOld)      gateOld.style.display      = "none";
    if (archivesOld)  archivesOld.style.display  = "block";
  } else {
    if (gate)         gate.style.display        = "block";
    if (archivesFull) archivesFull.style.display = "none";
    if (gateOld)      gateOld.style.display      = "block";
    if (archivesOld)  archivesOld.style.display  = "none";
  }
}

function bindNewsletterLockedLinks() {
  document.querySelectorAll(".nl-archive-link, .ar-link").forEach(function(link) {
    link.addEventListener("click", function(e) {
      if (!hasEmailAccess()) {
        e.preventDefault();
        var g = document.querySelector("#nl-gate-email,#gate-email-block,.nl-gate-email,.gate-archives");
        if (g) g.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}

/* ── 8. UI DOSSIER ── */
function applyDossierAccess() {
  var emailOk   = hasEmailAccess();
  var premiumOk = isPremiumUser();

  document.body.classList.toggle("has-email",   emailOk);
  document.body.classList.toggle("has-premium", premiumOk);

  var gateEmail       = document.querySelector(".content-gate-email, #gate-email");
  var contentEmail    = document.querySelector(".content-email");
  var gatePremium     = document.querySelector(".content-gate-premium, #gate-premium");
  var contentPremium  = document.querySelector(".content-premium");
  var gateEmailOld    = document.getElementById("gate-email-block");
  var contentEmailOld = document.getElementById("content-email-private");
  var gatePremOld     = document.getElementById("gate-premium-block");
  var contentPremOld  = document.getElementById("content-premium-private");

  function show(el) { if (el) el.style.display = "block"; }
  function hide(el) { if (el) el.style.display = "none"; }

  if (!emailOk) {
    show(gateEmail);      show(gateEmailOld);
    hide(contentEmail);   hide(contentEmailOld);
    hide(gatePremium);    hide(gatePremOld);
    hide(contentPremium); hide(contentPremOld);
    document.querySelectorAll(".uca-gate-dossier").forEach(function(el) { el.style.display = "block"; });
    document.querySelectorAll(".uca-gated-dossier").forEach(function(el) { el.style.setProperty("display", "none", "important"); });
    return;
  }
  if (!premiumOk) {
    hide(gateEmail);      hide(gateEmailOld);
    show(contentEmail);   show(contentEmailOld);
    hide(gatePremium);    hide(gatePremOld);
    hide(contentPremium); hide(contentPremOld);
    document.querySelectorAll(".uca-gate-dossier").forEach(function(el) { el.style.display = "block"; });
    document.querySelectorAll(".uca-gated-dossier").forEach(function(el) { el.style.setProperty("display", "none", "important"); });
    return;
  }
  hide(gateEmail);      hide(gateEmailOld);
  show(contentEmail);   show(contentEmailOld);
  hide(gatePremium);    hide(gatePremOld);
  show(contentPremium); show(contentPremOld);
  document.querySelectorAll(".uca-gate-dossier").forEach(function(el) { el.style.display = "none"; });
  document.querySelectorAll(".uca-gated-dossier").forEach(function(el) { el.style.removeProperty("display"); el.style.setProperty("display", "block", "important"); });
  var sbGate = document.getElementById("sb-premium-gate");
  if (sbGate) sbGate.style.display = "none";
}

function bindLockedNav() {
  document.querySelectorAll(".nav-email-locked, .mn-item[data-gate='email']").forEach(function(link) {
    link.addEventListener("click", function(e) {
      if (!hasEmailAccess()) {
        e.preventDefault();
        var g = document.querySelector("#gate-email,#gate-email-block,.content-gate-email");
        if (g) g.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
  document.querySelectorAll(".nav-premium-locked, .mn-item[data-gate='premium']").forEach(function(link) {
    link.addEventListener("click", function(e) {
      if (!isPremiumUser()) {
        e.preventDefault();
        var g = document.querySelector("#gate-premium,#gate-premium-block,.content-gate-premium");
        if (g) g.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
  document.querySelectorAll(".mn-item[data-gate]").forEach(function(item) {
    var gate   = item.getAttribute("data-gate");
    var locked = (gate === "email"   && !hasEmailAccess()) ||
                 (gate === "premium" && !isPremiumUser());
    item.classList.toggle("locked", locked);
  });
}

/* ── 9. UI NL INDIVIDUELLE ── */
function applyNLAccess() {
  var auth        = hasEmailAccess();
  var gateBlock   = document.querySelector(".gate-block");
  var nlContent   = document.getElementById("nl-content-full");
  var fadeoutWrap = document.querySelector(".fadeout-wrap");

  document.body.classList.toggle("has-email", auth);

  if (auth) {
    if (gateBlock)   gateBlock.style.display   = "none";
    if (nlContent)   nlContent.style.display   = "block";
    if (fadeoutWrap) fadeoutWrap.style.display  = "none";
  } else {
    if (gateBlock)   gateBlock.style.display   = "block";
    if (nlContent)   nlContent.style.display   = "none";
    if (fadeoutWrap) fadeoutWrap.style.display  = "block";
  }
}

/* ── 10. NAV SCROLL ── */
function initNavScroll() {
  var sections = ["verdict","brief","analyse","ressources"];
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting) return;
      document.querySelectorAll(".mn-item").forEach(function(i) { i.classList.remove("active"); });
      var nav = document.querySelector("[data-section='" + e.target.id + "']");
      if (nav) {
        nav.classList.add("active");
        nav.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    });
  }, { rootMargin: "-15% 0px -75% 0px" });
  sections.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) obs.observe(el);
  });
}

/* ── 11. URL PARAMS ── */
function applyUrlParams() {
  var params = new URLSearchParams(window.location.search);
  if (params.get("premium") === "0") { clearAccess(); return; }
  if (params.get("premium") === "1") {
    lsSet(LS_IS_PREMIUM, "1");
    lsSet(LS_HAS_EMAIL,  "1");
  }
  if (params.get("premium") === "0") {
    clearAccess();
  }
}

/* ── 12. ENTER KEY ── */
function bindEnterKey() {
  document.querySelectorAll("#gate-email-input, #rp-email, .gate-input[type='email']")
    .forEach(function(inp) {
      inp.addEventListener("keydown", function(e) {
        if (e.key === "Enter") ucaHandleEmailGate();
      });
    });
}

/* ── 13. TOAST ── */
var _toastTimer = null;
function showUCAToast(msg) {
  var t = document.getElementById("uca-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "uca-toast";
    t.style.cssText = [
      "position:fixed", "bottom:32px", "left:50%", "transform:translateX(-50%)",
      "background:#1A1A2E", "color:#fff",
      "font-family:'Barlow Condensed',sans-serif",
      "font-size:15px", "font-weight:700", "letter-spacing:0.5px",
      "padding:14px 32px",
      "border-left:4px solid #B8973A",
      "box-shadow:0 6px 32px rgba(0,0,0,0.45)",
      "z-index:9999", "pointer-events:none",
      "max-width:90vw", "text-align:center",
      "opacity:0", "transition:opacity 0.25s ease"
    ].join(";");
    document.body.appendChild(t);
  }
  t.textContent = msg;
  clearTimeout(_toastTimer);
  requestAnimationFrame(function() { t.style.opacity = "1"; });
  _toastTimer = setTimeout(function() { t.style.opacity = "0"; }, 3800);
}

/* ── 14. BOUTON ← ARCHIVES + MON ESPACE (dossier masthead) ── */
function injectDossierBackBtn() {
  if (!document.querySelector(".module-nav")) return;
  var masthead = document.querySelector(".masthead");
  if (!masthead || masthead.querySelector(".uca-back-btn")) return;
  var btn = document.createElement("a");
  btn.href      = UCA_ARCHIVE ? "archives.html" : "page-newsletter.html";
  btn.className = "uca-back-btn";
  btn.textContent = "\u2190 Archives";
  btn.style.cssText = [
    "font-family:'Barlow Condensed',sans-serif",
    "font-size:11px","font-weight:700","letter-spacing:1.5px","text-transform:uppercase",
    "color:rgba(255,255,255,0.85)","text-decoration:none",
    "border:1px solid rgba(255,255,255,0.30)","padding:5px 14px","white-space:nowrap"
  ].join(";");
  masthead.insertBefore(btn, masthead.firstChild);
  // Ajouter "Mon espace →" à droite si abonné (jamais en archive)
  if (!UCA_ARCHIVE && hasEmailAccess()) {
    var esp = document.createElement("a");
    esp.href      = "membre-welcome.html";
    esp.className = "uca-espace-btn";
    esp.textContent = "Mon espace \u2192";
    esp.style.cssText = [
      "font-family:'Barlow Condensed',sans-serif",
      "font-size:11px","font-weight:700","letter-spacing:1.5px","text-transform:uppercase",
      "color:rgba(184,151,58,0.9)","text-decoration:none",
      "border:1px solid rgba(184,151,58,0.35)","padding:5px 14px","white-space:nowrap"
    ].join(";");
    masthead.appendChild(esp);
  }
}

/* ── 14b. BOUTON FLOTTANT MON ESPACE ── */
function injectMonEspaceBtn() {
  if (UCA_ARCHIVE) return;
  if (!hasEmailAccess()) return;
  if (document.getElementById("uca-mon-espace-btn")) return;
  var btn = document.createElement("a");
  btn.id        = "uca-mon-espace-btn";
  btn.href      = "membre-welcome.html";
  btn.textContent = "Mon espace \u2192";
  btn.style.cssText = [
    "position:fixed","bottom:80px","right:24px","z-index:500",
    "font-family:'Barlow Condensed',sans-serif",
    "font-size:10px","font-weight:700","letter-spacing:2px","text-transform:uppercase",
    "color:#B8973A","background:rgba(10,10,20,0.88)",
    "border:1px solid rgba(184,151,58,0.45)",
    "padding:8px 16px","text-decoration:none",
    "backdrop-filter:blur(8px)",
    "opacity:0","transition:opacity 0.4s ease"
  ].join(";");
  document.body.appendChild(btn);
  setTimeout(function(){ btn.style.opacity = "1"; }, 600);
}

/* ── 15. BOUTON ← ARCHIVES (NL) ── */
function fixNLBackBtn() {
  var btn = document.querySelector(".nl-nav-back");
  if (!btn) return;
  btn.style.cssText = [
    "font-family:'Barlow Condensed',sans-serif",
    "font-size:11px","font-weight:700","letter-spacing:1.5px","text-transform:uppercase",
    "color:rgba(255,255,255,0.85)","text-decoration:none",
    "border:1px solid rgba(255,255,255,0.30)","padding:5px 14px"
  ].join(";");
}

/* ── 16. ONGLETS PREMIUM GATED ── */
function bindPremiumTabs() {
  if (isPremiumUser()) return;
  document.querySelectorAll(".mn-item[href^='#']").forEach(function(item) {
    var targetId = item.getAttribute("href").slice(1);
    var target   = document.getElementById(targetId);
    if (!target) return;
    if (!target.closest(".uca-gated-dossier")) return;
    item.addEventListener("click", function(e) {
      e.preventDefault();
      var gate = document.querySelector(".uca-gate-dossier");
      if (gate) gate.scrollIntoView({ behavior: "smooth", block: "center" });
      showUCAToast("Cette section est réservée aux membres Premium.");
    });
  });
}

/* ── 17. CARDS "À VENIR" (grille + hero card) ── */
function bindComingSoonCards() {
  /* Cards grille */
  document.querySelectorAll(".lib-card a[onclick*='return false']").forEach(function(link) {
    var card = link.closest(".lib-card");
    if (!card) return;
    var meta    = card.querySelector(".lc-meta");
    var dateStr = meta ? meta.textContent.trim() : "";
    card.style.cursor = "default";
    card.addEventListener("click", function(e) {
      e.preventDefault();
      showUCAToast("Ce dossier n'est pas encore disponible — " + dateStr);
    });
  });

  /* Hero card */
  var featured = document.getElementById("lib-featured");
  if (!featured) return;
  var link = featured.querySelector("a.lf-link");
  if (!link) return;
  var href = link.getAttribute("href") || "";
  var match = href.match(/nl-(\d{4}-\d{2}-\d{2})\.html/) ||
              href.match(/dossier-(\d{4}-\d{2}-\d{2})/);
  if (!match) return;
  var pubDate = new Date(match[1] + "T00:00:00Z");
  var today   = new Date(); today.setHours(0,0,0,0);
  if (pubDate > today) {
    link.style.cursor        = "default";
    link.style.pointerEvents = "none";
    link.removeAttribute("href");
    featured.style.cursor = "default";
    featured.addEventListener("click", function(e) {
      e.preventDefault();
      var d = pubDate.toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
      });
      showUCAToast("Ce contenu sera disponible le " + d + ".");
    });
  }
}

/* ── 18. SIDEBAR DOSSIER ── */
function fixDossierSidebar() {
  var sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  var parent = sidebar.parentElement;
  if (!parent) return;
  parent.style.alignItems = "start";
  sidebar.style.position  = "sticky";
  sidebar.style.top       = "106px";
  sidebar.style.alignSelf = "start";
  sidebar.style.height    = "auto";
}

/* ── 19. DÉMARRAGE ── */
document.addEventListener("DOMContentLoaded", function() {
  fixNLBackBtn();
  initGate().then(function() {
    injectDossierBackBtn();
    injectMonEspaceBtn();
    bindPremiumTabs();
    bindComingSoonCards();
    fixDossierSidebar();
  });
});
