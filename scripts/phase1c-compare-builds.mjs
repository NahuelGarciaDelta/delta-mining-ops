import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const [normalDir, diagnosticDir] = process.argv.slice(2);
if (!normalDir || !diagnosticDir) throw new Error("Uso: node phase1c-compare-builds.mjs <normal> <diagnostic>");

async function jsFiles(root) {
  const assets = path.join(root, "assets");
  const entries = await fs.readdir(assets, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".js")).map((entry) => entry.name).sort();
}

async function fingerprint(root, name) {
  const content = await fs.readFile(path.join(root, "assets", name));
  return { filename: name, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") };
}

const [normalNames, diagnosticNames] = await Promise.all([jsFiles(normalDir), jsFiles(diagnosticDir)]);
const names = [...new Set([...normalNames, ...diagnosticNames])].sort();
const files = await Promise.all(names.map(async (name) => {
  const normal = normalNames.includes(name) ? await fingerprint(normalDir, name) : null;
  const diagnostic = diagnosticNames.includes(name) ? await fingerprint(diagnosticDir, name) : null;
  return { filename: name, normal, diagnostic, byteIdentical: Boolean(normal && diagnostic && normal.bytes === diagnostic.bytes && normal.sha256 === diagnostic.sha256) };
}));
const byteIdentical = files.length > 0 && files.every((file) => file.byteIdentical);
console.log(JSON.stringify({ normalDir, diagnosticDir, byteIdentical, files }, null, 2));
