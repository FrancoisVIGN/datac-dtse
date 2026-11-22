const $ = id => document.getElementById(id);
let index = [];
const msg = (t, cls = "") => { $("msg").textContent = t; $("msg").className = "message " + cls; };

/* ---------- Lignes de réponses ---------- */
function ajouterLigne() {
  const d = document.createElement("div"); d.className = "rep";
  d.innerHTML = `<span class="n"></span><input class="lib" placeholder="Réponse" aria-label="Réponse">
    <input class="pts" type="number" min="0" placeholder="Points" aria-label="Points">
    <input class="ali" placeholder="Alias, séparés par des virgules" aria-label="Alias">
    <span class="outils"><button type="button" data-a="haut" aria-label="Monter">↑</button>
    <button type="button" data-a="bas" aria-label="Descendre">↓</button>
    <button type="button" data-a="sup" aria-label="Supprimer">✕</button></span>`;
  $("reps").appendChild(d); numeroter();
}
function numeroter() { document.querySelectorAll(".rep .n").forEach((n, i) => n.textContent = i + 1); apercu(); }
$("reps").onclick = e => {
  const a = e.target.dataset.a, l = e.target.closest(".rep"); if (!a) return;
  if (a === "sup" && document.querySelectorAll(".rep").length > 1) l.remove();
  if (a === "haut" && l.previousElementSibling) l.parentNode.insertBefore(l, l.previousElementSibling);
  if (a === "bas" && l.nextElementSibling) l.parentNode.insertBefore(l.nextElementSibling, l);
  numeroter();
};
$("ajout").onclick = ajouterLigne;
$("f").oninput = apercu;

/* ---------- Construction des données ---------- */
function prochainId(idx) {
  const max = Math.max(0, ...idx.map(x => parseInt(String(x.id).replace(/\D/g, ""), 10) || 0));
  return "q-" + String(max + 1).padStart(4, "0");
}
function lire() {
  return [...document.querySelectorAll(".rep")].map(r => {
    const rep = { libelle: r.querySelector(".lib").value.trim() };
    const p = r.querySelector(".pts").value; if (p !== "") rep.points = Number(p);
    const alias = r.querySelector(".ali").value.split(",").map(s => s.trim()).filter(Boolean);
    if (alias.length) rep.alias = alias;
    return rep;
  }).filter(r => r.libelle);
}
function construire(idx) {
  const categorie = $("categorie").value.trim(), question = $("question").value.trim(), reponses = lire();
  if (!categorie || !question) throw new Error("Renseignez la catégorie et la question.");
  if (reponses.length < 2) throw new Error("Il faut au moins deux réponses.");
  const id = prochainId(idx);
  const entree = { id, question, categorie, nb: reponses.length };
  const nouvelIndex = [...idx, entree].sort((a, b) => a.id.localeCompare(b.id));
  return { id, q: { id, question, categorie, reponses }, nouvelIndex };
}
function total() {
  const t = [...document.querySelectorAll(".rep .pts")].reduce((s, i) => s + (Number(i.value) || 0), 0);
  $("total").textContent = `Total des points : ${t} / 100` + (t < 100 ? ` (il manque ${100 - t})` : t > 100 ? ` (${t - 100} en trop)` : " ✓");
  $("total").className = "total " + (t === 100 ? "ok" : t > 100 ? "ko" : "bas");
}
$("trier").onclick = () => {
  const val = l => { const v = l.querySelector(".pts").value; return v === "" ? -Infinity : Number(v); };
  [...document.querySelectorAll(".rep")].map((l, i) => [l, i])
    .sort((a, b) => val(b[0]) - val(a[0]) || a[1] - b[1])
    .forEach(([l]) => $("reps").appendChild(l));
  numeroter();
};
function apercu() {
  total();
  try { $("apercu").textContent = JSON.stringify(construire(index).q, null, 2); }
  catch (e) { $("apercu").textContent = "(complétez le formulaire pour voir l'aperçu)"; }
}

/* ---------- Téléchargement ---------- */
function telecharger(nom, texte) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texte], { type: "application/json" })); a.download = nom;
  document.body.appendChild(a); a.click(); a.remove();
}
$("telecharger").onclick = () => {
  try {
    const { id, q, nouvelIndex } = construire(index);
    telecharger(id + ".json", JSON.stringify(q, null, 2));
    setTimeout(() => telecharger("index.json", JSON.stringify(nouvelIndex, null, 2)), 300);
    msg(`Fichiers ${id}.json et index.json téléchargés : placez-les dans le dossier questions/ du site.`, "ok");
  } catch (e) { msg(e.message, "ko"); }
};

/* ---------- Publication via l'API GitHub ---------- */
const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const deb64 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), c => c.charCodeAt(0)));
async function api(chemin, options = {}) {
  const o = $("owner").value.trim(), r = $("repo").value.trim(), br = $("branche").value.trim() || "main";
  const url = `https://api.github.com/repos/${o}/${r}/contents/${chemin}` + (options.method ? "" : `?ref=${br}`);
  const rep = await fetch(url, { ...options, headers: { Authorization: "Bearer " + $("jeton").value.trim(), Accept: "application/vnd.github+json" } });
  if (!rep.ok) throw new Error(`GitHub a répondu ${rep.status} (${rep.status === 401 || rep.status === 403 ? "jeton ou droits insuffisants" : rep.status === 404 ? "dépôt, branche ou fichier introuvable" : "erreur"}).`);
  return rep.json();
}
$("publier").onclick = async () => {
  try {
    if (!$("owner").value.trim() || !$("repo").value.trim() || !$("jeton").value.trim()) throw new Error("Renseignez le compte, le dépôt et le jeton.");
    try { localStorage.setItem("gh", JSON.stringify({ o: $("owner").value, r: $("repo").value, b: $("branche").value })); } catch (e) {}
    msg("Publication en cours…");
    const br = $("branche").value.trim() || "main";
    const fichier = await api("questions/index.json");
    const { id, q, nouvelIndex } = construire(JSON.parse(deb64(fichier.content)));
    const put = (chemin, texte, extra = {}) => api(chemin, { method: "PUT",
      body: JSON.stringify({ message: `Ajout de la question ${id}`, content: b64(texte), branch: br, ...extra }) });
    await put(`questions/${id}.json`, JSON.stringify(q, null, 2));
    await put("questions/index.json", JSON.stringify(nouvelIndex, null, 2), { sha: fichier.sha });
    msg(`Question ${id} publiée. Le site sera à jour dans une à deux minutes.`, "ok");
    $("question").value = ""; document.querySelectorAll(".rep input").forEach(i => i.value = ""); apercu();
  } catch (e) { msg(e.message, "ko"); }
};

/* ---------- Initialisation ---------- */
(async () => {
  try { index = await (await fetch("questions/index.json", { cache: "no-store" })).json(); } catch (e) {}
  [...new Set(index.map(x => x.categorie))].forEach(c => { const o = document.createElement("option"); o.value = c; $("cats").appendChild(o); });
  try { const g = JSON.parse(localStorage.getItem("gh")); if (g) { $("owner").value = g.o; $("repo").value = g.r; $("branche").value = g.b; } } catch (e) {}
  for (let i = 0; i < 4; i++) ajouterLigne();
})();
