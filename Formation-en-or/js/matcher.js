/* Normalisation et correspondance des réponses */
const Matcher = (() => {
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  const stem = w => (w.length > 3 ? w.replace(/[sx]$/, "") : w);
  const mots = s => norm(s).split(" ").filter(Boolean).map(stem);
  function dist(a, b) { // Levenshtein
    const d = Array.from({length: a.length + 1}, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function correspond(saisie, candidat) {
    const s = mots(saisie), c = mots(candidat);
    if (!s.length || !c.length) return false;
    if (s.join(" ") === c.join(" ")) return true;
    if (s.every(m => m.length >= 3 && c.includes(m))) return true; // « fraise » → « fraise des bois »
    const a = s.join(" "), b = c.join(" ");
    return a.length >= 5 && dist(a, b) <= 1; // faute légère
  }
  /** Index de la réponse trouvée, -1 si aucune, -2 si déjà trouvée */
  function chercher(saisie, reponses, trouvees) {
    let deja = false;
    for (let i = 0; i < reponses.length; i++) {
      const r = reponses[i];
      if ([r.libelle, ...(r.alias || [])].some(x => correspond(saisie, x))) {
        if (trouvees.has(i)) deja = true; else return i;
      }
    }
    return deja ? -2 : -1;
  }
  return { norm, chercher };
})();
