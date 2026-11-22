const MAX_ERREURS = 3;
const $ = id => document.getElementById(id);
let index = [], categorie = "Toutes", q = null, trouvees, erreurs, score, fini;

/* ---------- Son (synthétisé, aucun fichier audio) ---------- */
let sonActif = true;
try { sonActif = localStorage.getItem("son") !== "off"; } catch (e) {}
let ctx;
function bip(notes, type = "sine", duree = .15, vol = .15) {
  if (!sonActif) return;
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * duree;
    o.type = type; o.frequency.value = f; g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.001, t + duree);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + duree);
  });
}
const sons = { ok: () => bip([660, 880]), ko: () => bip([140, 110], "sawtooth", .25, .2), gagne: () => bip([523, 659, 784, 1047], "triangle", .16) };
function majSon() {
  const b = $("son");
  b.setAttribute("aria-pressed", sonActif);
  b.textContent = sonActif ? "Son activé" : "Son coupé";
  try { localStorage.setItem("son", sonActif ? "on" : "off"); } catch (e) {}
}
$("son").onclick = () => { sonActif = !sonActif; majSon(); };

/* ---------- Catalogue ---------- */
function afficherCatalogue() {
  const mot = Matcher.norm($("recherche").value);
  const res = index.filter(x => (categorie === "Toutes" || x.categorie === categorie) &&
    (!mot || Matcher.norm(x.question + " " + x.categorie).includes(mot)));
  $("liste").innerHTML = res.map(x => `<a class="carte" href="#${x.id}"><small>${x.categorie || "Divers"}</small>
    <strong>${x.question}</strong><small>${x.nb} réponses</small></a>`).join("");
  $("vide").hidden = res.length > 0;
}
function afficherFiltres() {
  const cats = ["Toutes", ...new Set(index.map(x => x.categorie).filter(Boolean))];
  $("filtres").innerHTML = cats.map(c => `<button type="button" aria-pressed="${c === categorie}">${c}</button>`).join("");
  $("filtres").querySelectorAll("button").forEach(b => b.onclick = () => { categorie = b.textContent; afficherFiltres(); afficherCatalogue(); });
}

/* ---------- Félicitations : banderole 10 s + confettis ---------- */
let minuteur;
function cacherBanderole() {
  clearTimeout(minuteur); $("banderole").hidden = true; $("confettis").innerHTML = "";
}
function felicitations() {
  cacherBanderole();
  const couleurs = ["#f5c542", "#fff3b0", "#2f6fba", "#ffffff", "#d62828"];
  $("confettis").innerHTML = Array.from({length: 60}, () =>
    `<i style="left:${Math.random() * 100}%;background:${couleurs[Math.floor(Math.random() * 5)]};` +
    `animation-delay:${Math.random() * 2}s;animation-duration:${3 + Math.random() * 3}s"></i>`).join("");
  $("banderole").hidden = false;
  minuteur = setTimeout(cacherBanderole, 10000);
}
$("banderole").onclick = cacherBanderole;

/* ---------- Jeu ---------- */
function message(t, cls = "") { $("message").textContent = t; $("message").className = "message " + cls; }
function dessiner() {
  $("croix").innerHTML = Array.from({length: MAX_ERREURS}, (_, i) => `<span class="${i < erreurs ? "on" : ""}">✕</span>`).join("");
  $("tableau").innerHTML = q.reponses.map((r, i) => {
    const etat = trouvees.has(i) ? "trouve" : fini ? "rate" : "cache";
    return `<li class="${etat}"><span class="rang">${i + 1}</span><span class="texte">${r.libelle}</span><span class="pts">${r.points ?? ""}</span></li>`;
  }).join("");
  $("score").textContent = score;
}
function demarrer(data) {
  cacherBanderole();
  q = data; trouvees = new Set(); erreurs = 0; score = 0; fini = false;
  $("enonce").textContent = q.question; $("saisie").value = ""; $("saisie").disabled = false;
  message(""); dessiner(); $("saisie").focus();
}
function terminer(gagne) {
  fini = true; $("saisie").disabled = true;
  message(gagne ? "Bravo, toutes les réponses sont trouvées !" : "Trois erreurs : la manche est terminée.", gagne ? "ok" : "ko");
  if (gagne) { sons.gagne(); felicitations(); }
  dessiner();
}
$("form").onsubmit = e => {
  e.preventDefault();
  const v = $("saisie").value.trim(); if (!v || fini) return;
  const i = Matcher.chercher(v, q.reponses, trouvees);
  if (i >= 0) {
    trouvees.add(i); score += q.reponses[i].points || 0; sons.ok(); message("Bonne réponse : " + q.reponses[i].libelle, "ok");
    dessiner(); if (trouvees.size === q.reponses.length) terminer(true);
  } else if (i === -2) { message("Cette réponse est déjà trouvée.", "ko"); }
  else { erreurs++; sons.ko(); message("Raté !", "ko"); dessiner(); if (erreurs >= MAX_ERREURS) terminer(false); }
  $("saisie").value = "";
};
$("reveler").onclick = () => { if (q) { fini = true; $("saisie").disabled = true; message(""); dessiner(); } };
$("rejouer").onclick = () => q && demarrer(q);

/* ---------- Navigation par #id ---------- */
async function route() {
  const id = location.hash.slice(1);
  if (!id) { cacherBanderole(); $("jeu").hidden = true; $("catalogue").hidden = false; return; }
  try {
    const r = await fetch(`questions/${encodeURIComponent(id)}.json`);
    if (!r.ok) throw 0;
    demarrer(await r.json()); $("catalogue").hidden = true; $("jeu").hidden = false;
  } catch (e) { location.hash = ""; }
}
async function init() {
  majSon();
  try { index = await (await fetch("questions/index.json")).json(); }
  catch (e) { $("liste").textContent = "Impossible de charger les questions. Ouvrez le site via un serveur web (voir le README)."; return; }
  afficherFiltres(); afficherCatalogue();
  $("recherche").oninput = afficherCatalogue;
  window.onhashchange = route; route();
}
init();
