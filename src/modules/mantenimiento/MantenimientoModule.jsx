import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import MantenimientoProgramadoView from "./MantenimientoProgramadoView.jsx";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine, LineChart, Line } from "recharts";

// Dependencias compartidas inyectadas desde App mientras se completa la modularización.
let __deps = {};

function ViewDistribucionMantenimientos({rma15}){
  const { C, Card, Badge, MultiSel, Sel, DateIn, PeriodMonthYear, TabBtn, StatCard, SortableTH, BtnExcel, Icon, fmtNum, fmtUSD, fmtFecha, normDate, uniq, matchMulti, multiIsAll, tipoMatchMachineROP05, normalizeInsumoCode, positionTip, sortRowsForTable, appAlert, appConfirm, proyColor, getValue, generarExcelMantenimiento, ROP05_TIPOS_MAQUINA, CodeMultiSearch } = __deps;
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const hoy=new Date();
  const [anio,setAnio]=useState(String(hoy.getFullYear()));
  const [mesIdx,setMesIdx]=useState(hoy.getMonth());
  const [maquina,setMaquina]=useState("todas");
  const [tipoMant,setTipoMant]=useState("todos");
  const [proyecto,setProyecto]=useState("todos");
  const [subVista,setSubVista]=useState("calendario");

  const normTipoLocal=v=>{
    const t=String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
    if(t.includes("PREV"))return "Preventivo";
    if(t.includes("CORR"))return "Correctivo";
    return String(v||"").trim()||"Sin tipo";
  };
  const fechaISO=(y,m,d)=>`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const fmtFechaLocal=iso=>{
    const f=normDate(iso);
    if(!f)return "—";
    const [y,m,d]=f.split("-");
    return `${d}/${m}/${y}`;
  };
  const periodo=useMemo(()=>{
    const y=Number(anio)||hoy.getFullYear();
    const m=Number(mesIdx)||0;
    const last=new Date(y,m+1,0).getDate();
    return{desde:fechaISO(y,m,1),hasta:fechaISO(y,m,last),ultimo:last,label:`${MESES[m]} ${y}`};
  },[anio,mesIdx]);

  const anios=useMemo(()=>{
    const ys=new Set(["2026","2027","2028"]);
    (rma15||[]).forEach(r=>{const f=normDate(r?.fecha);if(f)ys.add(f.slice(0,4));});
    return [...ys].sort();
  },[rma15]);

  const baseMes=useMemo(()=>(rma15||[]).filter(r=>{
    const f=normDate(r?.fecha);
    return f&&f>=periodo.desde&&f<=periodo.hasta;
  }).map(r=>({...r,fecha:normDate(r.fecha),_tipo:normTipoLocal(r.tipoMant)})),[rma15,periodo]);

  const proyectos=useMemo(()=>uniq(baseMes.map(r=>r.proyecto||r.lugar).filter(Boolean)).sort((a,b)=>String(a).localeCompare(String(b),"es-AR",{numeric:true,sensitivity:"base"})),[baseMes]);
  const baseProyecto=useMemo(()=>baseMes.filter(r=>matchMulti(r.proyecto||r.lugar,proyecto,"todos")),[baseMes,proyecto]);
  const tipos=useMemo(()=>uniq(baseProyecto.map(r=>r._tipo).filter(Boolean)).sort(),[baseProyecto]);
  const maquinas=useMemo(()=>uniq(baseProyecto.filter(r=>matchMulti(r._tipo,tipoMant,"todos")).map(r=>r.maquina).filter(Boolean)).sort((a,b)=>String(a).localeCompare(String(b),"es-AR",{numeric:true,sensitivity:"base"})),[baseProyecto,tipoMant]);

  const filtered=useMemo(()=>baseProyecto.filter(r=>{
    if(!matchMulti(r._tipo,tipoMant,"todos"))return false;
    if(!matchMulti(r.maquina,maquina,"todas"))return false;
    return true;
  }),[baseProyecto,tipoMant,maquina]);

  const byDay=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{
      const k=r.fecha;
      if(!m[k])m[k]=[];
      m[k].push(r);
    });
    Object.values(m).forEach(arr=>arr.sort((a,b)=>String(a.maquina||"").localeCompare(String(b.maquina||""),"es-AR",{numeric:true,sensitivity:"base"})));
    return m;
  },[filtered]);

  const y=Number(anio)||hoy.getFullYear();
  const m=Number(mesIdx)||0;
  const firstOffset=(new Date(y,m,1).getDay()+6)%7; // lunes=0
  const cells=[];
  for(let i=0;i<firstOffset;i++)cells.push(null);
  for(let d=1;d<=periodo.ultimo;d++)cells.push(fechaISO(y,m,d));

  const preventivos=filtered.filter(r=>r._tipo==="Preventivo").length;
  const correctivos=filtered.filter(r=>r._tipo==="Correctivo").length;
  const equiposAfectados=uniq(filtered.map(r=>r.maquina).filter(Boolean)).length;

  const alertaPostPreventivo=useMemo(()=>{
    const porEquipo={};
    baseProyecto.filter(r=>matchMulti(r.maquina,maquina,"todas")).forEach(r=>{
      const eq=String(r.maquina||"").trim();
      if(!eq)return;
      if(!porEquipo[eq])porEquipo[eq]=[];
      porEquipo[eq].push(r);
    });
    const alertas=[];
    Object.entries(porEquipo).forEach(([eq,items])=>{
      const orden=items.slice().sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
      orden.forEach((r,idx)=>{
        if(r._tipo!=="Preventivo")return;
        const baseDate=new Date(`${r.fecha}T00:00:00`);
        const nextCorr=orden.slice(idx+1).find(x=>x._tipo==="Correctivo");
        if(!nextCorr)return;
        const dias=Math.round((new Date(`${nextCorr.fecha}T00:00:00`)-baseDate)/(24*60*60*1000));
        if(dias>=0&&dias<=7){
          alertas.push({equipo:eq,preventivo:r.fecha,correctivo:nextCorr.fecha,dias,proyecto:nextCorr.proyecto||r.proyecto||"—",intervencion:nextCorr.intervencion||nextCorr.reparacion||"—"});
        }
      });
    });
    return alertas.sort((a,b)=>a.dias-b.dias||String(a.equipo).localeCompare(String(b.equipo),"es-AR",{numeric:true,sensitivity:"base"}));
  },[baseProyecto,maquina]);

  const preventivosConCorrectivo=alertaPostPreventivo.length;
  const kpiRiesgo=preventivos>0?Math.round((preventivosConCorrectivo/preventivos)*100):0;
  const diasProm=alertaPostPreventivo.length?alertaPostPreventivo.reduce((s,x)=>s+x.dias,0)/alertaPostPreventivo.length:0;

  const dashboardMant=useMemo(()=>{
    const porEquipo={};
    filtered.forEach(r=>{
      const eq=String(r.maquina||"—").trim()||"—";
      if(!porEquipo[eq])porEquipo[eq]={equipo:eq,preventivos:0,correctivos:0,total:0,fechas:[]};
      porEquipo[eq].total+=1;
      if(r._tipo==="Preventivo")porEquipo[eq].preventivos+=1;
      if(r._tipo==="Correctivo")porEquipo[eq].correctivos+=1;
      if(r.fecha)porEquipo[eq].fechas.push(r.fecha);
    });
    const equipos=Object.values(porEquipo).map(x=>({
      ...x,
      ratioCP:x.preventivos>0?x.correctivos/x.preventivos:(x.correctivos>0?null:0),
    })).sort((a,b)=>(b.total-a.total)||String(a.equipo).localeCompare(String(b.equipo),"es-AR",{numeric:true,sensitivity:"base"}));

    const equiposReincidentes=equipos.filter(x=>x.correctivos>=2).sort((a,b)=>b.correctivos-a.correctivos||b.total-a.total);

    const intervalos=[];
    equipos.forEach(eq=>{
      const fechas=uniq(eq.fechas).sort();
      for(let i=1;i<fechas.length;i++){
        const d=Math.round((new Date(`${fechas[i]}T00:00:00`)-new Date(`${fechas[i-1]}T00:00:00`))/(24*60*60*1000));
        if(Number.isFinite(d)&&d>=0)intervalos.push(d);
      }
    });
    const diasPromEntre=intervalos.length?intervalos.reduce((a,b)=>a+b,0)/intervalos.length:0;
    const ratioGeneral=preventivos>0?correctivos/preventivos:(correctivos>0?null:0);
    const participacionPrev=filtered.length?Math.round((preventivos/filtered.length)*100):0;
    const participacionCorr=filtered.length?Math.round((correctivos/filtered.length)*100):0;
    return{
      equipos,
      equiposReincidentes,
      diasPromEntre,
      ratioGeneral,
      participacionPrev,
      participacionCorr,
      topEquipos:equipos.slice(0,10),
      tipoData:[
        {name:"Preventivo",value:preventivos},
        {name:"Correctivo",value:correctivos},
      ].filter(x=>x.value>0),
    };
  },[filtered,preventivos,correctivos]);

  const ratioLabel=dashboardMant.ratioGeneral===null?"Sin preventivos":dashboardMant.ratioGeneral.toFixed(2);
  const ratioInterpretacion=dashboardMant.ratioGeneral===null
    ?"Hay correctivos registrados sin preventivos en el período filtrado."
    :dashboardMant.ratioGeneral<=0.35
      ?"Buen comportamiento: predominan los preventivos sobre los correctivos."
      :dashboardMant.ratioGeneral<=0.75
        ?"Nivel medio: conviene revisar equipos con correctivos repetidos."
        :"Alerta: hay demasiados correctivos respecto de los preventivos.";

  const generarInformeMantenimientosPDF=useCallback(()=>{
    if(!filtered.length){
      appAlert("No hay mantenimientos para generar el informe con los filtros seleccionados.");
      return;
    }
    const escapeHtml=v=>String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
    const fmtDec=(v,d=1)=>Number.isFinite(Number(v))?Number(v).toLocaleString("es-AR",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
    const proyectosInforme=uniq(filtered.map(r=>String(r.proyecto||r.lugar||"SIN PROYECTO").trim()||"SIN PROYECTO"))
      .sort((a,b)=>String(a).localeCompare(String(b),"es-AR",{numeric:true,sensitivity:"base"}));
    const yPrint=Number(anio)||hoy.getFullYear();
    const mPrint=Number(mesIdx)||0;
    const firstOffsetPrint=(new Date(yPrint,mPrint,1).getDay()+6)%7;
    const diasMes=new Date(yPrint,mPrint+1,0).getDate();
    const celdasMes=[];
    for(let i=0;i<firstOffsetPrint;i++)celdasMes.push(null);
    for(let d=1;d<=diasMes;d++)celdasMes.push(fechaISO(yPrint,mPrint,d));
    while(celdasMes.length%7)celdasMes.push(null);

    const secciones=proyectosInforme.map((nombreProyecto,idxProyecto)=>{
      const rows=filtered.filter(r=>(String(r.proyecto||r.lugar||"SIN PROYECTO").trim()||"SIN PROYECTO")===nombreProyecto);
      const prev=rows.filter(r=>r._tipo==="Preventivo").length;
      const corr=rows.filter(r=>r._tipo==="Correctivo").length;
      const total=rows.length;
      const equiposMap={};
      rows.forEach(r=>{
        const eq=String(r.maquina||"—").trim()||"—";
        if(!equiposMap[eq])equiposMap[eq]={equipo:eq,preventivos:0,correctivos:0,total:0,fechas:[]};
        equiposMap[eq].total++;
        if(r._tipo==="Preventivo")equiposMap[eq].preventivos++;
        if(r._tipo==="Correctivo")equiposMap[eq].correctivos++;
        if(r.fecha)equiposMap[eq].fechas.push(r.fecha);
      });
      const equipos=Object.values(equiposMap).map(x=>({...x,ratio:x.preventivos>0?x.correctivos/x.preventivos:(x.correctivos>0?null:0)}))
        .sort((a,b)=>b.total-a.total||String(a.equipo).localeCompare(String(b.equipo),"es-AR",{numeric:true,sensitivity:"base"}));
      const reincidentes=equipos.filter(x=>x.correctivos>=2).sort((a,b)=>b.correctivos-a.correctivos||b.total-a.total);
      const intervalos=[];
      equipos.forEach(eq=>{const fs=uniq(eq.fechas).sort();for(let i=1;i<fs.length;i++){const d=Math.round((new Date(`${fs[i]}T00:00:00`)-new Date(`${fs[i-1]}T00:00:00`))/86400000);if(Number.isFinite(d)&&d>=0)intervalos.push(d);}});
      const diasEntre=intervalos.length?intervalos.reduce((a,b)=>a+b,0)/intervalos.length:0;
      const ratio=prev>0?corr/prev:(corr>0?null:0);
      const pctPrev=total?Math.round(prev/total*100):0;
      const pctCorr=total?Math.round(corr/total*100):0;
      const equipoMasCorr=[...equipos].sort((a,b)=>b.correctivos-a.correctivos||b.total-a.total)[0];
      const equipoMayorRatio=[...equipos].filter(x=>x.ratio!==null).sort((a,b)=>(b.ratio||0)-(a.ratio||0)||b.total-a.total)[0];
      const porDia={}; rows.forEach(r=>{if(!porDia[r.fecha])porDia[r.fecha]=[];porDia[r.fecha].push(r);});
      const topRows=equipos.slice(0,15).map(x=>`<tr><td>${escapeHtml(x.equipo)}</td><td class="num prev">${x.preventivos}</td><td class="num corr">${x.correctivos}</td><td class="num strong">${x.total}</td><td class="num ${x.ratio===null||x.ratio>0.75?'bad':(x.ratio>0.35?'warn':'good')}">${x.ratio===null?'Sin prev.':x.ratio.toFixed(2)}</td></tr>`).join("");
      const reincRows=reincidentes.length?reincidentes.slice(0,25).map(x=>`<tr><td>${escapeHtml(x.equipo)}</td><td class="num corr strong">${x.correctivos}</td><td class="num prev">${x.preventivos}</td><td class="num">${x.total}</td><td>Correctivos repetidos: revisar causa raíz, calidad de reparación y stock de repuestos críticos.</td></tr>`).join(""):`<tr><td colspan="5" class="empty good">No hay equipos con reincidencia correctiva.</td></tr>`;
      const calendario=celdasMes.map(iso=>{
        if(!iso)return `<div class="day blank"></div>`;
        const items=(porDia[iso]||[]).sort((a,b)=>String(a.maquina||"").localeCompare(String(b.maquina||""),"es-AR",{numeric:true,sensitivity:"base"}));
        const p=items.filter(x=>x._tipo==="Preventivo").length;
        const c=items.filter(x=>x._tipo==="Correctivo").length;
        const detalle=items.slice(0,5).map(r=>`<div class="event"><span class="dot ${r._tipo==='Preventivo'?'p':'c'}"></span>${escapeHtml(r.maquina||'—')}</div>`).join("");
        return `<div class="day ${items.length?'active':''}"><div class="day-head"><b>${Number(iso.slice(-2))}</b>${items.length?`<span>${items.length} OT</span>`:''}</div>${(p||c)?`<div class="badges">${p?`<span class="badge p">P ${p}</span>`:''}${c?`<span class="badge c">C ${c}</span>`:''}</div>`:''}<div class="events">${detalle}${items.length>5?`<div class="more">+${items.length-5} más</div>`:''}</div></div>`;
      }).join("");
      const ratioTexto=ratio===null?"Sin preventivos":ratio.toFixed(2);
      const donutStyle=`background:conic-gradient(#20c96b 0 ${pctPrev}%,#ff1538 ${pctPrev}% 100%)`;
      return `<div class="project-report ${idxProyecto?"report-break":""}">
        <section class="report-page portrait-page summary-page">
          <header><div><div class="brand">DELTA MINING</div><h1>INFORME DE DISTRIBUCIÓN DE MANTENIMIENTOS</h1><div class="period">${escapeHtml(periodo.label)} · ${escapeHtml(fmtFechaLocal(periodo.desde))} al ${escapeHtml(fmtFechaLocal(periodo.hasta))}</div></div><div class="project-name">PROYECTO<br><strong>${escapeHtml(nombreProyecto)}</strong></div></header>
          <div class="cover-title"><span>Resumen del período</span><strong>${escapeHtml(nombreProyecto)}</strong></div>
          <div class="kpis">
            <div class="kpi blue"><span>Mantenimientos</span><b>${total}</b></div><div class="kpi green"><span>Preventivos</span><b>${prev}</b><small>${pctPrev}% del total</small></div><div class="kpi red"><span>Correctivos</span><b>${corr}</b><small>${pctCorr}% del total</small></div><div class="kpi amber"><span>Ratio C/P</span><b>${ratioTexto}</b></div><div class="kpi purple"><span>Reincidentes</span><b>${reincidentes.length}</b></div><div class="kpi violet"><span>Días entre mant.</span><b>${diasEntre?fmtDec(diasEntre,1):'—'}</b></div>
          </div>
          <div class="grid2 summary-grid">
            <div class="panel chart-panel"><h2>Distribución preventivo / correctivo</h2><div class="chart-wrap"><div class="donut" style="${donutStyle}"><div><b>${total}</b><span>Total</span></div></div><div class="legend"><div><i class="lg p"></i><b>Preventivos</b><span>${prev} (${pctPrev}%)</span></div><div><i class="lg c"></i><b>Correctivos</b><span>${corr} (${pctCorr}%)</span></div><div class="reading">${ratio===null||ratio>0.75?'Alerta: demasiados correctivos respecto de los preventivos.':ratio>0.35?'Nivel medio: revisar equipos con correctivos repetidos.':'Buen comportamiento: predominan los preventivos.'}</div></div></div></div>
            <div class="panel"><h2>Resumen ejecutivo</h2><div class="summary"><div><span>Equipos intervenidos</span><b>${equipos.length}</b></div><div><span>Equipo con más correctivos</span><b>${escapeHtml(equipoMasCorr?.equipo||'—')}</b><small>${equipoMasCorr?equipoMasCorr.correctivos+' correctivos':''}</small></div><div><span>Mayor ratio C/P</span><b>${escapeHtml(equipoMayorRatio?.equipo||'—')}</b><small>${equipoMayorRatio&&equipoMayorRatio.ratio!==null?equipoMayorRatio.ratio.toFixed(2):'—'}</small></div><div><span>Ratio general C/P</span><b>${ratioTexto}</b></div></div></div>
          </div>
        </section>

        <section class="report-page landscape-page tables-page">
          <div class="page-heading"><div><span>DELTA MINING</span><h2>ANÁLISIS DE EQUIPOS</h2></div><strong>${escapeHtml(nombreProyecto)}</strong></div>
          <div class="panel wide-table"><h2>Top equipos con más mantenimientos</h2><table><thead><tr><th>Equipo</th><th>Preventivos</th><th>Correctivos</th><th>Total</th><th>Ratio C/P</th></tr></thead><tbody>${topRows||'<tr><td colspan="5" class="empty">Sin datos</td></tr>'}</tbody></table></div>
          <div class="panel wide-table reinc-table"><h2>Equipos reincidentes en correctivos</h2><table><thead><tr><th>Equipo</th><th>Correctivos</th><th>Preventivos</th><th>Total</th><th>Lectura</th></tr></thead><tbody>${reincRows}</tbody></table></div>
        </section>

        <section class="report-page landscape-page calendar-page">
          <div class="page-heading"><div><span>DELTA MINING</span><h2>CALENDARIO MENSUAL DE MANTENIMIENTOS</h2></div><strong>${escapeHtml(nombreProyecto)} · ${escapeHtml(periodo.label)}</strong></div>
          <div class="panel calendar-panel"><div class="calendar-head">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<div>${d}</div>`).join('')}</div><div class="calendar">${calendario}</div><div class="calendar-legend"><span><i class="lg p"></i>Preventivo</span><span><i class="lg c"></i>Correctivo</span><span><i class="lg both"></i>Ambos en el día</span></div></div>
        </section>

        <section class="report-page portrait-page methodology-page">
          <div class="page-heading"><div><span>DELTA MINING</span><h2>METODOLOGÍA E INTERPRETACIÓN</h2></div><strong>${escapeHtml(nombreProyecto)}</strong></div>
          <div class="method-grid">
            <article><h3>Total de mantenimientos</h3><p>Cantidad total de intervenciones incluidas en el período y en los filtros aplicados. Es la suma de mantenimientos preventivos y correctivos.</p></article>
            <article><h3>Mantenimientos preventivos</h3><p>Intervenciones planificadas destinadas a conservar la disponibilidad y confiabilidad del equipo, prevenir fallas y cumplir frecuencias de servicio o inspección.</p></article>
            <article><h3>Mantenimientos correctivos</h3><p>Intervenciones ejecutadas para reparar una falla existente y restablecer la condición operativa del equipo.</p></article>
            <article><h3>Ratio C/P</h3><p>Se calcula como <strong>Correctivos ÷ Preventivos</strong>. Un valor menor indica mayor predominio preventivo. Si no existen preventivos, el indicador se muestra como “Sin preventivos”.</p><div class="scale"><span class="s-good">0,00–0,35: favorable</span><span class="s-warn">0,36–0,75: intermedio</span><span class="s-bad">&gt; 0,75: atención</span></div></article>
            <article><h3>Equipos reincidentes</h3><p>Cantidad de equipos con <strong>dos o más mantenimientos correctivos</strong> en el período. Permite priorizar análisis de causa raíz, calidad de reparación y disponibilidad de repuestos.</p></article>
            <article><h3>Días entre mantenimientos</h3><p>Promedio de días calendario entre fechas consecutivas de intervención de cada equipo. Se calculan los intervalos por equipo y luego se obtiene el promedio general.</p></article>
            <article><h3>Top equipos con más mantenimientos</h3><p>Clasificación por cantidad total de intervenciones. Ante igualdad, se utiliza el nombre o código del equipo para mantener un orden estable.</p></article>
            <article><h3>Calendario</h3><p>Distribuye las órdenes por fecha. Verde identifica preventivos, rojo correctivos y la combinación de ambos colores indica que coexistieron ambos tipos en el mismo día.</p></article>
          </div>
          <div class="note"><strong>Alcance:</strong> todos los valores se calculan únicamente con los registros comprendidos por el mes, año, proyecto, equipo y tipo de mantenimiento seleccionados al momento de generar el informe.</div>
        </section>

        <section class="report-page portrait-page conclusion-page">
          <div class="page-heading"><div><span>DELTA MINING</span><h2>CONCLUSIÓN AUTOMÁTICA</h2></div><strong>${escapeHtml(nombreProyecto)}</strong></div>
          <div class="conclusion conclusion-main">
            <h3>Resultado del período</h3>
            <p>Durante el período analizado se registraron <strong>${total} mantenimientos</strong> en el proyecto <strong>${escapeHtml(nombreProyecto)}</strong>, de los cuales <strong>${prev} (${pctPrev}%) fueron preventivos</strong> y <strong>${corr} (${pctCorr}%) correctivos</strong>. El Ratio C/P resultante fue <strong>${ratioTexto}</strong>. ${ratio===null?'No puede calcularse una relación comparable porque no se registraron mantenimientos preventivos.':ratio<=0.35?'El resultado indica un claro predominio del mantenimiento preventivo.':ratio<=0.75?'El resultado corresponde a un nivel intermedio; conviene revisar los equipos con correctivos repetidos.':'El resultado evidencia una proporción elevada de correctivos respecto de los preventivos y requiere revisión prioritaria.'}</p>
          </div>
          <div class="conclusion-stats"><div><span>Equipos intervenidos</span><b>${equipos.length}</b></div><div><span>Equipos reincidentes</span><b>${reincidentes.length}</b></div><div><span>Promedio entre intervenciones</span><b>${diasEntre?fmtDec(diasEntre,1):'—'} días</b></div><div><span>Equipo con más correctivos</span><b>${escapeHtml(equipoMasCorr?.equipo||'—')}</b></div></div>
          <div class="recommendation"><h3>Lectura recomendada</h3><p>${ratio===null?'Se recomienda revisar la ausencia de registros preventivos y validar que la planificación se encuentre cargada correctamente.':ratio<=0.35?'Mantener la estrategia preventiva actual y continuar monitoreando los equipos reincidentes.':ratio<=0.75?'Priorizar el análisis de los equipos con correctivos repetidos y verificar frecuencias preventivas, calidad de reparación y disponibilidad de repuestos.':'Implementar un plan de acción prioritario sobre las fallas recurrentes, reforzar el mantenimiento preventivo y realizar análisis de causa raíz en los equipos críticos.'}</p></div>
        </section>
      </div>`;
    }).join("");
    const generado=new Date().toLocaleString("es-AR");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Informe de mantenimientos</title><style>
      @page portrait{size:A4 portrait;margin:10mm}
      @page landscape{size:A4 landscape;margin:8mm}
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#15171b;margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.project-report{margin:0;padding:0}.report-break{break-before:page;page-break-before:always}.report-page{position:relative;break-after:page;page-break-after:always;overflow:hidden}.report-page:last-child{break-after:auto;page-break-after:auto}.portrait-page{page:portrait;min-height:277mm}.landscape-page{page:landscape;min-height:194mm}.summary-page{padding:0 1mm}.page-heading{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #ed0b2f;padding-bottom:6px;margin-bottom:8px}.page-heading span{font-size:9px;color:#ed0b2f;font-weight:900;letter-spacing:.12em}.page-heading h2{font-size:15px;margin:2px 0 0}.page-heading>strong{font-size:13px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #ed0b2f;padding:0 0 7px;margin-bottom:8px}.brand{font-weight:900;color:#ed0b2f;letter-spacing:.12em;font-size:11px}h1{font-size:16px;margin:3px 0}.period{font-size:9px;color:#68707d}.project-name{text-align:right;font-size:8px;color:#68707d;line-height:1.4}.project-name strong{font-size:14px;color:#15171b}.cover-title{padding:8px 10px;background:#f2f4f7;border-left:5px solid #ed0b2f;border-radius:6px;margin-bottom:8px}.cover-title span{display:block;font-size:8px;color:#68707d;text-transform:uppercase;font-weight:800}.cover-title strong{font-size:14px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}.kpi{border:1px solid #d9dde4;border-top:4px solid currentColor;border-radius:7px;padding:7px 9px;min-height:61px;background:#fff}.kpi span{display:block;font-size:8px;color:#68707d;text-transform:uppercase;font-weight:800}.kpi b{display:block;font-size:19px;line-height:1.1;margin-top:3px}.kpi small{font-size:7px;color:#68707d}.blue{color:#246bce}.green,.prev,.good{color:#159a55}.red,.corr,.bad{color:#df1534}.amber,.warn{color:#d58b00}.purple{color:#844dcc}.violet{color:#9c47cf}.grid2{display:grid;grid-template-columns:1fr;gap:8px}.summary-grid{margin-top:8px}.panel{border:1px solid #d9dde4;border-radius:7px;margin-bottom:8px;overflow:hidden;break-inside:avoid;background:#fff}.panel h2{font-size:10px;margin:0;padding:7px 9px;background:#20242b;color:#fff;text-transform:uppercase;letter-spacing:.04em}.chart-wrap{display:flex;align-items:center;justify-content:center;gap:28px;padding:13px}.donut{width:138px;height:138px;border-radius:50%;display:grid;place-items:center;position:relative}.donut:after{content:'';position:absolute;width:78px;height:78px;border-radius:50%;background:#fff}.donut div{position:relative;z-index:1;text-align:center}.donut b{font-size:23px;display:block}.donut span{font-size:8px;color:#68707d}.legend{min-width:185px}.legend>div{display:grid;grid-template-columns:11px 1fr auto;gap:5px;align-items:center;margin:7px 0;font-size:9px}.legend .reading{display:block;background:#f3f5f8;border-radius:6px;padding:8px;line-height:1.4;margin-top:10px}.lg{width:8px;height:8px;border-radius:50%;display:inline-block}.lg.p,.dot.p{background:#20c96b}.lg.c,.dot.c{background:#ff1538}.lg.both{background:linear-gradient(90deg,#20c96b 50%,#ff1538 50%)}.summary{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px}.summary div{border:1px solid #e1e4e9;border-radius:6px;padding:9px}.summary span{font-size:7px;color:#68707d;text-transform:uppercase;font-weight:800;display:block}.summary b{font-size:12px;display:block;margin-top:3px}.summary small{font-size:7px;color:#68707d}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #dfe2e7;overflow-wrap:anywhere}th{background:#f0f2f5;text-align:left;text-transform:uppercase}.num{text-align:center}.strong{font-weight:900}.empty{text-align:center}.tables-page{padding:0}.tables-page .wide-table{margin-bottom:8px}.tables-page table{font-size:9px}.tables-page th{font-size:8px;padding:5px 7px}.tables-page td{padding:5px 7px;line-height:1.25}.tables-page .wide-table:first-of-type table th:first-child,.tables-page .wide-table:first-of-type table td:first-child{width:44%}.tables-page .reinc-table table th:first-child,.tables-page .reinc-table table td:first-child{width:18%}.tables-page .reinc-table table th:last-child,.tables-page .reinc-table table td:last-child{width:54%}.calendar-page{padding:0}.calendar-panel{height:177mm;margin:0;display:flex;flex-direction:column}.calendar-head,.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;padding:0 4px}.calendar-head{padding-top:7px}.calendar-head div{background:#20242b;color:#fff;text-align:center;padding:5px 2px;font-size:9px;font-weight:900}.calendar{flex:1;grid-auto-rows:1fr;padding-bottom:3px}.day{border:1px solid #dfe2e7;min-height:0;padding:5px;background:#fafbfc;overflow:hidden}.day.active{background:#f2f4f7}.day.blank{border:none;background:transparent}.day-head{display:flex;justify-content:space-between;font-size:9px}.day-head span{color:#68707d;font-size:7px}.badges{display:flex;gap:3px;margin:3px 0;flex-wrap:wrap}.badge{font-size:7px;padding:2px 4px;border-radius:999px;color:#fff}.badge.p{background:#20c96b}.badge.c{background:#ff1538}.event{font-size:7.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0}.dot{display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:3px}.more{font-size:6.5px;color:#68707d}.calendar-legend{display:flex;gap:18px;padding:6px 8px;font-size:8px;justify-content:flex-end}.calendar-legend span{display:flex;align-items:center;gap:4px}.methodology-page{padding:0 1mm}.method-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding-top:4px}.method-grid article{border:1px solid #dfe2e7;border-radius:7px;padding:10px;background:#fff;break-inside:avoid}.method-grid h3{font-size:9px;margin:0 0 5px;color:#20242b;text-transform:uppercase}.method-grid p,.note{font-size:8px;line-height:1.5;margin:0}.scale{display:flex;gap:4px;flex-wrap:wrap;margin-top:7px}.scale span{font-size:7px;font-weight:800;border-radius:999px;padding:3px 5px}.s-good{color:#087b42;background:#dff7e9}.s-warn{color:#956000;background:#fff2cf}.s-bad{color:#b10e29;background:#ffe0e5}.note{margin-top:9px;padding:9px 10px;border-radius:6px;background:#eef1f5;color:#4d5562}.conclusion-page{padding:0 1mm}.conclusion{border:1px solid #ccd3dd;border-left:5px solid #ed0b2f;border-radius:8px;padding:14px 16px;background:#f7f8fa}.conclusion-main{margin-top:14px}.conclusion h3,.recommendation h3{font-size:11px;margin:0 0 7px;color:#20242b;text-transform:uppercase}.conclusion p,.recommendation p{font-size:10px;line-height:1.65;margin:0}.conclusion-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.conclusion-stats div{border:1px solid #dfe2e7;border-radius:8px;padding:12px;background:#fff}.conclusion-stats span{display:block;font-size:8px;color:#68707d;text-transform:uppercase;font-weight:800}.conclusion-stats b{display:block;font-size:15px;margin-top:5px}.recommendation{margin-top:14px;border:1px solid #f2c36b;border-radius:8px;background:#fff8e9;padding:14px 16px}.footer{position:fixed;bottom:2mm;left:10mm;right:10mm;font-size:6.5px;color:#7b818b;display:flex;justify-content:space-between}
      @media print{.report-page{break-inside:avoid}.landscape-page{page:landscape}.portrait-page{page:portrait}}
    </style></head><body>${secciones}<div class="footer"><span>Delta Mining · Informe de distribución de mantenimientos</span><span>Generado: ${escapeHtml(generado)}</span></div></body></html>`;
    const iframe=document.createElement("iframe");
    iframe.style.position="fixed";iframe.style.right="0";iframe.style.bottom="0";iframe.style.width="0";iframe.style.height="0";iframe.style.border="0";iframe.setAttribute("aria-hidden","true");
    document.body.appendChild(iframe);
    const doc=iframe.contentWindow?.document;
    if(!doc){try{document.body.removeChild(iframe);}catch(_){}appAlert("No se pudo preparar el informe para impresión.");return;}
    doc.open();doc.write(html);doc.close();
    setTimeout(()=>{try{iframe.contentWindow?.focus();iframe.contentWindow?.print();}finally{setTimeout(()=>{try{document.body.removeChild(iframe);}catch(_){}},1500);}},450);
  },[filtered,anio,mesIdx,periodo,hoy]);

  const reset=()=>{setMaquina("todas");setTipoMant("todos");setProyecto("todos");setAnio(String(hoy.getFullYear()));setMesIdx(hoy.getMonth());};
  const badgeTipo=(tipo)=><Badge color={tipo==="Preventivo"?C.green:(tipo==="Correctivo"?C.red:C.blue)}>{tipo}</Badge>;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,width:"100%"}}>
      <Card
        title="Distribución de mantenimientos"
        action={<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><button onClick={generarInformeMantenimientosPDF} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 13px",borderRadius:9,border:`1px solid ${C.red}`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:12,fontWeight:900,fontFamily:"Inter",whiteSpace:"nowrap"}}>📄 PDF</button><button onClick={reset} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 13px",borderRadius:9,border:`1px solid ${C.red}55`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:12,fontWeight:850,fontFamily:"Inter",whiteSpace:"nowrap"}}><Icon name="close" size={12} color={C.red}/>Limpiar filtros</button></div>}
      >
        <div style={{padding:"14px 16px 16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14,flexWrap:"wrap"}}>
            <div style={{fontSize:12,color:C.textMuted,lineHeight:1.45}}>Calendario mensual de mantenimientos preventivos y correctivos por equipo.</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[{id:"dashboard",label:"Dashboard"},{id:"calendario",label:"Calendario"}].map(t=><button key={t.id} onClick={()=>setSubVista(t.id)} style={{padding:"8px 13px",borderRadius:9,border:`1px solid ${subVista===t.id?C.red:C.border}`,background:subVista===t.id?C.red:C.surface,color:subVista===t.id?"#fff":C.textSub,fontSize:12,fontWeight:900,fontFamily:"Inter",cursor:"pointer"}}>{t.label}</button>)}
            </div>
          </div>
          <div style={{padding:14,border:`1px solid ${C.border}66`,borderRadius:14,background:"rgba(0,0,0,.18)",boxShadow:"inset 0 1px 0 rgba(255,255,255,.03)"}}>
            <div style={{display:"grid",gridTemplateColumns:"150px 150px minmax(190px,.85fr) minmax(230px,1fr) minmax(230px,1fr) 280px",gap:12,alignItems:"end"}}>
              <div><label style={{display:"block",fontSize:10,color:C.textMuted,fontWeight:850,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Mes</label><select value={mesIdx} onChange={e=>setMesIdx(Number(e.target.value))} style={{width:"100%",height:38,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,padding:"9px 10px",fontSize:12,fontWeight:750,fontFamily:"Inter",outline:"none"}}>{MESES.map((x,i)=><option key={x} value={i}>{x}</option>)}</select></div>
              <div><label style={{display:"block",fontSize:10,color:C.textMuted,fontWeight:850,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Año</label><select value={anio} onChange={e=>setAnio(e.target.value)} style={{width:"100%",height:38,background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,color:C.text,padding:"9px 10px",fontSize:12,fontWeight:750,fontFamily:"Inter",outline:"none"}}>{anios.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
              <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(x=>({value:x,label:x}))]}/>
              <MultiSel label="Equipo" value={maquina} onChange={setMaquina} options={[{value:"todas",label:"Todas"},...maquinas.map(x=>({value:x,label:x}))]}/>
              <MultiSel label="Tipo mantenimiento" value={tipoMant} onChange={setTipoMant} options={[{value:"todos",label:"Todos"},...tipos.map(x=>({value:x,label:x}))]}/>
              <div>
                <label style={{display:"block",fontSize:10,color:C.textMuted,fontWeight:850,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Período</label>
                <div style={{height:38,display:"flex",alignItems:"center",padding:"0 12px",border:`1px solid ${C.border}`,borderRadius:9,background:C.surface,color:C.textSub,fontSize:12,fontWeight:850,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{fmtFechaLocal(periodo.desde)} → {fmtFechaLocal(periodo.hasta)}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {subVista==="dashboard"?(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
            <StatCard icon="parts" label="Mantenimientos" value={filtered.length} color={C.blue} small/>
            <StatCard icon="check" label="Preventivos" value={preventivos} sub={`${dashboardMant.participacionPrev}% del total`} color={C.green} small/>
            <StatCard icon="warn" label="Correctivos" value={correctivos} sub={`${dashboardMant.participacionCorr}% del total`} color={C.red} small/>
            <StatCard icon="alert" label="Ratio C/P" value={ratioLabel} sub={dashboardMant.ratioGeneral===null?"Correctivos sin preventivos":"Correctivos por preventivo"} color={dashboardMant.ratioGeneral===null||dashboardMant.ratioGeneral>0.75?C.red:(dashboardMant.ratioGeneral>0.35?C.yellow:C.green)} small/>
            <StatCard icon="equip" label="Equipos reincidentes" value={dashboardMant.equiposReincidentes.length} sub="2 o más correctivos" color={dashboardMant.equiposReincidentes.length?C.red:C.green} small/>
            <StatCard icon="time" label="Días entre mantenimientos" value={dashboardMant.diasPromEntre?dashboardMant.diasPromEntre.toFixed(1):"—"} sub="Promedio por equipo" color={C.purple} small/>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"minmax(280px,.9fr) minmax(360px,1.25fr)",gap:14,alignItems:"stretch"}}>
            <Card title="Distribución preventivo / correctivo">
              <div style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:14,alignItems:"center",padding:12}}>
                <div style={{display:"flex",justifyContent:"center"}}>
                  {dashboardMant.tipoData.length?
                    <PieChart width={210} height={210}>
                      <Pie data={dashboardMant.tipoData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} innerRadius={48}>
                        {dashboardMant.tipoData.map(d=><Cell key={d.name} fill={d.name==="Preventivo"?C.green:C.red}/> )}
                      </Pie>
                      <Tooltip content={({active,payload})=>{
                        if(!active||!payload?.length)return null;
                        const d=payload[0].payload;
                        return <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:12}}><div style={{fontWeight:900,color:C.text}}>{d.name}</div><div style={{color:C.textSub}}>{d.value} mantenimientos</div></div>;
                      }}/>
                    </PieChart>
                    :<div style={{height:210,display:"flex",alignItems:"center",justifyContent:"center",color:C.textMuted,fontSize:12}}>Sin datos</div>
                  }
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{padding:12,border:`1px solid ${C.border}66`,borderRadius:12,background:"rgba(255,255,255,.035)"}}>
                    <div style={{fontSize:10,color:C.textMuted,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Cómo se calcula el ratio C/P</div>
                    <div style={{fontSize:12,color:C.textSub,lineHeight:1.5}}>Correctivos ÷ Preventivos. Indica cuántos mantenimientos correctivos se realizan por cada preventivo dentro del período filtrado.</div>
                  </div>
                  <div style={{padding:12,border:`1px solid ${(dashboardMant.ratioGeneral===null||dashboardMant.ratioGeneral>0.75?C.red:(dashboardMant.ratioGeneral>0.35?C.yellow:C.green))}55`,borderRadius:12,background:dashboardMant.ratioGeneral===null||dashboardMant.ratioGeneral>0.75?C.redDim:(dashboardMant.ratioGeneral>0.35?C.yellowDim:C.greenDim)}}>
                    <div style={{fontSize:10,color:C.textMuted,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Interpretación</div>
                    <div style={{fontSize:12,color:C.textSub,lineHeight:1.5}}>{ratioInterpretacion}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Top equipos con más mantenimientos">
              <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:C.surface}}>{["Equipo","Preventivos","Correctivos","Total","Ratio C/P"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:h==="Equipo"?"left":"center",color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {dashboardMant.topEquipos.length===0?<tr><td colSpan={5} style={{padding:24,textAlign:"center",color:C.textMuted}}>Sin datos para los filtros seleccionados.</td></tr>:dashboardMant.topEquipos.map((x,i)=><tr key={x.equipo} style={{background:i%2?C.surface+"44":"transparent"}}>
                      <td style={{padding:"8px 10px",fontWeight:900,color:C.purple}}>{x.equipo}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",color:C.green,fontWeight:850}}>{x.preventivos}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",color:C.red,fontWeight:850}}>{x.correctivos}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",color:C.text,fontWeight:900}}>{x.total}</td>
                      <td style={{padding:"8px 10px",textAlign:"center",fontWeight:900,color:x.ratioCP===null?C.red:(x.ratioCP>0.75?C.red:(x.ratioCP>0.35?C.yellow:C.green))}}>{x.ratioCP===null?"Sin prev.":x.ratioCP.toFixed(2)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <Card title="Equipos reincidentes en correctivos" action={<span style={{fontSize:11,color:C.textMuted,fontWeight:800}}>Criterio: 2 o más correctivos en el período</span>}>
            <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:C.surface}}>{["Equipo","Correctivos","Preventivos","Total","Lectura"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:h==="Equipo"||h==="Lectura"?"left":"center",color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
                <tbody>
                  {dashboardMant.equiposReincidentes.length===0?<tr><td colSpan={5} style={{padding:24,textAlign:"center",color:C.green,fontWeight:850}}>No hay equipos con reincidencia correctiva para los filtros seleccionados.</td></tr>:dashboardMant.equiposReincidentes.slice(0,25).map((x,i)=><tr key={x.equipo} style={{background:i%2?C.surface+"44":"transparent"}}>
                    <td style={{padding:"8px 10px",fontWeight:900,color:C.purple}}>{x.equipo}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:C.red,fontWeight:900}}>{x.correctivos}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:C.green,fontWeight:850}}>{x.preventivos}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",color:C.text,fontWeight:850}}>{x.total}</td>
                    <td style={{padding:"8px 10px",color:C.textSub,lineHeight:1.35}}>Equipo con correctivos repetidos; conviene revisar causa raíz, calidad de reparación y stock de repuestos críticos.</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ):(
        <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
        <StatCard icon="parts" label="Mantenimientos" value={filtered.length} color={C.blue} small/>
        <StatCard icon="check" label="Preventivos" value={preventivos} color={C.green} small/>
        <StatCard icon="warn" label="Correctivos" value={correctivos} color={C.red} small/>
        <StatCard icon="equip" label="Equipos afectados" value={equiposAfectados} color={C.purple} small/>
        <StatCard icon="alert" label="Correctivo ≤ 7 días post-preventivo" value={`${preventivosConCorrectivo}`} sub={`${kpiRiesgo}% de preventivos · ${diasProm?diasProm.toFixed(1):"—"} días prom.`} color={preventivosConCorrectivo?C.red:C.green} small/>
      </div>

      <Card title={`Calendario — ${periodo.label}`}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
          {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d=><div key={d} style={{padding:"8px 10px",textAlign:"center",fontSize:11,fontWeight:900,color:C.textMuted,textTransform:"uppercase",letterSpacing:".08em",background:C.surface,borderRadius:8}}>{d}</div>)}
          {cells.map((iso,i)=>{
            if(!iso)return <div key={`blank-${i}`} style={{minHeight:110}}/>;
            const items=byDay[iso]||[];
            const prev=items.filter(x=>x._tipo==="Preventivo").length;
            const corr=items.filter(x=>x._tipo==="Correctivo").length;
            return(
              <div key={iso} style={{minHeight:130,background:items.length?"rgba(255,255,255,.055)":"rgba(255,255,255,.025)",border:`1px solid ${items.length?C.borderLight:C.border}55`,borderRadius:12,padding:9,overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:7}}>
                  <span style={{fontSize:14,fontWeight:900,color:C.text}}>{Number(iso.slice(-2))}</span>
                  {items.length>0&&<span style={{fontSize:10,color:C.textMuted,fontWeight:800}}>{items.length} OT</span>}
                </div>
                {(prev>0||corr>0)&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>{prev>0&&<Badge color={C.green}>P {prev}</Badge>}{corr>0&&<Badge color={C.red}>C {corr}</Badge>}</div>}
                <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:78,overflow:"hidden"}}>
                  {items.slice(0,4).map((r,idx)=><div key={`${iso}-${idx}-${r.maquina}`} title={`${r._tipo} · ${r.maquina} · ${r.proyecto||""}`} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:C.textSub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}><span style={{width:7,height:7,borderRadius:"50%",background:r._tipo==="Preventivo"?C.green:(r._tipo==="Correctivo"?C.red:C.blue),flexShrink:0}}/><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{r.maquina||"—"}</span></div>)}
                  {items.length>4&&<div style={{fontSize:10,color:C.textMuted,fontWeight:800}}>+{items.length-4} más</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="KPI — Correctivos dentro de 7 días posteriores a preventivos">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:10,marginBottom:12}}>
          <div style={{padding:12,border:`1px solid ${C.border}66`,borderRadius:12,background:"rgba(255,255,255,.035)"}}>
            <div style={{fontSize:10,color:C.textMuted,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Cómo se calcula</div>
            <div style={{fontSize:12,color:C.textSub,lineHeight:1.5}}>Preventivos con correctivo en el mismo equipo dentro de los 7 días posteriores ÷ preventivos realizados × 100.</div>
          </div>
          <div style={{padding:12,border:`1px solid ${C.border}66`,borderRadius:12,background:"rgba(255,255,255,.035)"}}>
            <div style={{fontSize:10,color:C.textMuted,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Cómo se interpreta</div>
            <div style={{fontSize:12,color:C.textSub,lineHeight:1.5}}>Un valor bajo indica que el preventivo está siendo efectivo. Un valor alto indica posible falla recurrente, diagnóstico incompleto o preventivos que no están resolviendo la causa raíz.</div>
          </div>
          <div style={{padding:12,border:`1px solid ${preventivosConCorrectivo?C.red:C.green}55`,borderRadius:12,background:preventivosConCorrectivo?C.redDim:C.greenDim}}>
            <div style={{fontSize:10,color:C.textMuted,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Resultado del filtro</div>
            <div style={{fontSize:22,fontWeight:950,color:preventivosConCorrectivo?C.red:C.green}}>{kpiRiesgo}%</div>
            <div style={{fontSize:11,color:C.textSub,marginTop:3}}>{preventivosConCorrectivo} casos sobre {preventivos||0} preventivos</div>
          </div>
        </div>
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:C.surface}}>{["Equipo","Preventivo","Correctivo","Días","Proyecto","Intervención correctiva"].map(h=><th key={h} style={{padding:"9px 10px",textAlign:h==="Intervención correctiva"?"left":"center",color:C.textMuted,fontSize:10,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
            <tbody>
              {alertaPostPreventivo.length===0?<tr><td colSpan={6} style={{padding:22,textAlign:"center",color:C.textMuted}}>Sin correctivos dentro de los 7 días posteriores a un preventivo para el filtro seleccionado.</td></tr>:alertaPostPreventivo.slice(0,80).map((x,i)=><tr key={`${x.equipo}-${x.preventivo}-${x.correctivo}-${i}`} style={{background:i%2?C.surface+"44":"transparent"}}>
                <td style={{padding:"8px 10px",fontWeight:900,color:C.purple}}>{x.equipo}</td>
                <td style={{padding:"8px 10px",textAlign:"center",color:C.green,fontWeight:800}}>{fmtFechaLocal(x.preventivo)}</td>
                <td style={{padding:"8px 10px",textAlign:"center",color:C.red,fontWeight:800}}>{fmtFechaLocal(x.correctivo)}</td>
                <td style={{padding:"8px 10px",textAlign:"center",fontWeight:900,color:x.dias<=3?C.red:C.yellow}}>{x.dias}</td>
                <td style={{padding:"8px 10px",textAlign:"center"}}><Badge color={proyColor(x.proyecto)}>{x.proyecto}</Badge></td>
                <td style={{padding:"8px 10px",color:C.textSub,lineHeight:1.35}}>{x.intervencion}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Card>

        </>
      )}    </div>
  );
}

function ViewMantenimiento({rma15,insumos,usdRate,extState,setExtState}){
  const { C, Card, Badge, MultiSel, Sel, DateIn, PeriodMonthYear, TabBtn, StatCard, SortableTH, BtnExcel, Icon, fmtNum, fmtUSD, fmtFecha, normDate, uniq, matchMulti, multiIsAll, tipoMatchMachineROP05, normalizeInsumoCode, positionTip, sortRowsForTable, appAlert, appConfirm, proyColor, getValue, generarExcelMantenimiento, ROP05_TIPOS_MAQUINA, CodeMultiSearch } = __deps;
  const{modo,proyecto,tipoMant,maquina,fechaD,fechaH,fechaDia,filtroCosto,insumoFiltro,verGastosExcesivos=false,codigoGastoFiltro="todos"}=extState;
  const set=(k,v)=>setExtState(s=>({...s,[k]:v}));
  const setModo=v=>set("modo",v);
  const setProyecto=v=>set("proyecto",v);
  const setTipoMant=v=>set("tipoMant",v);
  const setMaquina=v=>set("maquina",v);
  const setFechaD=v=>set("fechaD",v);
  const setFechaH=v=>set("fechaH",v);
  const setFechaDia=v=>set("fechaDia",v);
  const setFiltroCosto=v=>set("filtroCosto",v);
  const setInsumoFiltro=v=>set("insumoFiltro",v);
  const setCodigoGastoFiltro=v=>set("codigoGastoFiltro",v);
  const tipoMaquina=extState?.tipoMaquina||"todas";
  const setTipoMaquina=v=>set("tipoMaquina",v);
  const [rma15Sorts,setRma15Sorts]=React.useState({});

  // Normalizar tipo para comparación case-insensitive
  const normTipo=v=>String(v||"").trim().toLowerCase();

  const proyectos=useMemo(()=>uniq(rma15.map(r=>r.proyecto).filter(Boolean)),[rma15]);

  // Si el usuario está en filtro por día pero no eligió fecha,
  // se toma automáticamente el último día con registro disponible
  // respetando Proyecto / Tipo / Máquina / Insumo.
  const ultimoDiaConRegistro=useMemo(()=>{
    const fechas=(rma15||[]).filter(r=>{
      if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
      if(!matchMulti(normTipo(r.tipoMant), Array.isArray(tipoMant)?tipoMant.map(normTipo):tipoMant,"todos"))return false;
      if(!multiIsAll(tipoMaquina,"todas")&&!tipoMatchMachineROP05(tipoMaquina,r.maquina))return false;
      if(!matchMulti(r.maquina,maquina,"todas"))return false;
      if(!multiIsAll(insumoFiltro,"todos")&&!r.insumos?.some(i=>matchMulti(String(i.codigo||""),insumoFiltro,"todos")))return false;
      return !!r.fecha;
    }).map(r=>r.fecha).sort();
    return fechas[fechas.length-1]||"";
  },[rma15,proyecto,tipoMant,tipoMaquina,maquina,insumoFiltro]);

  const fechaDiaActiva=modo==="dia"?(fechaDia||ultimoDiaConRegistro):fechaDia;

  const tiposMant=useMemo(()=>uniq(rma15.filter(r=>{
    // Encadenado izquierda → derecha: Tipo depende de Proyecto + Fecha, no de Máquina.
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(!multiIsAll(tipoMaquina,"todas")&&!tipoMatchMachineROP05(tipoMaquina,r.maquina))return false;
    if(modo==="dia"){if(fechaDiaActiva&&r.fecha!==fechaDiaActiva)return false;}
    else{if(fechaD&&r.fecha<fechaD)return false;if(fechaH&&r.fecha>fechaH)return false;}
    return true;
  }).map(r=>{const t=normTipo(r.tipoMant);return t.includes("prev")?"Preventivo":t.includes("corr")?"Correctivo":r.tipoMant;}).filter(Boolean)),[rma15,proyecto,tipoMaquina,fechaD,fechaH,fechaDiaActiva,modo]);

  const maquinas=useMemo(()=>uniq(rma15.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(!matchMulti(normTipo(r.tipoMant), Array.isArray(tipoMant)?tipoMant.map(normTipo):tipoMant,"todos"))return false;
    if(!multiIsAll(tipoMaquina,"todas")&&!tipoMatchMachineROP05(tipoMaquina,r.maquina))return false;
    if(modo==="dia"){if(fechaDiaActiva&&r.fecha!==fechaDiaActiva)return false;}
    else{if(fechaD&&r.fecha<fechaD)return false;if(fechaH&&r.fecha>fechaH)return false;}
    return true;
  }).map(r=>r.maquina).filter(Boolean)).sort(),[rma15,proyecto,tipoMant,tipoMaquina,fechaD,fechaH,fechaDiaActiva,modo]);

  const filtered=useMemo(()=>rma15.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(!matchMulti(normTipo(r.tipoMant), Array.isArray(tipoMant)?tipoMant.map(normTipo):tipoMant,"todos"))return false;
    if(!multiIsAll(tipoMaquina,"todas")&&!tipoMatchMachineROP05(tipoMaquina,r.maquina))return false;
    if(!matchMulti(r.maquina,maquina,"todas"))return false;
    if(modo==="dia"){if(fechaDiaActiva&&r.fecha!==fechaDiaActiva)return false;}
    else{if(fechaD&&r.fecha<fechaD)return false;if(fechaH&&r.fecha>fechaH)return false;}
    // Si hay filtro por insumo, solo incluir OTs que usen ese insumo
    if(!multiIsAll(insumoFiltro,"todos")&&!r.insumos.some(i=>matchMulti(String(i.codigo||""),insumoFiltro,"todos")))return false;
    return true;
  }),[rma15,proyecto,tipoMant,tipoMaquina,maquina,fechaD,fechaH,fechaDiaActiva,modo,insumoFiltro]);

  // KPIs
  const totalOTs=filtered.length;
  const preventivos=filtered.filter(r=>normTipo(r.tipoMant).includes("prev")).length;
  const correctivos=filtered.filter(r=>normTipo(r.tipoMant).includes("corr")).length;
  const costoTotal=filtered.reduce((s,r)=>s+r.costoTotal,0);
  const noOperativos=filtered.filter(r=>!r.operativo).length;
  const equiposAfectados=uniq(filtered.map(r=>r.maquina)).length;

  // Insumos más usados
  const insumosMap={};
  filtered.forEach(r=>r.insumos.forEach(i=>{
    if(!i.codigo)return;
    if(!insumosMap[i.codigo])insumosMap[i.codigo]={nombre:i.nombre,cantidad:0,costo:0,usos:[]};
    insumosMap[i.codigo].cantidad+=i.cantidad;
    insumosMap[i.codigo].costo+=i.costoTotal;
    insumosMap[i.codigo].usos.push({
      fecha:r.fecha||"",
      maquina:r.maquina||"—",
      proyecto:r.proyecto||"—",
      cantidad:Number(i.cantidad)||0,
      insumo:i.nombre||i.codigo,
      costoUnitario:(Number(i.cantidad)||0)>0?(Number(i.costoTotal)||0)/(Number(i.cantidad)||1):(Number(i.costoTotal)||0),
      costoTotal:Number(i.costoTotal)||0,
    });
  }));
  const topInsumos=Object.entries(insumosMap).sort((a,b)=>b[1].cantidad-a[1].cantidad).slice(0,10);
  const topInsumosOrdenados=useMemo(()=>sortRowsForTable(topInsumos,rma15Sorts.topInsumos,{
    codigo:r=>r[0],descripcion:r=>r[1]?.nombre,cantidad:r=>r[1]?.cantidad,costoARS:r=>r[1]?.costo,costoUSD:r=>usdRate&&r[1]?.costo?(Number(r[1].costo)||0)/usdRate:0,
  }),[topInsumos,rma15Sorts.topInsumos,usdRate]);

  // Gastos excesivos por máquina: agrupa por máquina + código de insumo,
  // suma cantidades y costos, y luego muestra el top 5 de insumos por cada máquina.
  const gastosExcesivosPorMaquina=useMemo(()=>{
    const porMaquina={};
    filtered.forEach(r=>{
      const maq=r.maquina||"—";
      if(!porMaquina[maq])porMaquina[maq]={};
      (r.insumos||[]).forEach(i=>{
        const precio=Number(i.costoTotal)||0;
        const codigo=String(i.codigo||"").trim();
        if(!codigo||precio<=0)return;
        const key=codigo;
        if(!porMaquina[maq][key]){
          porMaquina[maq][key]={
            codigo,
            insumo:i.nombre||codigo,
            cantidad:0,
            precio:0,
            costoUnitario:0,
            maquina:maq,
            proyecto:r.proyecto||"—",
            proyectos:new Set(),
            fechas:[],
            fecha:"",
            fechaLabel:"",
          };
        }
        const item=porMaquina[maq][key];
        item.cantidad+=Number(i.cantidad)||0;
        item.precio+=precio;
        item.proyectos.add(r.proyecto||"—");
        if(r.fecha)item.fechas.push(r.fecha);
        if(i.nombre&&!item.insumo)item.insumo=i.nombre;
      });
    });

    return Object.entries(porMaquina)
      .sort(([a],[b])=>a.localeCompare(b,"es-AR",{numeric:true,sensitivity:"base"}))
      .flatMap(([,itemsByCodigo])=>
        Object.values(itemsByCodigo)
          .map(item=>{
            const fechas=uniq(item.fechas).sort();
            const proyectos=[...item.proyectos].filter(Boolean);
            return{
              ...item,
              costoUnitario:(Number(item.cantidad)||0)>0?(Number(item.precio)||0)/(Number(item.cantidad)||1):(Number(item.precio)||0),
              proyecto:proyectos.length===1?proyectos[0]:proyectos.join(" / "),
              fecha:fechas[fechas.length-1]||"",
              fechaLabel:fechas.length>1?`${fmtFecha(fechas[0])} - ${fmtFecha(fechas[fechas.length-1])}`:(fechas[0]?fmtFecha(fechas[0]):"—"),
            };
          })
          .sort((a,b)=>(Number(b.precio)||0)-(Number(a.precio)||0))
          .slice(0,5)
      );
  },[filtered]);

  const codigosGastosExcesivos=useMemo(()=>{
    const m={};
    gastosExcesivosPorMaquina.forEach(x=>{if(x.codigo&&!m[x.codigo])m[x.codigo]=x.insumo||x.codigo;});
    return Object.entries(m)
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0]),"es-AR",{numeric:true,sensitivity:"base"}))
      .map(([codigo,insumo])=>({value:String(codigo),label:`${codigo} — ${insumo}`}));
  },[gastosExcesivosPorMaquina]);

  const gastosExcesivosFiltrados=useMemo(()=>{
    if(multiIsAll(codigoGastoFiltro,"todos"))return gastosExcesivosPorMaquina;
    return gastosExcesivosPorMaquina.filter(x=>matchMulti(String(x.codigo||""),codigoGastoFiltro,"todos"));
  },[gastosExcesivosPorMaquina,codigoGastoFiltro]);
  const gastosExcesivosOrdenados=useMemo(()=>sortRowsForTable(gastosExcesivosFiltrados,rma15Sorts.gastosExcesivos,{
    codigo:x=>x.codigo,insumo:x=>x.insumo,cantidad:x=>x.cantidad,precio:x=>x.precio,maquina:x=>x.maquina,proyecto:x=>x.proyecto,fecha:x=>x.fecha,
  }),[gastosExcesivosFiltrados,rma15Sorts.gastosExcesivos]);

  // OTs por equipo
  const otsPorMaq={};
  filtered.forEach(r=>{otsPorMaq[r.maquina]=(otsPorMaq[r.maquina]||0)+1;});
  const barDataMaq=Object.entries(otsPorMaq).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([maquina,ots])=>({maquina,ots}));

  // Costos por equipo según filtro
  const costosPorMaq=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{
      const tipo=normTipo(r.tipoMant);
      if(filtroCosto==="prev"&&!tipo.includes("prev"))return;
      if(filtroCosto==="corr"&&!tipo.includes("corr"))return;
      if(!m[r.maquina])m[r.maquina]=0;
      m[r.maquina]+=r.costoTotal;
    });
    return Object.entries(m).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([maquina,costo])=>({maquina,costo}));
  },[filtered,filtroCosto]);

  // OTs por tipo (normalizado)
  const otsPorTipo={};
  filtered.forEach(r=>{
    const t=normTipo(r.tipoMant).includes("prev")?"Preventivo":normTipo(r.tipoMant).includes("corr")?"Correctivo":(r.tipoMant||"Otro");
    otsPorTipo[t]=(otsPorTipo[t]||0)+1;
  });
  const pieDataTipo=Object.entries(otsPorTipo).map(([name,value])=>({name,value}));
  const COLORS=["#e8001d","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899"];

  const hayFiltros=!multiIsAll(proyecto,"todos")||!multiIsAll(tipoMant,"todos")||!multiIsAll(tipoMaquina,"todas")||!multiIsAll(maquina,"todas")||fechaD||fechaH||fechaDia||!multiIsAll(insumoFiltro,"todos")||!multiIsAll(codigoGastoFiltro,"todos");
  const [pinnedInsumo,setPinnedInsumo]=React.useState(null);
  const [hoveredInsumo,setHoveredInsumo]=React.useState(null);
  const [pinnedGasto,setPinnedGasto]=React.useState(null);
  const [hoveredGasto,setHoveredGasto]=React.useState(null);
  const [gastoPanelTop,setGastoPanelTop]=React.useState(0);
  const [gastoTooltipPos,setGastoTooltipPos]=React.useState({x:0,y:0});
  const [insumoTooltipPos,setInsumoTooltipPos]=React.useState({x:0,y:0});

  // Tooltips de Mantenimiento: evitar renders pesados mientras se barre la tabla.
  // El hover se abre con un delay mínimo; si el cursor solo pasa por arriba, no recalcula nada.
  // El tooltip en hover no captura mouse, así no genera leave/enter en bucle.
  const gastoHoverTimerRef=React.useRef(null);
  const insumoHoverTimerRef=React.useRef(null);
  const clearGastoHover=React.useCallback(()=>{
    if(gastoHoverTimerRef.current){window.clearTimeout(gastoHoverTimerRef.current);gastoHoverTimerRef.current=null;}
  },[]);
  const clearInsumoHover=React.useCallback(()=>{
    if(insumoHoverTimerRef.current){window.clearTimeout(insumoHoverTimerRef.current);insumoHoverTimerRef.current=null;}
  },[]);
  React.useEffect(()=>()=>{clearGastoHover();clearInsumoHover();},[clearGastoHover,clearInsumoHover]);
  const openGastoHover=React.useCallback((e,rowKey)=>{
    if(pinnedGasto)return;
    const x=e.clientX,y=e.clientY;
    clearGastoHover();
    gastoHoverTimerRef.current=window.setTimeout(()=>{
      setGastoTooltipPos({x,y});
      setHoveredGasto(rowKey);
    },90);
  },[pinnedGasto,clearGastoHover]);
  const closeGastoHover=React.useCallback(()=>{
    clearGastoHover();
    if(!pinnedGasto)setHoveredGasto(null);
  },[pinnedGasto,clearGastoHover]);
  const openInsumoHover=React.useCallback((e,cod)=>{
    if(pinnedInsumo)return;
    const x=e.clientX,y=e.clientY;
    clearInsumoHover();
    insumoHoverTimerRef.current=window.setTimeout(()=>{
      setInsumoTooltipPos({x,y});
      setHoveredInsumo(cod);
    },90);
  },[pinnedInsumo,clearInsumoHover]);
  const closeInsumoHover=React.useCallback(()=>{
    clearInsumoHover();
    if(!pinnedInsumo)setHoveredInsumo(null);
  },[pinnedInsumo,clearInsumoHover]);

  // Lista de insumos únicos para el selector (código + nombre, ordenado alfabéticamente)
  const insumosDisponibles=useMemo(()=>{
    // Solo mostrar insumos disponibles según filtros activos (sin insumoFiltro)
    const base=rma15.filter(r=>{
      if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
      if(!matchMulti(normTipo(r.tipoMant), Array.isArray(tipoMant)?tipoMant.map(normTipo):tipoMant,"todos"))return false;
      if(!matchMulti(r.maquina,maquina,"todas"))return false;
      if(modo==="dia"){if(fechaDiaActiva&&r.fecha!==fechaDiaActiva)return false;}
      else{if(fechaD&&r.fecha<fechaD)return false;if(fechaH&&r.fecha>fechaH)return false;}
      return true;
    });
    const catalogoPorCodigo=new Map(
      Object.entries(insumos||{}).map(([codigo,info])=>{
        const cod=normalizeInsumoCode(codigo);
        const descripcion=String(
          info?.descripcion||
          getValue(info||{},["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||
          ""
        ).trim();
        return [cod,descripcion];
      })
    );
    const m={};
    base.forEach(r=>r.insumos.forEach(i=>{
      const codigo=String(i.codigo||"").trim();
      if(!codigo||m[codigo])return;
      const descripcionCatalogo=catalogoPorCodigo.get(normalizeInsumoCode(codigo))||"";
      const descripcionRma=String(i.nombre||"").trim();
      m[codigo]=(descripcionCatalogo&&normalizeInsumoCode(descripcionCatalogo)!==normalizeInsumoCode(codigo))
        ? descripcionCatalogo
        : ((descripcionRma&&normalizeInsumoCode(descripcionRma)!==normalizeInsumoCode(codigo))?descripcionRma:"Sin descripción");
    }));
    return Object.entries(m).sort((a,b)=>(a[1]||a[0]).localeCompare(b[1]||b[0],"es-AR",{numeric:true,sensitivity:"base"}));
  },[rma15,insumos,proyecto,tipoMant,tipoMaquina,maquina,fechaD,fechaH,fechaDia,modo]);
  const reset=()=>{setProyecto("todos");setTipoMant("todos");setTipoMaquina("todas");setMaquina("todas");setFechaD("");setFechaH("");setFechaDia("");setInsumoFiltro("todos");setCodigoGastoFiltro("todos");};

  const colsPeriodo=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
    {key:"maquina",label:"Máquina",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"tipoMant",label:"Tipo",render:v=><Badge color={normTipo(v).includes("prev")?C.green:C.red}>{v||"—"}</Badge>},
    {key:"intervencion",label:"Intervención",wrap:true},
    {key:"operativo",label:"Operativo",render:v=><Badge color={v?C.green:C.red}>{v?"SÍ":"NO"}</Badge>},
    {key:"costoTotal",label:"Costo ARS",render:v=><span style={{color:v>0?C.yellow:C.textMuted,fontWeight:600}}>{v>0?"$"+fmtNum(v):"—"}</span>},
    {key:"costoTotal",label:"Costo USD",render:v=><span style={{color:v>0?C.green:C.textMuted,fontWeight:600}}>{fmtUSD(v,usdRate)}</span>},
    {key:"observaciones",label:"Observaciones",wrap:true},
  ],[]);
  const filteredPeriodoOrdenado=useMemo(()=>sortRowsForTable(filtered,rma15Sorts.ordenesPeriodo,{fecha:r=>r.fecha,proyecto:r=>r.proyecto,maquina:r=>r.maquina,tipoMant:r=>r.tipoMant,intervencion:r=>r.intervencion,operativo:r=>r.operativo?1:0,costoTotal:r=>r.costoTotal,observaciones:r=>r.observaciones}),[filtered,rma15Sorts.ordenesPeriodo]);

  // colsDia no se usa más — tabla de insumos se arma inline en el dashboard

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Filtros */}
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          {/* Fila 1: tabs + botón reporte */}
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
            <TabBtn active={modo==="dia"} onClick={()=>setModo("dia")}>Por día</TabBtn>
            <TabBtn active={modo==="periodo"} onClick={()=>setModo("periodo")}>Por período</TabBtn>
            <button onClick={()=>set("verGastosExcesivos",!verGastosExcesivos)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${verGastosExcesivos?C.yellow:C.border}`,background:verGastosExcesivos?C.yellowDim:C.surface,color:verGastosExcesivos?C.yellow:C.textSub,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
              💰 Gastos excesivos
            </button>
            <button onClick={()=>{const label=(fechaDia||fechaD||new Date().toISOString().slice(0,10)).replace(/-/g,"");generarExcelMantenimiento(filtered,usdRate,label);}} style={{marginLeft:8,display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:`1px solid ${C.accent}`,background:C.accentDim,color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"Inter",letterSpacing:".04em"}}>
              📄 Generar Reporte
            </button>
          </div>
          {/* Fila 2: filtros */}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {modo==="periodo"&&<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
            {modo==="dia"&&<DateIn label="Fecha" value={fechaDia} onChange={setFechaDia}/>}
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{setTipoMaquina(v);setMaquina("todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Tipo" value={tipoMant} onChange={setTipoMant} options={[{value:"todos",label:"Todos"},...tiposMant.map(t=>({value:t,label:t}))]}/>
            <MultiSel label="Máquina" value={maquina} onChange={setMaquina} options={[{value:"todas",label:"Todas"},...maquinas.map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Insumo" value={insumoFiltro} onChange={setInsumoFiltro} options={[{value:"todos",label:"Todos"},...insumosDisponibles.map(([cod,nom])=>({value:String(cod),label:`${cod} — ${nom}`}))]}/>
            <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="parts" label="Total OTs" value={totalOTs} color={C.blue} small/>
        <StatCard icon="check" label="Preventivos" value={preventivos} color={C.green} small/>
        <StatCard icon="warn" label="Correctivos" value={correctivos} color={C.red} small/>
        <StatCard icon="equip" label="Equipos afectados" value={equiposAfectados} color={C.purple} small/>
        <StatCard icon="warn" label="No operativos" value={noOperativos} color={C.yellow} small/>
        <StatCard icon="prod" label="Costo total insumos" value={costoTotal>0?"$"+fmtNum(costoTotal):"—"} color={C.yellow} small/>
        <StatCard icon="prod" label="Costo total USD" value={fmtUSD(costoTotal,usdRate)} color={C.green} small/>
      </div>

      {verGastosExcesivos&&(()=>{
        const activeGastoKey=pinnedGasto||hoveredGasto;
        const activeGasto=activeGastoKey?gastosExcesivosFiltrados.find(x=>`${x.codigo}__${x.maquina}`===activeGastoKey):null;
        // Historial completo del insumo en esa máquina (todos los usos en filtered)
        const historialGasto=activeGasto?(()=>{
          const items=[];
          filtered.forEach(r=>{
            if(r.maquina!==activeGasto.maquina)return;
            (r.insumos||[]).forEach(ins=>{
              if(String(ins.codigo)!==String(activeGasto.codigo))return;
              items.push({fecha:r.fecha,cantidad:ins.cantidad,precio:ins.costoTotal||0,tipoMant:r.tipoMant||""});
            });
          });
          return items.sort((a,b)=>b.fecha.localeCompare(a.fecha));
        })():[];
        return(
        <Card title={`Gastos excesivos por máquina (${gastosExcesivosFiltrados.length} ítems)`} action={
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <span style={{fontSize:11,color:C.textMuted}}>Top 5 insumos agrupados por código y máquina según el filtro aplicado</span>
            <MultiSel label="Código" value={codigoGastoFiltro} onChange={setCodigoGastoFiltro} options={[{value:"todos",label:"Todos"},...codigosGastosExcesivos]}/>
          </div>
        }>
          <div data-gastos-wrap="true" style={{position:"relative"}}>
            <div className="dm-table-scroll" style={{flex:1,overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:C.surface}}>
                    {[
                      {key:"codigo",label:"Código"},{key:"insumo",label:"Insumo"},{key:"cantidad",label:"Cantidad"},{key:"precio",label:"Precio"},{key:"maquina",label:"Máquina"},{key:"proyecto",label:"Proyecto"},{key:"fecha",label:"Fecha"}
                    ].map((c,i)=>(
                      <SortableTH key={c.key} sortId="gastosExcesivos" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"9px 12px",textAlign:i<2?"left":"center",color:C.textSub,fontWeight:600,fontSize:11,letterSpacing:".05em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{c.label}</SortableTH>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gastosExcesivosFiltrados.length===0?
                    <tr><td colSpan={7} style={{padding:28,textAlign:"center",color:C.textMuted}}>Sin gastos con costo para el filtro aplicado</td></tr>:
                    gastosExcesivosOrdenados.map((x,i)=>{
                      const rowKey=`${x.codigo}__${x.maquina}`;
                      const isActive=activeGastoKey===rowKey;
                      const isPinned=pinnedGasto===rowKey;
                      return(
                      <tr key={`${x.codigo}-${x.maquina}-${x.fecha}-${i}`}
                        className={"insumo-tr"+(isPinned?" pinned":"")}
                        style={{background:isActive?"rgba(232,0,29,0.18)":i%2===0?"transparent":C.surface+"55",cursor:"pointer"}}
                        onMouseEnter={(e)=>openGastoHover(e,rowKey)}
                        onMouseMove={()=>{}}
                        onMouseLeave={closeGastoHover}
                        onClick={(e)=>{
                          clearGastoHover();
                          setHoveredGasto(null);
                          setGastoTooltipPos({x:e.clientX,y:e.clientY});
                          setPinnedGasto(p=>p===rowKey?null:rowKey);
                        }}
                      >
                        <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600}}>{x.codigo}</td>
                        <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.text}}>{x.insumo||"—"}</td>
                        <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:700}}>{fmtNum(x.cantidad)}</td>
                        <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.yellow,fontWeight:700}}>{"$"+fmtNum(x.precio)}</td>
                        <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{x.maquina}</Badge></td>
                        <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={proyColor(x.proyecto)}>{x.proyecto}</Badge></td>
                        <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.textSub,fontWeight:600}}>{x.fechaLabel||fmtFecha(x.fecha)}</td>
                      </tr>
                      );
                    })
                  }
                </tbody>
              </table>
            </div>
            {activeGasto&&(()=>{
              const w=390;
              const h=245;
              const left=Math.max(12,Math.min((gastoTooltipPos.x||0)+8,window.innerWidth-w-12));
              const top=Math.max(12,Math.min((gastoTooltipPos.y||0)+8,window.innerHeight-h-12));
              const cantidad=Number(activeGasto.cantidad)||0;
              const unitario=Number(activeGasto.costoUnitario)||((Number(activeGasto.precio)||0)/(cantidad||1));
              return ReactDOM.createPortal(
                <div style={{
                  position:"fixed",left,top,width:w,zIndex:999999,
                  background:C.card,border:`1px solid ${pinnedGasto?C.accent:C.borderLight}`,
                  borderRadius:12,boxShadow:"0 18px 50px rgba(0,0,0,.75)",
                  overflow:"hidden",pointerEvents:pinnedGasto?"auto":"none",willChange:"transform"
                }}>
                  <div style={{padding:"10px 12px",background:pinnedGasto?C.accentDim:"rgba(255,255,255,.03)",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontWeight:900,color:C.text,fontSize:13,lineHeight:1.25}}>{activeGasto.codigo} — {activeGasto.insumo||"—"}</div>
                        <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{pinnedGasto?"Tooltip fijado · click en la fila para soltar":"Hover · click en la fila para fijar"}</div>
                      </div>
                      {pinnedGasto&&<button onClick={()=>setPinnedGasto(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.textSub,cursor:"pointer",padding:"2px 7px",fontSize:11}}>✕</button>}
                    </div>
                  </div>
                  <div style={{padding:12,display:"grid",gridTemplateColumns:"92px 1fr",gap:"7px 10px",fontSize:12}}>
                    <span style={{color:C.textMuted,fontWeight:700}}>Equipo</span><span style={{color:C.purple,fontWeight:800}}>{activeGasto.maquina}</span>
                    <span style={{color:C.textMuted,fontWeight:700}}>Proyecto</span><span><Badge color={proyColor(activeGasto.proyecto)}>{activeGasto.proyecto||"—"}</Badge></span>
                    <span style={{color:C.textMuted,fontWeight:700}}>Día</span><span style={{color:C.text,fontWeight:700}}>{activeGasto.fechaLabel||fmtFecha(activeGasto.fecha)}</span>
                    <span style={{color:C.textMuted,fontWeight:700}}>Cantidad</span><span style={{color:C.accent,fontWeight:900}}>{fmtNum(cantidad)}</span>
                    <span style={{color:C.textMuted,fontWeight:700}}>Insumo</span><span style={{color:C.text,fontWeight:700,lineHeight:1.25}}>{activeGasto.insumo||"—"}</span>
                    <span style={{color:C.textMuted,fontWeight:700}}>Costo unit.</span><span style={{color:C.yellow,fontWeight:900}}>{unitario>0?"$"+fmtNum(unitario):"—"}</span>
                    <span style={{color:C.textMuted,fontWeight:700}}>Costo total</span><span style={{color:C.yellow,fontWeight:900}}>{activeGasto.precio>0?"$"+fmtNum(activeGasto.precio):"—"}</span>
                  </div>
                </div>,
                document.body
              );
            })()}
          </div>
        </Card>
        );
      })()}

      {/* Gráficos solo en período */}
      {modo==="periodo"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 2fr 2fr",gap:14}}>
          <Card title="Distribución por Tipo">
            <div style={{padding:"12px",display:"flex",justifyContent:"center",alignItems:"center",flexDirection:"column",gap:10}}>
              <PieChart width={180} height={180}>
                <Pie data={pieDataTipo} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={36}>
                  {pieDataTipo.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip content={({active,payload})=>{
                  if(!active||!payload?.length)return null;
                  const d=payload[0].payload;
                  return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                    <div style={{color:C.text,fontWeight:600}}>{d.name}</div>
                    <div style={{color:C.accent}}>{d.value} OTs</div>
                  </div>);
                }}/>
              </PieChart>
              <div style={{display:"flex",flexDirection:"column",gap:5,width:"100%"}}>
                {pieDataTipo.map((d,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[i%COLORS.length],flexShrink:0}}/>
                    <span style={{fontSize:12,color:C.textSub,flex:1}}>{d.name}</span>
                    <span style={{fontSize:12,fontWeight:700,color:C.text}}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card title="OTs por Equipo">
            <div style={{padding:"8px 6px"}}>
              <ResponsiveContainer width="100%" height={Math.max(180,barDataMaq.length*28+40)}>
                <BarChart data={barDataMaq} layout="vertical" margin={{left:8,right:30}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                  <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                  <Tooltip content={({active,payload})=>{
                    if(!active||!payload?.length)return null;
                    return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                      <div style={{color:C.purple,fontWeight:700}}>{payload[0].payload.maquina}</div>
                      <div style={{color:C.accent}}>{payload[0].value} OTs</div>
                    </div>);
                  }}/>
                  <Bar dataKey="ots" fill={C.accent} radius={[0,4,4,0]} barSize={16}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Gasto en Insumos por Equipo" action={
            <div style={{display:"flex",gap:4}}>
              {[{v:"total",l:"Total"},{v:"prev",l:"Prev."},{v:"corr",l:"Corr."}].map(({v,l})=>(
                <button key={v} onClick={()=>setFiltroCosto(v)} style={{padding:"3px 9px",borderRadius:6,border:`1px solid ${filtroCosto===v?C.accent:C.border}`,background:filtroCosto===v?C.redDim:"transparent",color:filtroCosto===v?C.accent:C.textMuted,fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter"}}>{l}</button>
              ))}
            </div>
          }>
            <div style={{padding:"8px 6px"}}>
              {costosPorMaq.length===0
                ?<div style={{padding:24,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin datos de costos</div>
                :<ResponsiveContainer width="100%" height={Math.max(180,costosPorMaq.length*28+40)}>
                  <BarChart data={costosPorMaq} layout="vertical" margin={{left:8,right:30}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+fmtNum(v)}/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                        <div style={{color:C.purple,fontWeight:700}}>{payload[0].payload.maquina}</div>
                        <div style={{color:C.green,fontWeight:600}}>${fmtNum(payload[0].value)}</div>
                      </div>);
                    }}/>
                    <Bar dataKey="costo" fill={C.green} radius={[0,4,4,0]} barSize={16}/>
                  </BarChart>
                </ResponsiveContainer>
              }
            </div>
          </Card>
        </div>
      )}

      {/* Top insumos solo en período */}
      {modo==="periodo"&&topInsumos.length>0&&(()=>{
        const activeInsumo=pinnedInsumo||hoveredInsumo;
        const activeData=activeInsumo?topInsumos.find(([c])=>c===activeInsumo):null;
        const usosActivos=activeData?Object.values((activeData[1].usos||[]).reduce((acc,u)=>{
          const k=[u.fecha,u.maquina,u.proyecto,u.insumo,Number(u.costoUnitario)||0].join("__");
          if(!acc[k])acc[k]={
            fecha:u.fecha||"",
            maquina:u.maquina||"—",
            proyecto:u.proyecto||"—",
            cantidad:0,
            insumo:u.insumo||activeData[1].nombre||activeData[0],
            costoUnitario:Number(u.costoUnitario)||0,
            costoTotal:0,
          };
          acc[k].cantidad+=Number(u.cantidad)||0;
          acc[k].costoTotal+=Number(u.costoTotal)||0;
          return acc;
        },{})).sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))||String(a.maquina||"").localeCompare(String(b.maquina||""))):[];
        return(
        <Card title="Insumos más utilizados (Top 10)">
          <div style={{position:"relative"}}>
            <div className="dm-table-scroll" style={{width:"100%",overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:C.surface}}>
                    {[
                      {key:"codigo",label:"Código"},{key:"descripcion",label:"Descripción"},{key:"cantidad",label:"Cantidad total"},{key:"costoARS",label:"Costo ARS"},{key:"costoUSD",label:"Costo USD"}
                    ].map((c,i)=>(
                      <SortableTH key={c.key} sortId="topInsumos" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"9px 12px",textAlign:i<2?"left":"center",color:C.textSub,fontWeight:600,fontSize:11,letterSpacing:".05em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{c.label}</SortableTH>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topInsumosOrdenados.map(([cod,v],i)=>{
                    const isActive=activeInsumo===cod;
                    const isPinned=pinnedInsumo===cod;
                    return(
                    <tr key={cod}
                      className={"insumo-tr"+(isPinned?" pinned":"")}
                      style={{background:isActive?"rgba(232,0,29,0.18)":i%2===0?"transparent":C.surface+"55",cursor:"pointer"}}
                      onMouseEnter={(e)=>openInsumoHover(e,cod)}
                      onMouseMove={()=>{}}
                      onMouseLeave={closeInsumoHover}
                      onClick={(e)=>{
                        clearInsumoHover();
                        setHoveredInsumo(null);
                        setInsumoTooltipPos({x:e.clientX,y:e.clientY});
                        setPinnedInsumo(p=>p===cod?null:cod);
                      }}
                    >
                      <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600}}>{cod}</td>
                      <td style={{padding:"8px 12px",borderBottom:`1px solid ${C.border}18`,color:C.text}}>{v.nombre||"—"}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:700}}>{fmtNum(v.cantidad)}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:v.costo>0?C.yellow:C.textMuted,fontWeight:v.costo>0?700:400}}>{v.costo>0?"$"+fmtNum(v.costo):"—"}</td>
                      <td style={{padding:"8px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:v.costo>0?C.green:C.textMuted,fontWeight:v.costo>0?700:400}}>{fmtUSD(v.costo,usdRate)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {activeInsumo&&activeData&&(()=>{
              const w=520;
              const h=315;
              const left=Math.max(12,Math.min(insumoTooltipPos.x||0,window.innerWidth-w-12));
              const top=Math.max(12,Math.min(insumoTooltipPos.y||0,window.innerHeight-h-12));
              const usosActivosOrdenados=sortRowsForTable(usosActivos,rma15Sorts.historialTopInsumos,{equipo:u=>u.maquina,proyecto:u=>u.proyecto,dia:u=>u.fecha,cantidad:u=>u.cantidad,insumo:u=>u.insumo,costoUnitario:u=>u.costoUnitario});
              return ReactDOM.createPortal(
                <div style={{
                  position:"fixed",left,top,width:w,zIndex:999999,
                  background:C.card,border:`1px solid ${pinnedInsumo?C.accent:C.borderLight}`,
                  borderRadius:12,boxShadow:"0 18px 50px rgba(0,0,0,.75)",
                  overflow:"hidden",pointerEvents:pinnedInsumo?"auto":"none",willChange:"transform"
                }}>
                  <div style={{padding:"10px 12px",background:pinnedInsumo?C.accentDim:"rgba(255,255,255,.03)",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontWeight:900,color:C.text,fontSize:13,lineHeight:1.25}}>{activeData[0]} — {activeData[1].nombre||"—"}</div>
                        <div style={{fontSize:11,color:C.textMuted,marginTop:3}}>{usosActivos.length} usos en el período · {pinnedInsumo?"Tooltip fijado · click en la fila para soltar":"Hover · click en la fila para fijar"}</div>
                      </div>
                      {pinnedInsumo&&<button onClick={()=>setPinnedInsumo(null)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.textSub,cursor:"pointer",padding:"2px 7px",fontSize:11}}>✕</button>}
                    </div>
                  </div>
                  <div style={{maxHeight:250,overflow:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead style={{position:"sticky",top:0,background:"#1a1d27",zIndex:1}}>
                        <tr>
                          {[
                            {key:"equipo",label:"Equipo"},{key:"proyecto",label:"Proyecto"},{key:"dia",label:"Día"},{key:"cantidad",label:"Cant."},{key:"insumo",label:"Insumo"},{key:"costoUnitario",label:"Costo unit."}
                          ].map((c,i)=>(
                            <SortableTH key={c.key} sortId="historialTopInsumos" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"7px 9px",textAlign:i===3||i===5?"right":"left",color:C.textMuted,fontWeight:700,fontSize:10,letterSpacing:".05em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{c.label}</SortableTH>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {usosActivosOrdenados.map((u,ui)=>(
                          <tr key={ui} style={{background:ui%2===0?"transparent":"rgba(255,255,255,0.02)"}}>
                            <td style={{padding:"6px 9px",color:C.purple,fontWeight:800,borderBottom:`1px solid ${C.border}11`,whiteSpace:"nowrap"}}>{u.maquina}</td>
                            <td style={{padding:"6px 9px",borderBottom:`1px solid ${C.border}11`,whiteSpace:"nowrap"}}><Badge color={proyColor(u.proyecto)}>{u.proyecto||"—"}</Badge></td>
                            <td style={{padding:"6px 9px",color:C.textSub,fontWeight:700,borderBottom:`1px solid ${C.border}11`,whiteSpace:"nowrap"}}>{fmtFecha(u.fecha)}</td>
                            <td style={{padding:"6px 9px",textAlign:"right",color:C.accent,fontWeight:900,borderBottom:`1px solid ${C.border}11`}}>{fmtNum(u.cantidad)}</td>
                            <td style={{padding:"6px 9px",color:C.text,borderBottom:`1px solid ${C.border}11`,maxWidth:165,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.insumo||"—"}</td>
                            <td style={{padding:"6px 9px",textAlign:"right",color:C.yellow,fontWeight:900,borderBottom:`1px solid ${C.border}11`,whiteSpace:"nowrap"}}>{u.costoUnitario>0?"$"+fmtNum(u.costoUnitario):"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>,
                document.body
              );
            })()}
          </div>
        </Card>
        );
      })()}

      {/* Dashboard Por día */}
      {modo==="dia"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {!fechaDia&&fechaDiaActiva&&(
            <div style={{fontSize:12,color:C.textSub,margin:"-2px 4px 0"}}>
              Mostrando dashboard del último día con registro: <b style={{color:C.text}}>{fmtFecha(fechaDiaActiva)}</b>
            </div>
          )}

          {/* Fila 1: KPIs del día */}
          {!fechaDiaActiva&&(
            <Card>
              <div style={{padding:"20px",textAlign:"center",color:C.textMuted,fontSize:13}}>
                Sin fecha seleccionada y sin registros disponibles
              </div>
            </Card>
          )}

          {fechaDiaActiva&&filtered.length===0&&(
            <Card>
              <div style={{padding:"20px",textAlign:"center",color:C.textMuted,fontSize:13}}>
                Sin registros para el día seleccionado
              </div>
            </Card>
          )}

          {fechaDiaActiva&&filtered.length>0&&(()=>{
            const COLORS=["#e8001d","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899"];
            // Insumos del día
            const insMap={};
            filtered.forEach(r=>r.insumos.forEach(i=>{
              if(!i.codigo)return;
              if(!insMap[i.codigo])insMap[i.codigo]={nombre:i.nombre,cantidad:0,costo:0};
              insMap[i.codigo].cantidad+=i.cantidad;
              insMap[i.codigo].costo+=i.costoTotal;
            }));
            const topIns=Object.entries(insMap).sort((a,b)=>b[1].cantidad-a[1].cantidad);
            const topInsOrdenados=sortRowsForTable(topIns,rma15Sorts.topInsDia,{codigo:r=>r[0],descripcion:r=>r[1]?.nombre,cantidad:r=>r[1]?.cantidad,costoARS:r=>r[1]?.costo,costoUSD:r=>usdRate&&r[1]?.costo?(Number(r[1].costo)||0)/usdRate:0});
            // Equipos del día con tipo
            const eqData=filtered.map(r=>({
              proyecto:r.proyecto,
              maquina:r.maquina,
              tipo:normTipo(r.tipoMant).includes("prev")?"Preventivo":"Correctivo",
              operativo:r.operativo,
              costo:r.costoTotal,
              costoUSD:usdRate&&r.costoTotal?(Number(r.costoTotal)||0)/usdRate:0,
              intervencion:r.intervencion,
              ot:r,
            }));
            const eqDataOrdenado=sortRowsForTable(eqData,rma15Sorts.equiposDia,{proyecto:x=>x.proyecto,maquina:x=>x.maquina,tipo:x=>x.tipo,operativo:x=>x.operativo?1:0,intervencion:x=>x.intervencion,costoARS:x=>x.costo,costoUSD:x=>x.costoUSD});
            // Torta tipo
            const tipoCount={Preventivo:0,Correctivo:0};
            filtered.forEach(r=>{const t=normTipo(r.tipoMant).includes("prev")?"Preventivo":"Correctivo";tipoCount[t]++;});
            const pieData=[{name:"Preventivo",value:tipoCount.Preventivo},{name:"Correctivo",value:tipoCount.Correctivo}].filter(d=>d.value>0);
            // Costos por equipo
            const costoEq={};
            filtered.forEach(r=>{costoEq[r.maquina]=(costoEq[r.maquina]||0)+r.costoTotal;});
            const barCosto=Object.entries(costoEq).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([maquina,costo])=>({maquina,costo}));
            // No operativos
            const noOp=filtered.filter(r=>!r.operativo);

            return(
              <div style={{display:"flex",flexDirection:"column",gap:14}}>

                {/* Fila gráficos */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:14}}>

                  {/* Torta tipo + equipos no operativos */}
                  <div style={{display:"flex",flexDirection:"column",gap:14}}>
                    <Card title="Distribución por Tipo">
                      <div style={{padding:"12px",display:"flex",justifyContent:"center",alignItems:"center",flexDirection:"column",gap:8}}>
                        <PieChart width={160} height={160}>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={72} innerRadius={32}>
                            {pieData.map((_,i)=><Cell key={i} fill={i===0?C.green:C.red}/>)}
                          </Pie>
                          <Tooltip content={({active,payload})=>{
                            if(!active||!payload?.length)return null;
                            return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                              <div style={{color:C.text,fontWeight:600}}>{payload[0].payload.name}</div>
                              <div style={{color:C.accent}}>{payload[0].value} OTs</div>
                            </div>);
                          }}/>
                        </PieChart>
                        <div style={{display:"flex",flexDirection:"column",gap:5,width:"100%"}}>
                          {pieData.map((d,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:10,height:10,borderRadius:"50%",background:i===0?C.green:C.red,flexShrink:0}}/>
                              <span style={{fontSize:12,color:C.textSub,flex:1}}>{d.name}</span>
                              <span style={{fontSize:12,fontWeight:700,color:C.text}}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>

                    {noOp.length>0&&(
                      <Card title="⚠ Equipos no operativos">
                        <div style={{padding:"8px 12px",display:"flex",flexDirection:"column",gap:6}}>
                          {noOp.map((r,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:C.redDim,borderRadius:7,border:`1px solid ${C.red}33`}}>
                              <Badge color={C.red}>{r.maquina}</Badge>
                              <span style={{fontSize:11,color:C.textSub,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.intervencion||"Sin detalle"}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>

                  {/* Equipos atendidos */}
                  <Card title={`Equipos atendidos (${eqData.length})`}>
                    <div style={{overflowX:"auto",maxHeight:320,overflowY:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:C.surface}}>
                            {[
                              {key:"proyecto",label:"Proyecto"},{key:"maquina",label:"Máquina"},{key:"tipo",label:"Tipo"},{key:"operativo",label:"Operativo"},{key:"intervencion",label:"Intervención"},{key:"costoARS",label:"Costo ARS"},{key:"costoUSD",label:"Costo USD"}
                            ].map((c,i)=>(
                              <SortableTH key={c.key} sortId="equiposDia" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"8px 12px",textAlign:i===0||i===3?"left":"center",color:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".05em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>{c.label}</SortableTH>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {eqDataOrdenado.map((r,i)=>(
                            <tr key={i}
                            style={{background:i%2===0?"transparent":C.surface+"55",cursor:"pointer",transition:"background .1s"}}
                            onMouseEnter={e=>{
                              e.currentTarget.dataset.bg=e.currentTarget.style.background||"transparent";
                              e.currentTarget.style.background=C.accent+"22";
                              const ot=r.ot;const ins=ot?.insumos?.filter(x=>x.codigo)||[];
                              if(!ins.length)return;
                              const tip=document.createElement("div");tip.id="mant-tip2";
                              tip.style.cssText=`position:fixed;z-index:9999;background:#1c1c1c;border:1px solid #333;border-radius:10px;padding:12px 16px;font-size:12px;font-family:Inter,sans-serif;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,.6);pointer-events:none`;
                              tip.innerHTML="<div style='font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:600'>Insumos — "+r.maquina+"</div>"+
                                ins.map(x=>"<div style='padding:3px 0;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;gap:12px'><span style='color:#ccc'><b style='color:#aaa'>"+x.codigo+"</b> — "+(x.nombre||"—")+"</span><span style='color:#e8001d;font-weight:700'>x"+x.cantidad+"</span></div>").join("")+
                                (ot.costoTotal>0?"<div style='margin-top:8px;text-align:right;color:#10b981;font-weight:700'>Total: $"+Math.round(ot.costoTotal).toLocaleString("es-AR")+"</div>":"");
                              positionTip(tip,e.clientX,e.clientY);
                            }}
                            onMouseLeave={e=>{e.currentTarget.style.background=e.currentTarget.dataset.bg||"transparent";const t=document.getElementById("mant-tip2");if(t)t.remove();}}
                          >
                              <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={proyColor(r.proyecto)}>{r.proyecto||"—"}</Badge></td>
                              <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{r.maquina}</Badge></td>
                              <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={r.tipo==="Preventivo"?C.green:C.red}>{r.tipo}</Badge></td>
                              <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}><Badge color={r.operativo?C.green:C.red}>{r.operativo?"SÍ":"NO"}</Badge></td>
                              <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`,color:C.textSub,fontSize:11,maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.intervencion||"—"}</td>
                              <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.costo>0?C.yellow:C.textMuted,fontWeight:r.costo>0?600:400}}>{r.costo>0?"$"+fmtNum(r.costo):"—"}</td>
                              <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.costo>0?C.green:C.textMuted,fontWeight:r.costo>0?600:400}}>{fmtUSD(r.costo,usdRate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Fila 2: Insumos + costos por equipo */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>

                  {/* Top insumos del día */}
                  {topIns.length>0&&(
                    <Card title={`Insumos utilizados (${topIns.length})`}>
                      <div style={{overflowX:"auto",maxHeight:300,overflowY:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr style={{background:C.surface}}>
                              {[
                                {key:"codigo",label:"Código"},{key:"descripcion",label:"Descripción"},{key:"cantidad",label:"Cant."},{key:"costoARS",label:"Costo ARS"},{key:"costoUSD",label:"Costo USD"}
                              ].map((c,i)=>(
                                <SortableTH key={c.key} sortId="topInsDia" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"8px 10px",textAlign:i<2?"left":"center",color:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".05em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.surface}}>{c.label}</SortableTH>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {topInsOrdenados.map(([cod,v],i)=>(
                              <tr key={cod} style={{background:i%2===0?"transparent":C.surface+"55"}}>
                                <td style={{padding:"7px 10px",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600,fontSize:11}}>{cod}</td>
                                <td style={{padding:"7px 10px",borderBottom:`1px solid ${C.border}18`,color:C.text,fontSize:11}}>{v.nombre||"—"}</td>
                                <td style={{padding:"7px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:700}}>{fmtNum(v.cantidad)}</td>
                                <td style={{padding:"7px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:v.costo>0?C.green:C.textMuted,fontWeight:v.costo>0?600:400}}>{v.costo>0?"$"+fmtNum(v.costo):"—"}</td>
                                <td style={{padding:"7px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:v.costo>0?C.blue:C.textMuted,fontWeight:v.costo>0?600:400}}>{fmtUSD(v.costo,usdRate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}

                  {/* Costos por equipo */}
                  {barCosto.length>0&&(
                    <Card title="Gasto por Equipo">
                      <div style={{padding:"8px 6px"}}>
                        <ResponsiveContainer width="100%" height={Math.max(140,barCosto.length*28+30)}>
                          <BarChart data={barCosto} layout="vertical" margin={{left:8,right:40}}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                            <XAxis type="number" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+fmtNum(v)}/>
                            <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                            <Tooltip content={({active,payload})=>{
                              if(!active||!payload?.length)return null;
                              return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",fontSize:12}}>
                                <div style={{color:C.purple,fontWeight:700}}>{payload[0].payload.maquina}</div>
                                <div style={{color:C.green,fontWeight:600}}>${fmtNum(payload[0].value)}</div>
                              </div>);
                            }}/>
                            <Bar dataKey="costo" fill={C.green} radius={[0,4,4,0]} barSize={16}/>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Tabla insumos del día */}
                {(()=>{
                  const allIns=[];
                  filtered.forEach(r=>{
                    r.insumos.filter(x=>x.codigo).forEach(x=>{
                      allIns.push({maquina:r.maquina,tipoMant:r.tipoMant,codigo:x.codigo,nombre:x.nombre,cantidad:x.cantidad,costoARS:x.costoTotal});
                    });
                  });
                  if(!allIns.length)return null;
                  const allInsOrdenados=sortRowsForTable(allIns,rma15Sorts.insumosDia,{maquina:x=>x.maquina,tipo:x=>x.tipoMant,codigo:x=>x.codigo,descripcion:x=>x.nombre,cantidad:x=>x.cantidad,costoARS:x=>x.costoARS,costoUSD:x=>usdRate&&x.costoARS?(Number(x.costoARS)||0)/usdRate:0});
                  return(
                    <Card title={`Insumos utilizados — ${fmtFecha(fechaDia)} (${allIns.length} registros)`}>
                      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:400}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead>
                            <tr style={{background:C.surface}}>
                              {[
                                {key:"maquina",label:"Máquina"},{key:"tipo",label:"Tipo"},{key:"codigo",label:"Código"},{key:"descripcion",label:"Descripción"},{key:"cantidad",label:"Cantidad"},{key:"costoARS",label:"Costo ARS"},{key:"costoUSD",label:"Costo USD"}
                              ].map((c,i)=>(
                                <SortableTH key={c.key} sortId="insumosDia" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"9px 12px",textAlign:i>4?"center":"left",color:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",position:"sticky",top:0,background:C.surface,zIndex:1}}>{c.label}</SortableTH>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {allInsOrdenados.map((x,i)=>{
                              // Buscar la OT completa para el tooltip
                              const ot=filtered.find(r=>r.maquina===x.maquina&&r.insumos.some(ins=>ins.codigo===x.codigo));
                              const otIns=ot?.insumos?.filter(ins=>ins.codigo)||[];
                              return(
                              <tr key={i} style={{background:i%2===0?"transparent":C.surface+"55",cursor:otIns.length?"pointer":"default",transition:"background .1s"}}
                                onMouseEnter={e=>{
                                  e.currentTarget.dataset.bg=e.currentTarget.style.background||"transparent";
                                  e.currentTarget.style.background=C.accent+"22";
                                  if(!otIns.length)return;
                                  const tip=document.createElement("div");tip.id="ins-tip";
                                  tip.style.cssText=`position:fixed;z-index:9999;background:#1c1c1c;border:1px solid #333;border-radius:10px;padding:12px 16px;font-size:12px;font-family:Inter,sans-serif;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.6);pointer-events:none`;
                                  tip.innerHTML="<div style='font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:600'>Todos los insumos — "+x.maquina+"</div>"+
                                    otIns.map(ins=>"<div style='padding:3px 0;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;gap:12px'><span style='color:#ccc'><b style='color:#aaa'>"+ins.codigo+"</b> — "+(ins.nombre||"—")+"</span><span style='color:#e8001d;font-weight:700;flex-shrink:0'>x"+ins.cantidad+(ins.costoTotal>0?" <span style='color:#10b981'>$"+Math.round(ins.costoTotal).toLocaleString("es-AR")+"</span>":"")+"</span></div>").join("")+
                                    (ot?.costoTotal>0?"<div style='margin-top:8px;text-align:right;color:#10b981;font-weight:700'>Total OT: $"+Math.round(ot.costoTotal).toLocaleString("es-AR")+"</div>":"");
                                  positionTip(tip,e.clientX,e.clientY);
                                }}
                                onMouseLeave={e=>{e.currentTarget.style.background=e.currentTarget.dataset.bg||"transparent";const t=document.getElementById("ins-tip");if(t)t.remove();}}
                              >
                                <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{x.maquina}</Badge></td>
                                <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`}}><Badge color={normTipo(x.tipoMant).includes("prev")?C.green:C.red}>{x.tipoMant||"—"}</Badge></td>
                                <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600}}>{x.codigo}</td>
                                <td style={{padding:"7px 12px",borderBottom:`1px solid ${C.border}18`,color:C.text}}>{x.nombre||"—"}</td>
                                <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:700}}>{fmtNum(x.cantidad)}</td>
                                <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:x.costoARS>0?C.yellow:C.textMuted,fontWeight:x.costoARS>0?600:400}}>{x.costoARS>0?"$"+fmtNum(x.costoARS):"—"}</td>
                                <td style={{padding:"7px 12px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:x.costoARS>0?C.green:C.textMuted,fontWeight:x.costoARS>0?600:400}}>{fmtUSD(x.costoARS,usdRate)}</td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })()}

              </div>
            );
          })()}
        </div>
      )}

      {/* Por período */}
      {modo==="periodo"&&(
        <Card title={`Órdenes de Trabajo (${filtered.length})`}>
          <div style={{overflowX:"auto",overflowY:"auto",maxHeight:420,width:"100%"}}>
            <table style={{width:"100%",tableLayout:"fixed",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:C.surface}}>
                  {colsPeriodo.map((c,i)=><SortableTH key={i} sortId="ordenesPeriodo" sortKey={c.key} sorts={rma15Sorts} setSorts={setRma15Sorts} style={{padding:"9px 12px",textAlign:"left",color:C.textSub,fontWeight:600,fontSize:10,letterSpacing:".06em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",position:"sticky",top:0,background:C.surface,zIndex:1}}>{c.label}</SortableTH>)}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0
                  ?<tr><td colSpan={colsPeriodo.length} style={{padding:28,textAlign:"center",color:C.textMuted}}>Sin registros</td></tr>
                  :filteredPeriodoOrdenado.map((r,i)=>{
                    const ins=r.insumos?.filter(x=>x.codigo)||[];
                    return(
                      <tr key={i}
                        style={{background:i%2===0?"transparent":C.surface+"66",cursor:ins.length?"pointer":"default",transition:"background .1s"}}
                        onMouseEnter={e=>{
                          e.currentTarget.dataset.bg=e.currentTarget.style.background||"transparent";
                          e.currentTarget.style.background=C.accent+"22";
                          if(!ins.length)return;
                          const tip=document.createElement("div");tip.id="mant-tip3";
                          tip.style.cssText=`position:fixed;z-index:9999;background:#1c1c1c;border:1px solid #333;border-radius:10px;padding:12px 16px;font-size:12px;font-family:Inter,sans-serif;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.6);pointer-events:none`;
                          tip.innerHTML="<div style='font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;font-weight:600'>Insumos — "+r.maquina+" ("+r.fecha+")</div>"+
                            ins.map(x=>"<div style='padding:3px 0;border-bottom:1px solid #2a2a2a;display:flex;justify-content:space-between;gap:12px'><span style='color:#ccc'><b style='color:#aaa'>"+x.codigo+"</b> — "+(x.nombre||"—")+"</span><span style='color:#e8001d;font-weight:700;flex-shrink:0'>x"+x.cantidad+(x.costoTotal>0?" <span style='color:#10b981'>$"+Math.round(x.costoTotal).toLocaleString('es-AR')+"</span>":"")+"</span></div>").join("")+
                            (r.costoTotal>0?"<div style='margin-top:8px;text-align:right;color:#10b981;font-weight:700'>Total: $"+Math.round(r.costoTotal).toLocaleString('es-AR')+"</div>":"");
                          positionTip(tip,e.clientX,e.clientY);
                        }}
                        onMouseLeave={e=>{e.currentTarget.style.background=e.currentTarget.dataset.bg||"transparent";const t=document.getElementById("mant-tip3");if(t)t.remove();}}
                      >
                        {colsPeriodo.map((c,j)=><td key={j} style={{padding:"8px 12px",borderBottom:`1px solid #ffffff0a`,color:"#e0e0e0",whiteSpace:c.wrap?"normal":"nowrap",overflow:"hidden",maxWidth:c.wrap?undefined:260}}>{c.render?c.render(r[c.key]):r[c.key]||"—"}</td>)}
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}


export function MantenimientoModule({mode="mantenimiento", deps={}, ...props}) {
  __deps = deps || {};
  Object.assign(globalThis.__DM_MANT_DEPS__ || (globalThis.__DM_MANT_DEPS__ = {}), __deps);
  if(mode === "distribucion") return <ViewDistribucionMantenimientos {...props} />;
  if(mode === "programado") return <MantenimientoProgramadoView deps={__deps} {...props} />;
  return <ViewMantenimiento {...props} />;
}

export default MantenimientoModule;
