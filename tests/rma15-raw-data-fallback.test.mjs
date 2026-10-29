import test from "node:test";
import assert from "node:assert/strict";
import {fetchSupabaseSource} from "../src/services/supabaseReadApi.js";

const INTERVENTION_HEADER="INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)";

async function withRma15Row(dataset,typed,check){
  const original=globalThis.fetch;
  const urls=[];
  globalThis.fetch=async(url)=>{
    urls.push(new URL(url));
    return new Response(JSON.stringify([{
      source_dataset:dataset,
      source_row:849,
      fecha_ot:"2026-04-21",
      proyecto:"JOSE MARIA",
      equipo:"Taller Delta",
      interno:"",
      tipo_mantenimiento:"Correctivo",
      turno:typed.turno,
      intervencion:typed.intervencion,
      raw_data:{
        "Fecha de OT":"2026-04-21",
        "TURNO EN QUE SE HIZO LA OT":"DIA",
        [INTERVENTION_HEADER]:"Reparación de cadenas en taller",
      },
      equipo_operativo:true,
      insumos:[],
    }]),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    const result=await fetchSupabaseSource(dataset);
    assert.equal(result.data.length,1);
    assert.equal(urls[0].pathname,"/rest/v1/rma15_frontend");
    assert.equal(urls[0].searchParams.get("source_dataset"),`eq.${dataset}`);
    check(result.data[0]);
  } finally {globalThis.fetch=original;}
}

test("RMA15 conserva intervención y turno histórico al faltar columnas tipadas",async()=>{
  await withRma15Row("rma15_jm",{turno:"",intervencion:""},row=>{
    assert.equal(row[INTERVENTION_HEADER],"Reparación de cadenas en taller");
    assert.equal(row["TURNO EN QUE SE HIZO LA OT"],"DIA");
    assert.equal(row._sourceRow,849);
    assert.equal(row.Interno,"");
  });
});

test("RMA15 prioriza campos tipados cuando contienen información",async()=>{
  await withRma15Row("rma15_fs",{turno:"NOCHE",intervencion:"Reparación tipada"},row=>{
    assert.equal(row[INTERVENTION_HEADER],"Reparación tipada");
    assert.equal(row["TURNO EN QUE SE HIZO LA OT"],"NOCHE");
  });
});
