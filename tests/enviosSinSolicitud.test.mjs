import assert from "node:assert/strict";
import test from "node:test";
import {allocateAbastecimientoRemitos,buildEnvioSinSolicitudKey} from "../src/modules/abastecimiento/enviosSinSolicitud.js";

const parseDateMs=value=>{const [d,m,y]=String(value).split("/").map(Number);return new Date(y,m-1,d).getTime();};
const normalize=value=>String(value||"").trim().toUpperCase().replace(/\s+/g," ");
const allocate=(requestRows,sourceRemitos,isRejected=()=>false)=>allocateAbastecimientoRemitos({requestRows,sourceRemitos,normalizeCode:normalize,normalizeProject:normalize,parseDateMs,toNumber:Number,formatDate:value=>value,isRejected});
const req=(fechaSolicitud="01/09/2026",cantidadSolicitada=5,centroCosto="JOSE MARIA",descripcion="Filtro original")=>({fechaSolicitud,cantidadSolicitada,centroCosto,codigoArticulo:"401",descripcion,nSolicitud:fechaSolicitud});
const rem=(fecha="05/09/2026",cantidad=5,proyecto="JOSE MARIA",descripcion="FILTRO EQUIVALENTE",id="r1")=>({id,fecha,proyecto,comprobante:`R-${id}`,items:[{id:`i-${id}`,codigo:"401",cantidad,descripcion}]});

test("asigna un remito posterior y no impone una ventana máxima de 15 días",()=>{
  assert.equal(allocate([req()],[rem()]).rows[0].cantidadEnviada,5);
  assert.equal(allocate([req("01/07/2026")],[rem("20/08/2026")]).rows[0].cantidadEnviada,5);
});

test("un envío anterior nunca consume una solicitud futura, incluso al recalcular",()=>{
  for(const result of [allocate([req("10/09/2026")],[rem("05/09/2026")]),allocate([req("10/09/2026")],[rem("05/09/2026")])]){
    assert.equal(result.rows[0].cantidadEnviada,0);
    assert.equal(result.rows[0].cantidadRestante,5);
    assert.equal(result.unmatched[0].cantidadEnviada,5);
  }
});

test("una solicitud rechazada no consume el remito",()=>{
  const result=allocate([req()],[rem()],()=>true);
  assert.equal(result.rows[0].cantidadEnviada,0);
  assert.equal(result.rows[0].cantidadRestante,5);
  assert.equal(result.unmatched[0].cantidadEnviada,5);
});

test("conserva el remanente parcial de una línea de remito",()=>{
  const result=allocate([req("01/09/2026",5)],[rem("05/09/2026",8)]);
  assert.equal(result.rows[0].cantidadEnviada,5);
  assert.equal(result.unmatched[0].cantidadEnviada,3);
});

test("aplica FIFO y nunca cruza proyectos",()=>{
  const rows=[req("01/09/2026",5),req("04/09/2026",10),req("01/09/2026",10,"FILO DEL SOL")];
  assert.deepEqual(allocate(rows,[rem("07/09/2026",8)]).rows.map(row=>row.cantidadEnviada),[5,3,0]);
});

test("la descripción no interviene en el matching",()=>{
  const result=allocate([req("01/09/2026",5,"JOSE MARIA","Filtro combustible 600-319-3750")],[rem("05/09/2026",5,"JOSE MARIA","FILTRO COMBUS FF5488")]);
  assert.equal(result.rows[0].cantidadEnviada,5);
});

test("la key distingue líneas y permanece estable",()=>{
  const base={codigoArticulo:"401",proyecto:"JOSE MARIA",fechaEnvio:"05/09/2026",numeroRemito:"R-1",descripcion:"Filtro",parseDateMs};
  const one=buildEnvioSinSolicitudKey({...base,lineaId:"linea-1"});
  const two=buildEnvioSinSolicitudKey({...base,lineaId:"linea-2"});
  assert.notEqual(one,two);
  assert.equal(one,buildEnvioSinSolicitudKey({...base,lineaId:"linea-1"}));
});

test("una solicitud agregada después no hace desaparecer el envío histórico",()=>{
  const before=allocate([],[rem("01/09/2026",10)]);
  const after=allocate([req("10/09/2026",10)],[rem("01/09/2026",10)]);
  assert.equal(before.unmatched[0].id,after.unmatched[0].id);
  assert.equal(after.rows[0].cantidadEnviada,0);
});
