import { execFileSync } from "node:child_process";
const base=process.argv[2]||"origin/main";
const changed=execFileSync("git",["diff","--name-only",`${base}...HEAD`],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean);
const allowed=new Set([
  "scripts/pm-panel-active-7-days-vite-plugin.mjs",
  "scripts/supabase-same-origin-proxy-vite-plugin.mjs",
  "src/App.jsx",
  "src/modules/mantenimiento/MantenimientoModule.jsx",
  "src/modules/mantenimiento/MantenimientoProgramadoView.jsx",
  "vite.config.js",
  "scripts/full-regression-compare.mjs",
  "scripts/regression-source-guard.mjs",
  ".github/workflows/full-regression-parity.yml"
]);
const unexpected=changed.filter(f=>!allowed.has(f));
if(unexpected.length){console.error("Archivos inesperados respecto de main:",unexpected);process.exit(1);}
const forbiddenPrefixes=["src/services/","api/","src/modules/abastecimiento/","src/modules/licitaciones/","src/modules/oficina-tecnica/","src/modules/home/"];
const forbidden=changed.filter(f=>forbiddenPrefixes.some(p=>f.startsWith(p)));
if(forbidden.length){console.error("Se modificaron rutas funcionales fuera del alcance:",forbidden);process.exit(1);}
const patch=execFileSync("git",["diff","--unified=0",`${base}...HEAD`,"--","src/modules/mantenimiento/MantenimientoProgramadoView.jsx"],{encoding:"utf8"});
const risky=patch.split(/\r?\n/).filter(line=>/^[+-](?![+-])/.test(line)&&/(fetchAction\(|saveProgramacion|saveRealizado|saveConfig|delete|remove|insert|update|POST|PUT|PATCH|DELETE)/i.test(line));
if(risky.length){console.error("El diff toca posibles caminos de escritura en PM:",risky);process.exit(1);}
console.log("Source guard PASS");
console.log("Changed files:",changed.join(", "));
