import { promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root=process.cwd();
const distDir=path.join(root,"dist");
const outDir=path.join(root,"artifacts","phase0");
await fs.mkdir(outDir,{recursive:true});

async function walk(dir){
  const entries=await fs.readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...await walk(full));
    else if(entry.isFile())files.push(full);
  }
  return files;
}

const files=await walk(distDir);
const rows=[];
for(const file of files){
  const buf=await fs.readFile(file);
  const rel=path.relative(distDir,file).replaceAll(path.sep,"/");
  rows.push({
    file:rel,
    extension:path.extname(file).toLowerCase(),
    bytes:buf.byteLength,
    gzipBytes:gzipSync(buf,{level:9}).byteLength,
  });
}
rows.sort((a,b)=>b.bytes-a.bytes);

const sum=(items,key)=>items.reduce((acc,item)=>acc+(Number(item[key])||0),0);
const js=rows.filter(row=>row.extension===".js");
const css=rows.filter(row=>row.extension===".css");
const report={
  generatedAt:new Date().toISOString(),
  commit:process.env.GITHUB_SHA||null,
  branch:process.env.GITHUB_REF_NAME||null,
  totals:{
    files:rows.length,
    bytes:sum(rows,"bytes"),
    gzipBytes:sum(rows,"gzipBytes"),
    jsFiles:js.length,
    jsBytes:sum(js,"bytes"),
    jsGzipBytes:sum(js,"gzipBytes"),
    cssFiles:css.length,
    cssBytes:sum(css,"bytes"),
    cssGzipBytes:sum(css,"gzipBytes"),
  },
  largestFiles:rows.slice(0,40),
  files:rows,
};

await fs.writeFile(path.join(outDir,"bundle-metrics.json"),JSON.stringify(report,null,2));
const csv=["file,extension,bytes,gzipBytes",...rows.map(row=>[
  JSON.stringify(row.file),JSON.stringify(row.extension),row.bytes,row.gzipBytes
].join(","))].join("\n");
await fs.writeFile(path.join(outDir,"bundle-metrics.csv"),csv);

console.log("Phase 0 bundle metrics");
console.log(JSON.stringify(report.totals,null,2));
console.table(report.largestFiles.slice(0,15));
