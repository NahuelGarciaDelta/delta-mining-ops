import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { USER_AREA_OPTIONS } from "../src/constants/userProfile.js";
import {
  getAuthenticatedUser,
  saveAuthenticatedSession,
  updateAuthenticatedUser,
} from "../src/services/authSession.js";

function memorySessionStorage(){
  const values=new Map();
  return {
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
  };
}

test("GERENTE está disponible y persiste en la sesión del perfil",()=>{
  globalThis.sessionStorage=memorySessionStorage();
  assert.ok(USER_AREA_OPTIONS.includes("GERENTE"));

  saveAuthenticatedSession({email:"gerente@delta.test",rol:"USUARIO",area:"GERENTE"});
  updateAuthenticatedUser({area:"GERENTE"});

  assert.equal(sessionStorage.getItem("dm_area"),"GERENTE");
  assert.equal(getAuthenticatedUser().area,"GERENTE");
});

test("Apps Script normaliza, guarda y devuelve GERENTE sin convertirlo en administrador",()=>{
  const source=fs.readFileSync(new URL("../AppsScript_Delta_Mining_OPS_FINAL.txt",import.meta.url),"utf8");
  assert.match(source,/function usuarioNormalizarArea_\(v\)/);
  assert.match(source,/var requestedArea=usuarioNormalizarArea_\(payload\.area\)/);
  assert.match(source,/if\(canChangeArea\)info\.sheet\.getRange\(rowNum,info\.areaIdx\+1\)\.setValue\(area\)/);
  assert.doesNotMatch(source,/currentRole==="GERENTE"/);
});

test("la bienvenida recibe y muestra el área persistida",()=>{
  const source=fs.readFileSync(new URL("../src/modules/home/ViewBienvenida.jsx",import.meta.url),"utf8");
  assert.match(source,/areaUsuario/);
});
