import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {rop02ControlType} from "../src/shared/rop02ControlRules.js";
import {atrasoIchcFixesVitePlugin} from "../scripts/atraso-ichc-fixes-vite-plugin.mjs";
import {rop02ControlVehicleFiltersVitePlugin} from "../scripts/rop02-control-vehicle-filters-vite-plugin.mjs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("ROP02 identifies trucks, pickup trucks and road machines",()=>{
 assert.equal(rop02ControlType({maquina:"CAA-0002",equipo:"Camion regador"}),"Camiones");
 assert.equal(rop02ControlType({maquina:"CAV-0014",equipo:"Camion volcador"}),"Camiones");
 assert.equal(rop02ControlType({maquina:"CTA-1800",equipo:"Camioneta"}),"Camionetas");
 assert.notEqual(rop02ControlType({maquina:"EXC-0055",equipo:"Excavadora"}),"Camiones");
});

test("V9 builds with both original vehicle plugins in proper order",()=>{
 const vite=read("vite.v9.config.js");
 assert.match(vite,/atrasoIchcFixesVitePlugin\(\),rop02ControlVehicleFiltersVitePlugin\(\)/);
});

test("Control de errores does not discard excluded trucks/pickups or CAA-0002",()=>{
 const source=read("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
 const control=source.slice(source.indexOf("function ControlDeErrores("),source.indexOf("// ─── ControlPorEquipo"));
 assert.match(control,/vehicle==="Camiones"\|\|vehicle==="Camionetas"/);
 assert.doesNotMatch(control,/normalizeMachineCode\(m\)!=="CAA-0002"/);
});

test("V9 transformed Atraso and Error control expose truck and pickup type options",()=>{
 const src=read("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
 const path="/repo/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx";
 const atraso=atrasoIchcFixesVitePlugin().transform(src,path)?.code||src;
 const both=rop02ControlVehicleFiltersVitePlugin().transform(atraso,path)?.code||atraso;
 const err=both.slice(both.indexOf("function ControlDeErrores("),both.indexOf("// ─── ControlPorEquipo"));
 const delay=both.slice(both.indexOf("function ViewAtrasoROP02("),both.indexOf("function ViewControlROP02(",both.indexOf("function ViewAtrasoROP02(")));
 assert.match(err,/rop02MatchesDmTipoConVehiculos/);
 assert.match(err,/rop02TipoMaquinaOptionsConVehiculos/);
 assert.match(delay,/isAtrasoTruckOrPickup/);
 assert.match(delay,/rop02MatchesRop05TipoConVehiculos/);
 assert.match(delay,/rop02TipoMaquinaOptionsConVehiculos/);
});
