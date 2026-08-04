import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve("src");
const extensions = ["", ".js", ".jsx"];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|jsx)$/.test(entry.name)) files.push(full);
  }
}

function resolves(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = extensions.map(ext => base + ext).concat([
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
  ]);
  return candidates.some(candidate => fs.existsSync(candidate));
}

walk(root);
const failures = [];
const importPattern = /(?:from\s+|import\s*)["'](\.[^"']+)["']/g;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    if (!resolves(file, match[1])) failures.push(`${path.relative(process.cwd(), file)} -> ${match[1]}`);
  }
}

if (failures.length) {
  console.error("Imports locales rotos:\n" + failures.join("\n"));
  process.exit(1);
}
console.log(`OK: ${files.length} archivos JS/JSX y todos los imports locales resuelven.`);
