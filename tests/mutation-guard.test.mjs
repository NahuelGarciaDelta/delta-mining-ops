import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  installMutationGuard,
  isProtectedMutationAction,
  mutationFingerprint,
  prepareMutationPayload,
  remitoBusinessKey,
  resetMutationGuardForTests,
  stableRemitoId,
} from "../src/services/mutationGuard.js";
import {abastecimientoLineEndingsVitePlugin} from "../scripts/abastecimiento-line-endings-vite-plugin.mjs";
import {abastecimientoInstantVitePlugin} from "../scripts/abastecimiento-instant-vite-plugin.mjs";
import {mutationIdempotencyVitePlugin} from "../scripts/mutation-idempotency-vite-plugin.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const remitoBase={
  comprobante:"TIN 00001-00000619",
  fecha:"2026-09-14",
  proyecto:"JOSE MARIA",
  origen:"01 DEPOSITO CENTRAL",
  destino:"JOSE MARIA",
  items:[{codigo:"1527ALT",descripcion:"FILTRO COMBUS FF5488",cantidad:3}],
};

test("la huella de un remito ignora IDs aleatorios y mutationId",()=>{
  const a={action:"save_remito_cargado",mutationId:"x",remito:{...remitoBase,id:"random-a"}};
  const b={action:"save_remito_cargado",mutationId:"y",remito:{...remitoBase,id:"random-b"}};
  assert.equal(mutationFingerprint(a),mutationFingerprint(b));
});

test("el ID de remito es determinista y reutiliza IDs históricos",()=>{
  const first=stableRemitoId(remitoBase,[]);
  const second=stableRemitoId({...remitoBase},[]);
  assert.equal(first,second);
  assert.match(first,/^raba08-[A-Z0-9]+$/);

  const legacy={...remitoBase,id:"raba08-1789474420129-bxyjf5"};
  assert.equal(stableRemitoId(remitoBase,[legacy]),legacy.id);
  assert.equal(remitoBusinessKey(remitoBase),remitoBusinessKey(legacy));
});

test("remitos realmente distintos no comparten ID",()=>{
  assert.notEqual(stableRemitoId(remitoBase,[]),stableRemitoId({...remitoBase,comprobante:"TIN 00001-00000620"},[]));
  assert.notEqual(stableRemitoId(remitoBase,[]),stableRemitoId({...remitoBase,fecha:"2026-09-15"},[]));
});

test("prepareMutationPayload agrega clave y estabiliza el remito",()=>{
  const prepared=prepareMutationPayload({action:"save_remito_cargado",remito:{...remitoBase,id:"aleatorio"}});
  assert.equal(prepared.payload.remito.id,stableRemitoId(remitoBase,[]));
  assert.equal(prepared.payload.mutationId,prepared.fingerprint);
  assert.equal(mutationFingerprint(prepared.payload),prepared.fingerprint);
});

test("el guard protege cualquier escritura Apps Script salvo autenticación",()=>{
  assert.equal(isProtectedMutationAction("save_remito_cargado"),true);
  assert.equal(isProtectedMutationAction("save_taller_movement"),true);
  assert.equal(isProtectedMutationAction("save_user_preferences"),true);
  assert.equal(isProtectedMutationAction("una_escritura_futura"),true);
  assert.equal(isProtectedMutationAction("authenticate_user"),false);
  assert.equal(isProtectedMutationAction(""),false);
});

test("dos POST idénticos simultáneos producen una sola petición real",async()=>{
  const originalWindow=globalThis.window;
  const originalNavigator=globalThis.navigator;
  const store=new Map();
  let networkCalls=0;
  const fakeWindow={
    location:{href:"https://delta.test/",origin:"https://delta.test"},
    localStorage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)},
    dispatchEvent:()=>true,
    fetch:async()=>{
      networkCalls+=1;
      await new Promise(resolve=>setTimeout(resolve,25));
      return new Response(JSON.stringify({ok:true,rowNumber:123}),{status:200,headers:{"Content-Type":"application/json"}});
    },
  };
  Object.defineProperty(globalThis,"window",{configurable:true,writable:true,value:fakeWindow});
  Object.defineProperty(globalThis,"navigator",{configurable:true,writable:true,value:{locks:{request:async(_name,_opts,fn)=>fn()}}});
  try{
    installMutationGuard();
    const makeBody=()=>new URLSearchParams({payload:JSON.stringify({action:"add_lista_equipo",row:{Codigo:"TOP-9999"}})});
    const [a,b]=await Promise.all([
      window.fetch("/api/apps-script",{method:"POST",body:makeBody()}),
      window.fetch("/api/apps-script",{method:"POST",body:makeBody()}),
    ]);
    assert.equal(networkCalls,1);
    assert.equal((await a.json()).ok,true);
    assert.equal((await b.json()).ok,true);

    const third=await window.fetch("/api/apps-script",{method:"POST",body:makeBody()});
    const thirdJson=await third.json();
    assert.equal(networkCalls,1);
    assert.equal(thirdJson.duplicatePrevented,true);
  }finally{
    resetMutationGuardForTests();
    if(originalWindow===undefined)delete globalThis.window;else Object.defineProperty(globalThis,"window",{configurable:true,writable:true,value:originalWindow});
    if(originalNavigator===undefined)delete globalThis.navigator;else Object.defineProperty(globalThis,"navigator",{configurable:true,writable:true,value:originalNavigator});
  }
});

test("el transform aplica guard global, remito estable y omite duplicadas RABA03 con LF y CRLF",()=>{
  const sourcePath=path.join(ROOT,"src/modules/abastecimiento/AbastecimientoModule.jsx");
  const mainPath=path.join(ROOT,"src/main.jsx");
  const source=fs.readFileSync(sourcePath,"utf8").replace(/\r\n?/g,"\n");
  const main=fs.readFileSync(mainPath,"utf8").replace(/\r\n?/g,"\n");

  for(const ending of ["lf","crlf"]){
    let code=ending==="crlf"?source.replace(/\n/g,"\r\n"):source;
    const id="/repo/src/modules/abastecimiento/AbastecimientoModule.jsx";
    const normalized=abastecimientoLineEndingsVitePlugin().transform(code,id);
    code=normalized?.code??code;
    const instant=abastecimientoInstantVitePlugin().transform(code,id);
    code=instant?.code??code;
    const guarded=mutationIdempotencyVitePlugin().transform(code,id);
    code=guarded?.code??code;
    assert.match(code,/window\.dmStableRemitoId/);
    assert.match(code,/row\.estado==="Nueva"/);
    assert.match(code,/duplicadas omitidas/);
    assert.doesNotMatch(code,/Se agregarán TODOS como filas nuevas\./);
  }

  const mainResult=mutationIdempotencyVitePlugin().transform(main,"/repo/src/main.jsx");
  const mainOut=mainResult?.code??main;
  assert.match(mainOut,/import \{installMutationGuard\} from "\.\/services\/mutationGuard\.js";/);
  assert.ok(mainOut.indexOf("installMutationGuard();")<mainOut.indexOf("createRoot(document.getElementById"));
});

test("Vite ejecuta idempotencia después de Abastecimiento instant y después del normalizador CRLF",()=>{
  const vite=fs.readFileSync(path.join(ROOT,"vite.config.js"),"utf8");
  const normalizer=vite.indexOf("abastecimientoLineEndingsVitePlugin()");
  const instant=vite.indexOf("abastecimientoInstantVitePlugin()");
  const guard=vite.indexOf("mutationIdempotencyVitePlugin()");
  assert.ok(normalizer>=0&&instant>normalizer&&guard>instant);
});
