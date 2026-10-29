import test from "node:test";
import assert from "node:assert/strict";
import {fetchSupabaseSource} from "../src/services/supabaseReadApi.js";

const RAW_OBSERVATION_HEADER = [
  "OBSERVACION DE LA TAREA SEGUN LA SELECCIONADA",
  "-Tipo de suelo (duro,blando)",
  "-Dimensiones",
  "-Nombre de lugar de trabajo",
  "-Etc."
].join("\n");

async function withMockRow(typedObservation, verify) {
  const oldFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{
    calls.push(new URL(url));
    return new Response(JSON.stringify([{
      source_dataset:"rop05",source_row:3165,fecha:"2026-05-13",
      supervisor:"Sisterna Carlos",interno:"PCA-0081",numero_parte:"300",
      cantidad_produccion:2,unidad:"KILÓMETROS LINEALES",
      observaciones:typedObservation,
      raw_data:{[RAW_OBSERVATION_HEADER]:"Se realiza limpieza de camino sur por 2 km"}
    }]),{status:200,headers:{"content-type":"application/json"}});
  };
  try {
    const out=await fetchSupabaseSource("rop05");
    assert.equal(out.data.length,1);
    assert.equal(calls[0].pathname,"/rest/v1/rop05");
    verify(out.data[0]);
  } finally {globalThis.fetch=oldFetch;}
}

test("ROP05 conserva observaciones historicas en raw_data si el campo tipado esta vacio",async()=>{
  await withMockRow("",row=>{
    assert.equal(row.Observaciones,"Se realiza limpieza de camino sur por 2 km");
    assert.equal(row._sourceRow,3165);
    assert.equal(row[RAW_OBSERVATION_HEADER],"Se realiza limpieza de camino sur por 2 km");
  });
});

test("ROP05 prioriza observaciones tipadas no vacias",async()=>{
  await withMockRow("Texto tipado actualizado",row=>{
    assert.equal(row.Observaciones,"Texto tipado actualizado");
    assert.equal(row[RAW_OBSERVATION_HEADER],"Se realiza limpieza de camino sur por 2 km");
  });
});
