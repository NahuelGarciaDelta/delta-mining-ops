import React,{useEffect} from "react";
import ExecutiveDashboard from "./ExecutiveDashboard.jsx";

// El Dashboard usa exactamente los datasets ya hidratados por App.jsx.
// ROP02/RMA15/ROP05 se leen desde Supabase; nunca se bloquea la pantalla
// esperando un snapshot monolítico de Apps Script.
export default function ExecutiveDashboardHistorical(props){
  useEffect(()=>{
    if(typeof window==="undefined")return;
    window.__dmDashboardSnapshotDiagnostics={
      source:"app-supabase-hydrated",
      rop02:Array.isArray(props.rop02All)?props.rop02All.length:0,
      rma15:Array.isArray(props.rma15)?props.rma15.length:0,
      updatedAt:new Date().toISOString(),
    };
  },[props.rop02All,props.rma15]);

  return <ExecutiveDashboard {...props}/>;
}
