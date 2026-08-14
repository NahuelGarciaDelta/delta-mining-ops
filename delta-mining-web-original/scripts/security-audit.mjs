import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const uiPath = path.join(root, "src/components/ui/index.jsx");
const ui = fs.readFileSync(uiPath, "utf8");

if (/\.innerHTML\s*=/.test(ui)) errors.push("src/components/ui/index.jsx no debe usar innerHTML para tooltips de tablas.");
if (/document\.createElement\s*\(\s*["']div["']\s*\)/.test(ui)) errors.push("src/components/ui/index.jsx no debe crear tooltips de tabla con document.createElement.");

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      if (/dangerouslySetInnerHTML/.test(text)) errors.push(`${path.relative(root, full)} contiene dangerouslySetInnerHTML.`);
      if (/\beval\s*\(/.test(text)) errors.push(`${path.relative(root, full)} contiene eval().`);
    }
  }
}
walk(path.join(root, "src"));

if (errors.length) {
  console.error("Security audit FAILED:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log("Security audit OK: tooltips de Table sin innerHTML/DOM imperativo, sin dangerouslySetInnerHTML ni eval.");
