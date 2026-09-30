import http from "node:http";
import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,item=""]=value.replace(/^--/,"").split("=");return[key,item];}));
const root=path.resolve(args.root||"dist"),port=Number(args.port||4173),backend=String(args.backend||"").replace(/\/$/,"");
if(!backend)throw new Error("Falta --backend");

const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".ico":"image/x-icon",".woff2":"font/woff2"};
const hopByHop=new Set(["connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer","transfer-encoding","upgrade","content-encoding","content-length"]);

async function proxy(req,res){
  const target=new URL(req.url,`${backend}/`);
  const body=["GET","HEAD"].includes(req.method||"")?undefined:await new Promise((resolve,reject)=>{const chunks=[];req.on("data",chunk=>chunks.push(chunk));req.on("end",()=>resolve(Buffer.concat(chunks)));req.on("error",reject);});
  const headers=Object.fromEntries(Object.entries(req.headers).filter(([key])=>key!=="host"&&key!=="connection"));
  const response=await fetch(target,{method:req.method,headers,body,redirect:"manual"});
  response.headers.forEach((value,key)=>{if(!hopByHop.has(key.toLowerCase()))res.setHeader(key,value);});
  res.statusCode=response.status;
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serve(rootPath,req,res){
  const requestPath=decodeURIComponent(new URL(req.url,"http://local").pathname);
  const candidate=path.resolve(rootPath,`.${requestPath}`);
  const safe=candidate.startsWith(rootPath)?candidate:path.join(rootPath,"index.html");
  let file=safe;
  try{if((await stat(file)).isDirectory())file=path.join(file,"index.html");await stat(file);}catch(_){file=path.join(rootPath,"index.html");}
  res.statusCode=200;res.setHeader("content-type",mime[path.extname(file)]||"application/octet-stream");createReadStream(file).pipe(res);
}

http.createServer(async(req,res)=>{
  try{if(String(req.url||"").startsWith("/api/"))await proxy(req,res);else await serve(root,req,res);}
  catch(error){res.statusCode=502;res.setHeader("content-type","application/json");res.end(JSON.stringify({error:"measurement_proxy_failed",message:String(error?.message||error)}));}
}).listen(port,"127.0.0.1",()=>console.log(`phase1b measurement proxy listening on ${port}`));
