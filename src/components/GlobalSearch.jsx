import React,{useEffect,useMemo,useRef,useState} from "react";
import {C,Icon} from "./ui/index.jsx";

const norm=v=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const codeLike=v=>/^[A-Z]{2,6}[- ]?\d{3,6}(?:[- ][A-Z0-9]+)?$/i.test(String(v||"").trim());
const pick=(row,names)=>{for(const n of names){const nk=norm(n);for(const [k,v] of Object.entries(row||{}))if(norm(k)===nk&&v!=null&&v!=="")return v;}return"";};
const STATIC=[
  ["Dashboard gerencial","dashboard","dashboard","Resumen gerencial y KPIs"],["Ficha única del equipo","equipmentProfile","truck","Legajo digital de cada equipo"],["ROP02 Equipos","rop02","truck","Partes diarios y estados"],["ROP05 Productividad","rop05","barChart","Producción y rendimientos"],["Mantenimiento programado","pmDashboard","maintenance","PM y alertas"],["Informe de Costos","costosMant","money","Costos de mantenimiento"],["Solicitudes Abastecimiento","abastecimiento","box","RABA03 y solicitudes"],["Pendientes Abastecimiento","abastecimientoPendientes","hours","Solicitudes pendientes"],["Remitos","abastecimientoRemito","fileBarChart","Remitos y entregas"],["Control de stock","abastecimientoStock","parts","Stock y artículos"],["Lista Maestra de Equipos","listaEquipos","list","Catálogo de equipos"]
];

export default function GlobalSearch({listaEquipos=[],rawSources={},onNavigate}){
  const [open,setOpen]=useState(false),[q,setQ]=useState("");
  const inputRef=useRef(null);
  useEffect(()=>{const h=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(true);}if(e.key==="Escape")setOpen(false);};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[]);
  useEffect(()=>{if(open)setTimeout(()=>inputRef.current?.focus(),20);else setQ("");},[open]);
  const index=useMemo(()=>{
    const out=STATIC.map(([title,view,icon,sub])=>({kind:"view",title,sub,view,icon,search:norm(`${title} ${sub}`)}));
    const seen=new Set();
    for(const row of listaEquipos||[]){
      const vals=Object.values(row||{}).map(v=>String(v??"").trim()).filter(Boolean);
      const codes=vals.filter(codeLike).slice(0,4);
      for(const c of codes){const k=norm(c);if(seen.has(k))continue;seen.add(k);const marca=pick(row,["Marca"]),modelo=pick(row,["Modelo"]),familia=pick(row,["Familia","Tipo"]);out.push({kind:"equipment",title:c,sub:[marca,modelo,familia].filter(Boolean).join(" · ")||"Equipo",code:c,icon:"truck",search:norm(`${c} ${marca} ${modelo} ${familia}`)});}
    }
    const sourceView=key=>{const k=String(key).toLowerCase();if(k.includes("raba"))return"abastecimiento";if(k.includes("remito"))return"abastecimientoRemito";if(k.includes("rop05"))return"rop05";if(k.includes("rma15"))return"mant";if(k.includes("rop02"))return"rop02";return null;};
    for(const [key,source] of Object.entries(rawSources||{})){
      const view=sourceView(key);if(!view)continue;
      const rows=Array.isArray(source?.data)?source.data:[];
      for(const row of rows.slice(0,1200)){
        const solicitud=pick(row,["N° de solicitud","Nº de solicitud","Numero de solicitud","Solicitud","N_SOLICITUD"]);
        const remito=pick(row,["Remito","N° Remito","Nº Remito","Numero Remito"]);
        const eq=pick(row,["Interno","Codigo Int","Código Interno del Equipo","Maquina"]);
        const persona=pick(row,["Solicitante","Pedido por","Operador","Supervisor"]);
        const desc=pick(row,["Descripción","Descripcion","Artículo","Articulo","Tarea"]);
        const primary=solicitud?`Solicitud ${solicitud}`:remito?`Remito ${remito}`:eq&&codeLike(eq)?String(eq):"";
        if(!primary)continue;
        const sk=`${key}|${primary}|${persona}|${desc}`;if(seen.has(sk))continue;seen.add(sk);
        out.push({kind:eq&&codeLike(eq)?"equipment":"record",title:primary,sub:[desc,persona,key].filter(Boolean).join(" · ").slice(0,140),code:eq&&codeLike(eq)?String(eq):null,view,icon:eq&&codeLike(eq)?"truck":"search",search:norm(`${primary} ${desc} ${persona} ${key}`)});
      }
    }
    return out;
  },[listaEquipos,rawSources]);
  const results=useMemo(()=>{const nq=norm(q);if(!nq)return index.slice(0,12);const terms=nq.split(" ").filter(Boolean);return index.map(x=>({x,score:terms.reduce((s,t)=>s+(x.search.startsWith(t)?8:x.search.includes(t)?3:0),0)})).filter(y=>y.score>0).sort((a,b)=>b.score-a.score).slice(0,18).map(y=>y.x);},[index,q]);
  const activate=item=>{setOpen(false);if(item.code){window.dispatchEvent(new CustomEvent("dm-open-equipment-profile",{detail:{code:item.code}}));return;}onNavigate?.(item.view);};
  return <>
    {open&&<div onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}} style={{position:"fixed",inset:0,zIndex:2147483000,background:"rgba(0,0,0,.58)",backdropFilter:"blur(5px)",display:"flex",justifyContent:"center",alignItems:"flex-start",paddingTop:"12vh"}}><div style={{width:"min(720px,calc(100vw - 28px))",background:"rgba(22,27,32,.98)",border:"1px solid rgba(255,255,255,.16)",borderRadius:15,boxShadow:"0 28px 80px rgba(0,0,0,.55)",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 15px",borderBottom:"1px solid rgba(255,255,255,.10)"}}><Icon name="search" size={18} color={C.blue}/><input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Escribí EXC-0034, solicitud 284, remito, módulo…" style={{flex:1,border:0,outline:0,background:"transparent",color:C.text,fontSize:14,fontWeight:700}}/><span style={{fontSize:9,color:C.textMuted}}>ESC</span></div>
      <div style={{maxHeight:"58vh",overflowY:"auto",padding:7}}>{results.map((item,i)=><button key={`${item.kind}-${item.title}-${i}`} onClick={()=>activate(item)} style={{width:"100%",border:0,borderRadius:9,background:"transparent",padding:"10px 11px",display:"grid",gridTemplateColumns:"34px 1fr auto",alignItems:"center",gap:10,color:C.text,textAlign:"left",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}><span style={{width:30,height:30,borderRadius:8,display:"grid",placeItems:"center",background:"rgba(59,130,246,.12)"}}><Icon name={item.icon||"search"} size={15} color={item.code?C.green:C.blue}/></span><span><strong style={{display:"block",fontSize:11.5}}>{item.title}</strong><span style={{display:"block",fontSize:9.5,color:C.textMuted,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.sub}</span></span><span style={{fontSize:9,color:C.textMuted}}>{item.code?"Ficha":"Abrir"} ›</span></button>)}{!results.length&&<div style={{padding:26,textAlign:"center",color:C.textMuted,fontSize:11}}>No encontré coincidencias en los datos cargados.</div>}</div>
      <div style={{padding:"8px 13px",borderTop:"1px solid rgba(255,255,255,.08)",fontSize:9,color:C.textMuted}}>Busca sobre los datasets ya cargados en la sesión; no dispara consultas pesadas mientras escribís.</div>
    </div></div>}
  </>;
}
