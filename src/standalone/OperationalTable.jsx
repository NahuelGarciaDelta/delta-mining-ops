import React,{useMemo,useState} from "react";
const FIELDS={
 rop02_jm:["Fecha","Fecha del Parte Diario","Interno","Equipo","Operador","Turno","HOROMETRO INICIAL","HOROMETRO FINAL","HS TRABAJADAS","ESTADO"],
 rop02_fs:["Fecha","Fecha del Parte Diario","Interno","Equipo","Operador","Turno","HOROMETRO INICIAL","HOROMETRO FINAL","HS TRABAJADAS","ESTADO"],
 rop05:["fecha","Fecha del Parte Diario","interno","Codigo Int","numero_parte","N° de Parte","tarea","Tarea","horas_productivas","cantidad_produccion","unidad"],
 rma15_jm:["Fecha","Interno","Equipo","Tipo Mantenimiento","Intervención","Operativo"],
 rma15_fs:["Fecha","Interno","Equipo","Tipo Mantenimiento","Intervención","Operativo"],
 lista_equipos:["Codigo","Código","Tipo","Familia","Marca","Modelo","Proyecto","Propiedad"],
 insumos:["Fecha","Código","Equipo","Insumo","Cantidad","Unidad"]
};
const EMPTY="—";
function asText(value){
 if(value===undefined||value===null||value==="")return EMPTY;
 if(typeof value==="object")return JSON.stringify(value);
 return String(value);
}
function formulaSafe(v){
 const x=String(v??"");
 return /^[\s]*[=+@-]/.test(x)?"'"+x:x;
}
function csvValue(v){
 return '"'+formulaSafe(asText(v)).replace(/"/g,'""')+'"';
}
export function deriveColumns(rows,dataset){
 const keys=[...new Set(rows.flatMap(row=>Object.keys(row.payload||{})))];
 const priorities=FIELDS[dataset]||[];
 const first=priorities.filter(k=>keys.includes(k));
 return [...first,...keys.filter(k=>!first.includes(k))].slice(0,11);
}
export default function OperationalTable({rows=[],dataset="",total=0,offset=0,limit=100,busy=false,onPage,onRefresh}){
 const [q,setQ]=useState("");
 const columns=useMemo(()=>deriveColumns(rows,dataset),[rows,dataset]);
 const filtered=useMemo(()=>rows.filter(x=>{
  const find=q.trim().toLocaleLowerCase("es");
  return !find||[x.record_id,...Object.values(x.payload||{})].some(v=>asText(v).toLocaleLowerCase("es").includes(find));
 }),[rows,q]);
 const download=()=>{
  const cols=["ID",...columns,"Actualizado"];
  const body=filtered.map(row=>[row.record_id,...columns.map(k=>row.payload?.[k]),row.updated_at]);
  const csv="\uFEFF"+[cols,...body].map(line=>line.map(csvValue).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="delta-v9-"+dataset+".csv";
  a.click();URL.revokeObjectURL(url);
 };
 return <div>
  <div className="row" style={{justifyContent:"space-between",marginBottom:15}}>
   <div className="row"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar en la página" aria-label="Buscar registros"
     style={{background:"#162733",color:"white",border:"1px solid #4b6374",borderRadius:8,padding:"10px 12px"}}/>
    <span className="muted">{total.toLocaleString("es-AR")} registros · {filtered.length} visibles</span></div>
   <div className="row"><button className="btn ghost" disabled={busy} onClick={onRefresh}>Actualizar</button>
    <button className="btn ghost" disabled={!filtered.length} onClick={download}>Exportar CSV</button></div>
  </div>
  <div className="tablewrap"><table className="table">
    <thead><tr><th>ID estable</th>{columns.map(k=><th key={k}>{k.replace(/_/g," ")}</th>)}<th>Actualizado</th></tr></thead>
    <tbody>{filtered.map(row=><tr key={row.record_id}>
     <td className="mono">{row.record_id}</td>{columns.map(k=><td key={k}>{asText(row.payload?.[k])}</td>)}
     <td>{asText(row.updated_at)}</td>
    </tr>)}</tbody>
  </table></div>
  {!filtered.length&&<p className="notice">{rows.length?"No hay coincidencias en esta página.":"Todavía no hay registros sincronizados para esta fuente V9."}</p>}
  <div className="row" style={{justifyContent:"space-between",marginTop:17}}>
    <span className="muted">Mostrando {total?offset+1:0}–{Math.min(offset+rows.length,total)} de {total.toLocaleString("es-AR")}</span>
    <div className="row"><button className="btn ghost" disabled={busy||offset===0} onClick={()=>onPage(Math.max(0,offset-limit))}>Anterior</button>
    <button className="btn ghost" disabled={busy||offset+rows.length>=total} onClick={()=>onPage(offset+limit)}>Siguiente</button></div>
  </div>
 </div>;
}
