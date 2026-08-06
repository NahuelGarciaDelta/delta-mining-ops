import React, {useState,useRef,useEffect,useMemo,useCallback} from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import { C as UI_C } from "../../components/ui/index.jsx";

let C=UI_C, Card, Icon, Spinner, Badge, StatCard, Table, SortableTH, Sel, MultiSel, DateIn, TabBtn, AlertBanner, HelpTip;
let fmtNum, fmtFecha, fmtARS, fmtUSD, uniq, normDate, normalizeInsumoCode, normalizeInflatedMoneyValue, toMoneyNumber, getExactValue, getInsumoExtra, getValue, cleanKey, toNumber, multiIsAll, matchMulti, dmNormKey, canonicalEquivalentMachineCode, tipoEquipoCosto, esMaquinaCosto, excelFromCols, generarExcelCodigosSinPrecio;

function BtnExcel({onClick}){return <button onClick={onClick} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.green}44`,background:C.greenDim,color:C.green,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"Inter"}}>⬇ Excel</button>;}

function applyDeps(deps={}){
  ({C:C=UI_C,Card,Icon,Spinner,Badge,StatCard,Table,SortableTH,Sel,MultiSel,DateIn,TabBtn,AlertBanner,HelpTip,fmtNum,fmtFecha,fmtARS,fmtUSD,uniq,normDate,normalizeInsumoCode,normalizeInflatedMoneyValue,toMoneyNumber,getExactValue,getInsumoExtra,getValue,cleanKey,toNumber,multiIsAll,matchMulti,dmNormKey,canonicalEquivalentMachineCode,tipoEquipoCosto,esMaquinaCosto,excelFromCols,generarExcelCodigosSinPrecio}=deps);
}
function ParamInput({value,set,style}){
  const[local,setLocal]=React.useState(String(value??''));
  const prevValue=React.useRef(value);

  React.useEffect(()=>{
    if(prevValue.current!==value){
      prevValue.current=value;
      setLocal(String(value??''));
    }
  },[value]);

  const commit=React.useCallback((raw)=>{
    const txt=String(raw??'').trim();
    if(txt===''){
      setLocal(String(prevValue.current??''));
      return;
    }
    const n=Number(txt.replace(',','.'));
    if(Number.isFinite(n)){
      prevValue.current=n;
      set(n);
      setLocal(String(n));
    }else{
      setLocal(String(prevValue.current??''));
    }
  },[set]);

  const handleChange=React.useCallback((e)=>{
    setLocal(e.target.value);
  },[]);

  const handleBlur=React.useCallback((e)=>{
    commit(e.target.value);
  },[commit]);

  const handleKeyDown=React.useCallback((e)=>{
    if(e.key==='Enter'){
      commit(e.currentTarget.value);
      e.currentTarget.blur();
    }
  },[commit]);

  return <input type="number" value={local} onChange={handleChange} onBlur={handleBlur} onKeyDown={handleKeyDown} style={style}/>;
}

// Selector con estado local: el cambio visual es inmediato y el recálculo pesado
// se confirma cuando el navegador queda libre.
const CategoriaModeloSelect=React.memo(function CategoriaModeloSelect({modelKey,value,options,onCommit,style}){
  const [local,setLocal]=React.useState(value||"SIN CATEGORIA");
  const taskRef=React.useRef(null);
  React.useEffect(()=>setLocal(value||"SIN CATEGORIA"),[value]);
  React.useEffect(()=>()=>{
    if(taskRef.current!=null){
      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(taskRef.current);
      else window.clearTimeout(taskRef.current);
    }
  },[]);
  const change=React.useCallback((e)=>{
    const next=e.target.value;
    setLocal(next);
    if(taskRef.current!=null){
      if(typeof window.cancelIdleCallback==="function")window.cancelIdleCallback(taskRef.current);
      else window.clearTimeout(taskRef.current);
    }
    const run=()=>onCommit(modelKey,next);
    taskRef.current=typeof window.requestIdleCallback==="function"
      ?window.requestIdleCallback(run,{timeout:350})
      :window.setTimeout(run,30);
  },[modelKey,onCommit]);
  return <select value={local} onChange={change} style={style}>
    <option value="SIN CATEGORIA">SIN CATEGORIA</option>
    {(options||[]).map(c=><option key={c} value={c}>{c}</option>)}
  </select>;
});

// Fila memoizada del catálogo de categorías. Al asignar un modelo sólo vuelve
// a renderizarse esa fila; no las decenas o centenas restantes.
const CategoriaModeloTableRow=React.memo(function CategoriaModeloTableRow({row,index,value,options,onCommit,colors}){
  const bg=index%2===0?"rgba(255,255,255,.025)":"rgba(255,255,255,.055)";
  const tdBase={padding:"9px 10px",borderBottom:`1px solid ${colors.border}`,fontSize:12,color:colors.textSub,textAlign:"center"};
  const tdLeft={...tdBase,textAlign:"left",color:colors.text};
  const selectStyle={width:"100%",minWidth:210,padding:"8px 10px",borderRadius:7,border:`1px solid ${colors.border}`,background:"rgba(0,0,0,.28)",color:colors.text,fontWeight:800};
  return <tr style={{background:bg}}>
    <td style={{...tdLeft,fontWeight:800}}>{row.familia}</td>
    <td style={tdBase}>{row.marca||"—"}</td>
    <td style={{...tdBase,fontWeight:700}}>{row.modelo}</td>
    <td style={tdBase} title={(row.equipos||[]).join(", ")}>{row.cantidad}</td>
    <td style={tdLeft}><CategoriaModeloSelect modelKey={row.key} value={value} options={options} onCommit={onCommit} style={selectStyle}/></td>
  </tr>;
},(a,b)=>a.row===b.row&&a.index===b.index&&a.value===b.value&&a.options===b.options&&a.onCommit===b.onCommit&&a.colors.border===b.colors.border&&a.colors.text===b.colors.text&&a.colors.textSub===b.colors.textSub);

// ─── AmortRow — fila memoizada de la tabla de amortización ──────────────────
const AmortRow=React.memo(function AmortRow({x,i,useListaVidaUtil,vidaUtilOverride,setVidaUtilState,tdL,tdS,C,fmtNum}){
  const vidaLM=x.vidaListaMaestra||x.vidaBase||x.vida||8000;
  const override=vidaUtilOverride[x.equipo];
  const usaLista=useListaVidaUtil[x.equipo]!==false;

  // Recalcular amortización en tiempo real con el override actual del estado
  // (x.amort viene del useMemo que solo se actualiza en onBlur, esto se actualiza en cada render)
  const vidaEfectiva=x._esDelta?(usaLista?vidaLM:(override>0?override:vidaLM)):(x.horasMensuales||200);
  const amort=x._esDelta?(vidaEfectiva>0?x.adq/vidaEfectiva:x.amort):x.amort;
  const totalUSDhs=amort+x.hhHombreVestido+x.mantUSDhs;
  const pctMant=amort>0?x.mantUSDhs/amort:x.pctMant;

  return(
    <tr style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)",borderTop:x._firstTipoDisplay?`2px solid ${C.borderLight}`:undefined}}>
      <td style={tdL}>{x.equipo}</td>
      <td style={{...tdS,textAlign:"left",color:C.textSub,fontWeight:600}}>{x.propiedad||"S/D"}</td>
      <td style={{...tdS,textAlign:"left",color:C.textSub,fontWeight:700}}>{x.tipo||"S/D"}</td>
      <td style={{...tdS,textAlign:"left",color:C.textSub}}>{x.modelo||"—"}</td>
      <td style={tdS}>{x.adq>0?"U$S "+fmtNum(Math.round(x.adq)):"—"}</td>
      <td style={{...tdS,padding:"4px 6px"}}>
        {x._esDelta?(
          <div style={{display:"flex",alignItems:"center",gap:5,justifyContent:"center"}}>
            <input type="checkbox"
              title="Trabajar con datos de Lista de Equipos"
              checked={usaLista}
              onChange={e=>{
                const checked=e.target.checked;
                setVidaUtilState(s=>({
                  lista:{...s.lista,[x.equipo]:checked},
                  override: checked ? s.override : {
                    ...s.override,
                    [x.equipo]: s.override[x.equipo]>0 ? s.override[x.equipo] : Math.round(vidaLM)
                  }
                }));
              }}
              style={{accentColor:C.teal,cursor:"pointer",flexShrink:0,appearance:"auto",width:14,height:14,background:"rgba(0,0,0,0.7)",borderRadius:3}}
            />
            {usaLista?(
              <span style={{color:C.textSub,minWidth:60,textAlign:"right"}}>{vidaLM>0?fmtNum(Math.round(vidaLM)):"—"}</span>
            ):(
              <VidaUtilInput
                key={x.equipo+"_"+(override>0?override:Math.round(vidaLM))}
                initialValue={override>0?override:Math.round(vidaLM)}
                onCommit={val=>setVidaUtilState(s=>({...s,override:{...s.override,[x.equipo]:val>0?val:Math.round(vidaLM)}}))}
              />
            )}
          </div>
        ):(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
            <span style={{color:C.teal,fontWeight:700,fontSize:12}}>{vidaEfectiva>0?fmtNum(Math.round(vidaEfectiva)):"—"}</span>
            <span style={{fontSize:9,color:C.textMuted,whiteSpace:"nowrap"}}>hs/mes</span>
          </div>
        )}
      </td>
      <td style={{...tdS,color:C.yellow,fontWeight:700}}><div>{amort>0?"U$S "+Number(amort).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</div><div style={{fontSize:9,color:C.textMuted,fontWeight:500,marginTop:2,whiteSpace:"normal"}}>{x.costoCapitalDetalle||""}</div></td>
      <td style={{...tdS,color:C.teal,fontWeight:700}}>{x.hhHombreVestido>0?"U$S "+fmtNum(Math.round(x.hhHombreVestido)):"—"}</td>
      <td style={{...tdS,color:C.purple,fontWeight:700}}>{x.mantUSDhs>0?"U$S "+fmtNum(Math.round(x.mantUSDhs)):"—"}</td>
      <td style={{...tdS,color:C.accent,fontWeight:800}}>{totalUSDhs>0?"U$S "+fmtNum(Math.round(totalUSDhs)):"—"}</td>
      <td style={{...tdS,color:C.textSub}}>{pctMant>0?(pctMant*100).toFixed(2)+"%":"—"}</td>
      {x._firstTipoDisplay&&(
        <td rowSpan={x._grupoSizeDisplay||1} style={{...tdS,color:C.blue,fontWeight:900,background:C.blueDim,verticalAlign:"middle",fontSize:16,borderLeft:`2px solid ${C.blue}55`,borderBottom:`2px solid ${C.borderLight}`}}>
          {x.promTipo>0?(x.promTipo*100).toFixed(0)+"%":"—"}
        </td>
      )}
    </tr>
  );
});

// ─── VidaUtilInput — input no controlado, recibe initialValue via key+defaultValue ──
// key en el padre fuerza remount con el valor correcto. Sin estado, sin efectos, nunca en blanco.
function VidaUtilInput({initialValue,onCommit}){
  return(
    <input
      type="number"
      min={1}
      defaultValue={initialValue>0?Math.round(initialValue):""}
      placeholder={initialValue>0?String(Math.round(initialValue)):"hs"}
      onBlur={e=>{const n=Number(e.target.value)||0;onCommit(n>0?n:initialValue);}}
      onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
      style={{width:72,background:"rgba(0,0,0,0.6)",border:"1px solid #f5c518aa",borderRadius:5,color:"#f5c518",
        fontWeight:700,fontSize:12,padding:"3px 6px",outline:"none",textAlign:"right",fontFamily:"Inter"}}
    />
  );
}

// ─── InsumoSearch — selector con búsqueda ────────────────────────────────────
function InsumoSearch({value,onChange,opciones}){
  const[open,setOpen]=useState(false);
  const[q,setQ]=useState("");
  const ref=useRef(null);
  const triggerRef=useRef(null);
  const[anchorPos,setAnchorPos]=useState({bottom:0,left:0,ready:false});

  // Cerrar al clickear afuera — ignorar clicks dentro del portal
  const portalRef=useRef(null);
  useEffect(()=>{
    const h=e=>{
      const inTrigger=ref.current&&ref.current.contains(e.target);
      const inPortal=portalRef.current&&portalRef.current.contains(e.target);
      if(!inTrigger&&!inPortal){setOpen(false);setQ("");}
    };
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  const filtered=useMemo(()=>{
    if(!q)return opciones;
    const ql=q.toLowerCase();
    return opciones.filter(([cod,nom])=>cod.toLowerCase().includes(ql)||nom.toLowerCase().includes(ql));
  },[opciones,q]);

  const selected=value?opciones.find(([cod])=>cod===value):null;
  const label=selected?`${selected[0]} — ${selected[1]}`:"Insumo";

  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <label style={{fontSize:10,color:"#888",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Insumo</label>
        <div ref={triggerRef} onClick={()=>{
            if(open){setOpen(false);setQ("");return;}
            const r=triggerRef.current?.getBoundingClientRect();
            if(!r)return;
            setAnchorPos({bottom:r.bottom,left:r.left,ready:true});
            setQ("");
            setOpen(true);
          }}
          style={{background:"#1a1a1a",border:`1px solid ${value?"#e8001d44":"#2a2a2a"}`,borderRadius:7,color:value?"#e8001d":"#aaa",padding:"7px 10px",fontSize:11,cursor:"pointer",minWidth:180,maxWidth:240,display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,userSelect:"none"}}>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{label}</span>
          <span style={{fontSize:9,flexShrink:0}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&anchorPos.ready&&ReactDOM.createPortal(
        <div ref={portalRef} style={{position:"fixed",top:anchorPos.bottom+4,left:anchorPos.left,zIndex:99999,background:"#1c1c1c",border:"1px solid #333",borderRadius:9,minWidth:280,maxWidth:340,boxShadow:"0 8px 24px rgba(0,0,0,.6)",overflow:"hidden",contain:"layout paint",willChange:"transform"}}>
          <div style={{padding:"8px 10px",borderBottom:"1px solid #2a2a2a"}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Buscar por código o nombre..."
              style={{width:"100%",background:"#111",border:"1px solid #333",borderRadius:6,color:"#eee",padding:"6px 10px",fontSize:11,outline:"none",fontFamily:"Inter"}}/>
          </div>
          <div style={{maxHeight:260,overflowY:"auto"}}>
            <div onClick={()=>{onChange("");setOpen(false);setQ("");}}
              style={{padding:"8px 12px",cursor:"pointer",color:"#888",fontSize:11,borderBottom:"1px solid #1a1a1a",background:!value?"#2a2a2a":"transparent"}}>
              Todos los insumos
            </div>
            {filtered.slice(0,100).map(([cod,nom])=>(
              <div key={cod} onClick={()=>{onChange(cod);setOpen(false);setQ("");}}
                style={{padding:"8px 12px",cursor:"pointer",fontSize:11,color:value===cod?"#e8001d":"#ccc",background:value===cod?"#2a0a0a":"transparent",borderBottom:"1px solid #1a1a1a",display:"flex",gap:8,alignItems:"center"}}
                onMouseEnter={e=>e.currentTarget.style.background=value===cod?"#3a0a0a":"#252525"}
                onMouseLeave={e=>e.currentTarget.style.background=value===cod?"#2a0a0a":"transparent"}
              >
                <span style={{color:"#888",flexShrink:0,minWidth:40}}>{cod}</span>
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nom}</span>
              </div>
            ))}
            {filtered.length>100&&<div style={{padding:"6px 12px",color:"#666",fontSize:10,textAlign:"center"}}>Mostrando 100 de {filtered.length} — seguí escribiendo para filtrar</div>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


function CodeMultiSearch({value,onChange,options,label="Código"}){
  const[open,setOpen]=useState(false);
  const[search,setSearch]=useState("");
  const[pos,setPos]=useState({top:0,left:0,width:310,ready:false});
  const ref=useRef(null);
  const btnRef=useRef(null);
  const selected=Array.isArray(value)?value:[];
  const isAll=!Array.isArray(value)||selected.length===0||value==="todos";
  const realOptions=(options||[]).filter(o=>o.value!=="todos");
  const filteredOptions=useMemo(()=>{
    const q=cleanKey(search);
    if(!q)return realOptions;
    return realOptions.filter(o=>cleanKey(o.value).includes(q)||cleanKey(o.label).includes(q));
  },[realOptions,search]);

  const updatePos=useCallback(()=>{
    const el=btnRef.current;
    if(!el)return null;
    const r=el.getBoundingClientRect();
    const width=310;
    let left=r.right-width;
    if(left<12)left=12;
    if(left+width>window.innerWidth-12)left=window.innerWidth-width-12;
    let top=r.bottom+6;
    const maxH=360;
    if(top+maxH>window.innerHeight-12)top=Math.max(12,r.top-maxH-6);
    const next={top,left,width,ready:true};
    setPos(next);
    return next;
  },[]);

  useEffect(()=>{
    const handler=e=>{
      if(ref.current&&ref.current.contains(e.target))return;
      if(e.target.closest&&e.target.closest('[data-code-multisearch-menu="true"]'))return;
      setOpen(false);
    };
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);

  useEffect(()=>{
    if(!open)return;
    updatePos();
    window.addEventListener("resize",updatePos);
    window.addEventListener("scroll",updatePos,true);
    return()=>{
      window.removeEventListener("resize",updatePos);
      window.removeEventListener("scroll",updatePos,true);
    };
  },[open,updatePos]);

  const emit=(arr)=>{
    const clean=[...new Set(arr.filter(Boolean).filter(v=>v!=="todos"))];
    if(clean.length===0||clean.length>=realOptions.length)onChange("todos");
    else onChange(clean);
  };
  const toggle=(v)=>{
    const s=new Set(selected);
    if(s.has(v))s.delete(v);else s.add(v);
    emit([...s]);
  };
  const selectedText=isAll?"Todos":(selected.length===1?selected[0]:`${selected.length} códigos`);

  const menu=(open&&pos.ready)?ReactDOM.createPortal(
    <div data-code-multisearch-menu="true" style={{position:"fixed",left:pos.left,top:pos.top,zIndex:1000000,width:pos.width,maxHeight:360,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 18px 50px rgba(0,0,0,.75)",padding:8,contain:"layout paint",willChange:"transform"}}>
      <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar código o insumo..." style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:12,outline:"none",marginBottom:8}}/>
      <button type="button" onClick={()=>onChange("todos")} style={{width:"100%",textAlign:"left",background:isAll?C.blueDim:"transparent",border:"none",borderRadius:7,color:isAll?C.blue:C.textSub,padding:"7px 8px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter"}}>Todos</button>
      <div style={{height:1,background:C.border,margin:"6px 0"}}/>
      <div style={{maxHeight:250,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
        {filteredOptions.length===0?(
          <div style={{padding:12,color:C.textMuted,fontSize:12,textAlign:"center"}}>Sin códigos coincidentes</div>
        ):filteredOptions.map(o=>{
          const checked=!isAll&&selected.includes(o.value);
          return(
            <label key={o.value} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:7,cursor:"pointer",background:checked?C.blueDim:"transparent",color:checked?C.text:C.textSub,fontSize:12}}>
              <input type="checkbox" checked={checked} onChange={()=>toggle(o.value)} style={{accentColor:C.blue}}/>
              <span style={{color:C.blue,fontWeight:800,minWidth:52}}>{o.value}</span>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label.replace(`${o.value} — `,"")}</span>
            </label>
          );
        })}
      </div>
    </div>,
    document.body
  ):null;

  return(
    <div ref={ref} style={{position:"relative",minWidth:230}}>
      <button ref={btnRef} type="button" onClick={()=>{if(open){setOpen(false);return;}const next=updatePos();if(next)setOpen(true);}} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,background:C.surface,border:`1px solid ${isAll?C.border:C.blue+"88"}`,borderRadius:8,color:isAll?C.textSub:C.blue,padding:"8px 10px",fontSize:12,fontWeight:700,fontFamily:"Inter",cursor:"pointer"}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}: {selectedText}</span>
        <Icon name="chevronDown" size={14} color={isAll?C.textMuted:C.blue}/>
      </button>
      {menu}
    </div>
  );
}


// ─── ViewCostosUnitarios ──────────────────────────────────────────────────────
function ViewCostosUnitariosInner({insumos,rma15,usdRate}){
  const[search,setSearch]=useState("");
  const[panel,setPanel]=useState("unitarios");

  const rows=useMemo(()=>{
    return Object.entries(insumos||{}).map(([codigo,info])=>{
      const precioARS=toMoneyNumber(info?.costoUnitario ?? getValue(info||{},["COSTO UNITARIO","Costo Unitario","Costo unitario","Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA","Precio unitario","PRECIO UNITARIO","Precio","PRECIO","Costo","COSTO"]));
      const articulo=String(info?.descripcion||getValue(info||{},["DESCRIPCIÓN","DESCRIPCION","Descripción","Descripcion","descripcion","Artículo","Articulo","ARTICULO","Insumo","Nombre"])||"").trim()||codigo;
      const extra=String(info?.descripcionAdicional||"").trim()||getInsumoExtra(info||{},articulo);
      return{
        codigo,
        articulo,
        descripcionAdicional:extra,
        precioARS,
        precioUSD:usdRate&&precioARS>0 ? precioARS/usdRate : 0,
      };
    }).sort((a,b)=>String(a.codigo).localeCompare(String(b.codigo),"es-AR",{numeric:true,sensitivity:"base"}));
  },[insumos,usdRate]);

  const q=cleanKey(search);
  const filtered=useMemo(()=>{
    if(!q)return rows;
    return rows.filter(r=>cleanKey(r.codigo).includes(q)||cleanKey(r.articulo).includes(q));
  },[rows,q]);

  const mayorPrecio=useMemo(()=>{
    return [...filtered]
      .filter(r=>Number(r.precioARS)>0)
      .sort((a,b)=>(Number(b.precioARS)||0)-(Number(a.precioARS)||0))[0]||null;
  },[filtered]);

  const codigosSinPrecio=useMemo(()=>{
    const m={};
    const anioActual=String(new Date().getFullYear());
    const fechaMinima=`${anioActual}-06-01`;
    const escHtml=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
    const fmtFechaISO=iso=>{
      const f=normDate(iso);
      if(!f)return "—";
      const [y,m,d]=f.split("-");
      return `${d}/${m}/${y}`;
    };

    // Acepta códigos alfanuméricos y también códigos totalmente numéricos (ej.: 154).
    // Solo se excluyen valores vacíos o marcadores que no representan un artículo real.
    const esCodigoValido=(v)=>{
      const c=normalizeInsumoCode(v);
      if(!c||c.length>60)return false;
      if(["0","-","--","S/C","SC","SINCODIGO","SIN-CODIGO","N/A","NA","NOAPLICA"].includes(c))return false;
      return /^[A-Z0-9._/-]+$/.test(c) && /\d/.test(c);
    };

    const insumosPorCodigo=new Map(
      Object.entries(insumos||{}).map(([codigo,info])=>[normalizeInsumoCode(codigo),info])
    );

    (rma15||[]).forEach(r=>{
      const fecha=normDate(r?.fecha);
      if(!fecha||fecha<fechaMinima)return;

      (r.insumos||[]).forEach(i=>{
        const codigo=normalizeInsumoCode(i.codigo);
        if(!codigo||!esCodigoValido(codigo))return;

        const infoCosto=insumosPorCodigo.get(codigo);
        const existe=!!infoCosto;
        const precio=Number(infoCosto?.costoUnitario??i.costoUnitario??0);
        if(!existe||precio<=0){
          if(!m[codigo])m[codigo]={
            codigo,
            descripcion:String(i.nombre||codigo).trim()||codigo,
            motivo:existe?"Sin precio asignado":"No está en costos unitarios",
            usos:0,
            usosDetalle:[]
          };
          m[codigo].usos+=1;
          m[codigo].usosDetalle.push({
            fecha,
            equipo:r?.maquina||r?.equipo||r?.codigoEquipo||"—",
            proyecto:r?.proyecto||r?.lugar||"—"
          });
          if((m[codigo].descripcion===codigo||!m[codigo].descripcion)&&i.nombre)m[codigo].descripcion=String(i.nombre).trim();
        }
      });
    });
    return Object.values(m).map(row=>{
      const detalle=[...(row.usosDetalle||[])]
        .sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||"")))
        .slice(0,12);
      const detalleHtml=detalle.length
        ? detalle.map(d=>`<tr><td style="padding:5px 8px;border-bottom:1px solid ${C.border}55;color:${C.text}">${escHtml(fmtFechaISO(d.fecha))}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.border}55;color:${C.text};font-weight:800">${escHtml(d.equipo)}</td><td style="padding:5px 8px;border-bottom:1px solid ${C.border}55;color:${C.text}">${escHtml(d.proyecto)}</td></tr>`).join("")
        : `<tr><td colspan="3" style="padding:6px 8px;color:${C.textMuted}">Sin detalle disponible</td></tr>`;
      return{
        ...row,
        _tooltipKey:`sinprecio-${row.codigo}`,
        _rowTooltipHtml:`
          <div style="min-width:340px">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:8px">
              <div>
                <div style="font-size:10px;color:${C.textMuted};text-transform:uppercase;letter-spacing:.06em;font-weight:900">Código sin precio</div>
                <div style="color:${C.blue};font-weight:900;font-size:15px;margin-top:2px">${escHtml(row.codigo)}</div>
              </div>
            </div>
            <div style="color:${C.text};font-weight:800;margin-bottom:10px;line-height:1.25">${escHtml(row.descripcion)}</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead><tr>
                <th style="padding:5px 8px;text-align:left;color:${C.textMuted};text-transform:uppercase;font-size:9px;letter-spacing:.06em;border-bottom:1px solid ${C.border}">Día</th>
                <th style="padding:5px 8px;text-align:left;color:${C.textMuted};text-transform:uppercase;font-size:9px;letter-spacing:.06em;border-bottom:1px solid ${C.border}">Equipo</th>
                <th style="padding:5px 8px;text-align:left;color:${C.textMuted};text-transform:uppercase;font-size:9px;letter-spacing:.06em;border-bottom:1px solid ${C.border}">Proyecto</th>
              </tr></thead>
              <tbody>${detalleHtml}</tbody>
            </table>
          </div>`
      };
    }).sort((a,b)=>String(a.codigo).localeCompare(String(b.codigo),"es-AR",{numeric:true,sensitivity:"base"}));
  },[rma15,insumos]);

  const colsSinPrecio=[
    {key:"codigo",label:"Código",width:130,render:v=><span style={{fontFamily:"monospace",fontWeight:800,color:C.blue}}>{v}</span>},
    {key:"descripcion",label:"Descripción",wrap:true},
    {key:"motivo",label:"Motivo",width:190,render:v=><span style={{color:v==="Sin precio asignado"?C.yellow:C.red,fontWeight:800}}>{v}</span>},
    {key:"usos",label:"Usos",align:"right",width:90,render:v=>fmtNum(v)},
  ];

  const cols=[
    {key:"codigo",label:"Código",width:120,render:v=><span style={{fontFamily:"monospace",fontWeight:700,color:C.text}}>{v}</span>},
    {key:"articulo",label:"Artículo / Descripción",wrap:true},
    {key:"descripcionAdicional",label:"Descripción adicional",wrap:true},
    {key:"precioARS",label:"Costo en ARS",align:"right",width:150,render:v=>fmtARS(Number(v)||0)},
    {key:"precioUSD",label:"Costo en USD",align:"right",width:140,render:v=><span style={{color:C.green,fontWeight:700}}>{fmtUSD(Number(v)||0,1)}</span>},
  ];

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <StatCard icon="dollar" label="Artículos" value={fmtNum(rows.length)} sub="Base de datos costos" color={C.yellow} small/>
        <StatCard icon="filter" label="Resultado filtrado" value={fmtNum(filtered.length)} sub={search?"Según búsqueda actual":"Sin búsqueda aplicada"} color={C.blue} small/>
        <StatCard icon="warn" label="Mayor costo unitario" value={mayorPrecio?fmtARS(mayorPrecio.precioARS):"—"} sub={mayorPrecio?`${mayorPrecio.codigo} — ${mayorPrecio.articulo}`:"Sin datos"} color={C.red} small/>
        <StatCard icon="warn" label="Códigos sin precio" value={fmtNum(codigosSinPrecio.length)} sub="Usados en RMA15 sin costo valorizado" color={C.red} small/>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button type="button" onClick={()=>setPanel("unitarios")} style={{background:panel==="unitarios"?C.red:C.surface,border:`1px solid ${panel==="unitarios"?C.red:C.border}`,borderRadius:8,color:C.text,padding:"9px 16px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Inter",display:"inline-flex",alignItems:"center",gap:8}}>Costos unitarios <span style={{background:panel==="unitarios"?"rgba(255,255,255,.22)":C.blueDim,border:`1px solid ${panel==="unitarios"?"rgba(255,255,255,.38)":C.blue+"55"}`,color:panel==="unitarios"?"#fff":C.blue,borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:900,lineHeight:1}}>{fmtNum(filtered.length)}</span></button>
        <button type="button" onClick={()=>setPanel("sinPrecio")} style={{background:panel==="sinPrecio"?C.red:C.surface,border:`1px solid ${panel==="sinPrecio"?C.red:C.border}`,borderRadius:8,color:C.text,padding:"9px 16px",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"Inter",display:"inline-flex",alignItems:"center",gap:8}}>Códigos sin precio <span style={{background:panel==="sinPrecio"?"rgba(255,255,255,.22)":C.redDim,border:`1px solid ${panel==="sinPrecio"?"rgba(255,255,255,.38)":C.red+"55"}`,color:panel==="sinPrecio"?"#fff":C.red,borderRadius:999,padding:"2px 8px",fontSize:11,fontWeight:900,lineHeight:1}}>{fmtNum(codigosSinPrecio.length)}</span></button>
      </div>

      {panel==="unitarios"?(
        <Card title="Costos unitarios" action={
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <BtnExcel onClick={()=>excelFromCols(cols,filtered,"Costos_Unitarios")}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar código o artículo..." style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:12,minWidth:280,outline:"none"}}/>
          </div>
        }>
          <Table cols={cols} rows={filtered} maxH={720} emptyMsg="Sin costos unitarios para mostrar" disableTooltip/>
        </Card>
      ):(
        <Card title="Códigos sin precio" action={<BtnExcel onClick={()=>generarExcelCodigosSinPrecio(codigosSinPrecio)}/>}>
          <Table cols={colsSinPrecio} rows={codigosSinPrecio} maxH={720} emptyMsg="No hay códigos sin precio para mostrar"/>
        </Card>
      )}
    </div>
  );
}

export default function ViewCostosUnitarios({deps,...props}){ applyDeps(deps); return <ViewCostosUnitariosInner {...props}/>; }

export { BtnExcel, ParamInput, CategoriaModeloTableRow, AmortRow, CodeMultiSearch };
