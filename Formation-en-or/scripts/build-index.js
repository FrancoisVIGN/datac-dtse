// Usage : node scripts/build-index.js  — régénère questions/index.json
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "questions");
const index = fs.readdirSync(dir).filter(f => /^q-.*\.json$/.test(f)).sort().map(f => {
  const q = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  return { id: q.id || f.replace(".json", ""), question: q.question, categorie: q.categorie || "Divers", nb: q.reponses.length };
});
fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2));
console.log(index.length + " questions indexées.");
