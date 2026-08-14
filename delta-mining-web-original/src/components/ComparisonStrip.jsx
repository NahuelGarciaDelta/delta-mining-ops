import React from "react";
import { C, Card } from "./ui/index.jsx";

function fmtDelta(value){
  if(value===null||value===undefined||!Number.isFinite(Number(value)))return "—";
  const n=Number(value);return `${n>0?"+":""}${n.toLocaleString("es-AR",{maximumFractionDigits:1})}%`;
}
export default function ComparisonStrip({title="Comparación de períodos",currentLabel="Actual",previousLabel="Anterior",metrics=[]}){
  return <Card title={title} tooltip="Compara el período filtrado con el período inmediatamente anterior de igual duración.">
    <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(1,metrics.length)},minmax(150px,1fr))`,gap:8,padding:10}}>
      {metrics.map(m=>{
        const cur=Number(m.current||0),prev=Number(m.previous||0);
        const delta=prev===0?(cur===0?0:null):((cur-prev)/Math.abs(prev))*100;
        const good=m.lowerIsBetter?delta<=0:delta>=0;
        return <div key={m.label} style={{padding:"10px 11px",borderRadius:9,border:`1px solid ${C.border}`,background:"rgba(255,255,255,.025)"}}>
          <div style={{fontSize:10,color:C.textMuted,fontWeight:800,textTransform:"uppercase"}}>{m.label}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:7,marginTop:5}}><strong style={{fontSize:18,color:C.text}}>{m.format?m.format(cur):cur.toLocaleString("es-AR",{maximumFractionDigits:1})}</strong><span style={{fontSize:10,color:C.textMuted}}>{currentLabel}</span></div>
          <div style={{fontSize:10,color:C.textSub,marginTop:3}}>{previousLabel}: <b>{m.format?m.format(prev):prev.toLocaleString("es-AR",{maximumFractionDigits:1})}</b> · <span style={{color:delta===null?C.textMuted:(good?C.green:C.red),fontWeight:800}}>{fmtDelta(delta)}</span></div>
        </div>;
      })}
    </div>
  </Card>;
}
