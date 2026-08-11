import React, { useState, useCallback, useMemo, useEffect, useRef, startTransition } from "react";
import ReactDOM from "react-dom";
import { clearSharedStock, uploadStockExcel } from "../../services/stockService.js";
import { registerRefreshTask } from "../../services/refreshManager.js";
import { useSharedStock } from "./stock/useSharedStock.js";
import { stockValidationSummary, validateStockWorkbook } from "./stock/stockValidation.js";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } from "recharts";

const RABA03_COLUMNS = [
  {key:"numeroSolicitud", label:"N° de solicitud", width:120},
  {key:"nSolicitud", label:"N° de pedido", width:110},
  {key:"empresa", label:"Empresa", width:120},
  {key:"fechaSolicitud", label:"Fecha de solicitud", width:135},
  {key:"fechaRequerida", label:"Fecha requerida", width:135},
  {key:"pedidoPor", label:"Pedido por", width:150},
  {key:"centroCosto", label:"Centro de Costo", width:140},
  {key:"codigoArticulo", label:"Código de artículo", width:140},
  {key:"descripcion", label:"Descripción de lo que se pidió", width:280},
  {key:"cantidadSolicitada", label:"Cant. Solicitada", align:"right", width:130},
  {key:"cantidadEnviada", label:"Cant. enviada", align:"right", width:120},
  {key:"cantidadRestante", label:"Cant. restante", align:"right", width:125}
];

const RABA03_EXPORT_COLUMNS = RABA03_COLUMNS.filter(c=>c.key!=="cantidadRestante");
const RABA03_EXTRA_COLUMNS = [
  {key:"numeroRemito", label:"Nº Remito", width:130},
  {key:"fechaSalida", label:"Fecha de salida", width:130},
  {key:"cantidadRemito", label:"Cantidad", align:"right", width:105},
  {key:"indicador", label:"Indicador", align:"right", width:105}
];

const RABA08_STORAGE_KEY = "dm_raba08_remitos_v1";
const RABA03_REJECTED_STORAGE_KEY = "dm_raba03_solicitudes_rechazadas_v1";
const RABA03_CLOSED_STORAGE_KEY = "dm_raba03_solicitudes_cerradas_manual_v1";
const STOCK_CONTROL_COLUMNS = [
  {key:"codigoArticulo", label:"Cód. artículo", width:112},
  {key:"descripcion", label:"Descripción", width:245},
  {key:"descripcionAdicional", label:"Desc. Adicional", width:245},
  {key:"descripcionDeposito", label:"Descripción depósito", width:210},
  {key:"controlStock", label:"U.m. control stock", width:92},
  {key:"saldoControlStock", label:"Saldo control stock", align:"right", width:115, numeric:true},
  {key:"stockMaximo", label:"Stock máximo", align:"right", width:105, numeric:true},
  {key:"stockMinimo", label:"Stock mínimo", align:"right", width:105, numeric:true},
];

export function AbastecimientoModule({initialTab="solicitudes",readOnly=false,assignedProject="TODO",deps={}}={}){
  const {
    APPS_SCRIPT_URL, C, Card, DateIn, Icon, LoadingMotoniveladora, MultiSel, PeriodMonthYear,
    StatCard, TabBtn, appAlert, appConfirm, dmProjectMatches, fmtFecha, fmtNum, matchMulti, multiIsAll
  } = deps;
  const [rows,setRows]=useState([]);
  const [rejectedSolicitudes,setRejectedSolicitudes]=useState(()=>{
    try{return JSON.parse(window.localStorage.getItem(RABA03_REJECTED_STORAGE_KEY)||"{}");}
    catch(_){return {};}
  });
  const [closedSolicitudes,setClosedSolicitudes]=useState(()=>{
    try{return JSON.parse(window.localStorage.getItem(RABA03_CLOSED_STORAGE_KEY)||"{}");}
    catch(_){return {};}
  });
  const [rejectModal,setRejectModal]=useState({open:false,row:null,observacion:""});
  // Las vistas basadas en RABA03 deben entrar en estado de carga desde el
  // primer render. De este modo no se muestran cards/tablas transitoriamente
  // en cero mientras se sincronizan remitos, estados y solicitudes.
  const [loading,setLoading]=useState(()=>!["remito","stock","stockDashboard"].includes(initialTab));
  const [actionLoading,setActionLoading]=useState("");
  const [selectedCloseKeys,setSelectedCloseKeys]=useState(()=>new Set());
  const [selectedReopenKeys,setSelectedReopenKeys]=useState(()=>new Set());
  const [error,setError]=useState(null);
  const [tab,setTab]=useState(initialTab);
  useEffect(()=>{setTab(initialTab);setSelectedCloseKeys(new Set());},[initialTab]);
  const [query,setQuery]=useState("");
  const [project,setProject]=useState("todos");
  const [company,setCompany]=useState("todos");
  const [supervisor,setSupervisor]=useState("todos");
  const [rabaFilterMode,setRabaFilterMode]=useState("dia");
  const [rabaDate,setRabaDate]=useState("");
  const [rabaDateFrom,setRabaDateFrom]=useState("");
  const [rabaDateTo,setRabaDateTo]=useState("");
  const [sort,setSort]=useState({key:"nSolicitud",dir:"asc"});
  const [remitos,setRemitos]=useState(()=>{
    try{return JSON.parse(window.localStorage.getItem(RABA08_STORAGE_KEY)||"[]");}
    catch(_){return [];} 
  });
  const [remitoForm,setRemitoForm]=useState({
    comprobante:"",
    fecha:new Date().toISOString().slice(0,10),
    origen:"01 DEPOSITO CENTRAL",
    destino:"",
    observaciones:"",
    items:[{codigo:"",descripcion:"",cantidad:""}]
  });
  const [remitosPendientes,setRemitosPendientes]=useState([]);
  const [remitoSearch,setRemitoSearch]=useState("");
  const [remitoDetalleId,setRemitoDetalleId]=useState(null);
  const stockErrorHandler=useCallback(message=>setError(message),[]);
  const {rows:stockRows,setRows:setStockRows,meta:stockMeta,setMeta:setStockMeta,loading:stockLoading,setLoading:setStockLoading,phase:stockPhase,setPhase:setStockPhase}=useSharedStock(APPS_SCRIPT_URL,stockErrorHandler);
  const stockFileName=stockMeta?.fileName||"";
  const STOCK_FILTER_COLUMNS = STOCK_CONTROL_COLUMNS.filter(c=>["codigoArticulo","descripcion","descripcionDeposito"].includes(c.key));
  const [stockFilters,setStockFilters]=useState({codigoArticulo:"todos",descripcion:"todos",descripcionDeposito:"todos"});
  const [stockSort,setStockSort]=useState({key:null,dir:null});
  const [stockVisibleLimit,setStockVisibleLimit]=useState(350);
  const [codigoEdits,setCodigoEdits]=useState({});
  const [importModal,setImportModal]=useState({
    open:false,
    loading:false,
    fileName:"",
    rows:[],
    message:"",
    error:""
  });
  const [successAlert,setSuccessAlert]=useState(null);
  const raba03TopScrollRef=useRef(null);
  const raba03TableScrollRef=useRef(null);
  const raba03InitialLoadDoneRef=useRef(false);
  const rawRaba03RowsRef=useRef([]);
  const remitosSharedSignatureRef=useRef("");
  const estadosSharedSignatureRef=useRef("");
  const canClearSharedStock=["ADMIN","ADMINISTRADOR"].includes(String(sessionStorage.getItem("dm_role")||"").trim().toUpperCase());

  useEffect(()=>{
    try{window.localStorage.setItem(RABA08_STORAGE_KEY,JSON.stringify(remitos));}
    catch(_){}
  },[remitos]);
  useEffect(()=>{
    try{window.localStorage.setItem(RABA03_REJECTED_STORAGE_KEY,JSON.stringify(rejectedSolicitudes||{}));}
    catch(_){}
  },[rejectedSolicitudes]);

  useEffect(()=>{
    try{window.localStorage.setItem(RABA03_CLOSED_STORAGE_KEY,JSON.stringify(closedSolicitudes||{}));}
    catch(_){}
  },[closedSolicitudes]);

  useEffect(()=>{
    setStockVisibleLimit(350);
  },[stockFilters,stockSort]);

  const norm=useCallback((v)=>String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(),[]);
  const normCode=useCallback((v)=>String(v||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"").trim(),[]);
  const canonicalSupervisor=useCallback((v)=>{
    const tokens=String(v||"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g," ").trim().split(/\s+/).filter(Boolean);
    if(!tokens.length)return "";
    return [...tokens].sort((a,b)=>a.localeCompare(b,"es")).join(" ");
  },[]);
  const normalizeCentroCosto=useCallback((v)=>{
    const raw=String(v||"").trim();
    const t=norm(raw);
    if(!t)return "";

    const compact=t.replace(/\s+/g,"");
    const tokens=t.split(/\s+/).filter(Boolean);
    const editDistance=(a,b)=>{
      a=String(a||""); b=String(b||"");
      if(!a)return b.length;
      if(!b)return a.length;
      const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
      for(let i=0;i<=a.length;i++)dp[i][0]=i;
      for(let j=0;j<=b.length;j++)dp[0][j]=j;
      for(let i=1;i<=a.length;i++){
        for(let j=1;j<=b.length;j++){
          const cost=a[i-1]===b[j-1]?0:1;
          dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+cost);
        }
      }
      return dp[a.length][b.length];
    };
    const closeTo=(candidate,target,maxDiff=3)=>{
      const c=norm(candidate).replace(/\s+/g,"");
      const tg=norm(target).replace(/\s+/g,"");
      if(!c||!tg)return false;
      if(c.includes(tg)||tg.includes(c))return true;
      return editDistance(c,tg)<=maxDiff;
    };
    const hasFuzzyPhrase=(target,maxDiff=3)=>{
      const targetWords=norm(target).split(/\s+/).filter(Boolean);
      const n=targetWords.length;
      const candidates=[t,compact];
      for(let i=0;i<=tokens.length-n;i++)candidates.push(tokens.slice(i,i+n).join(" "));
      for(let i=0;i<tokens.length;i++){
        for(let len=Math.max(1,n-1);len<=Math.min(tokens.length-i,n+1);len++){
          candidates.push(tokens.slice(i,i+len).join(" "));
        }
      }
      return candidates.some(c=>closeTo(c,target,maxDiff));
    };

    if(
      t.includes("jose maria")||compact.includes("josemaria")||
      /\bjm\b/.test(t)||hasFuzzyPhrase("jose maria",3)
    )return "JOSE MARIA";

    if(
      t.includes("filo del sol")||compact.includes("filodelsol")||
      /\bfs\b/.test(t)||/\bfds\b/.test(t)||
      hasFuzzyPhrase("filo del sol",3)
    )return "FILO DEL SOL";

    if(t.includes("oficina")||t.includes("deposito")||t.includes("depósito")||t.includes("admin"))return "OFICINA";
    return raw.toUpperCase();
  },[norm]);

  const normalizeEmpresa=useCallback((v)=>{
    const raw=String(v||"").trim();
    const t=norm(raw);
    if(!t)return "";
    if(t.includes("delta"))return "DELTA MINING";
    if(t.includes("minera jose maria")||t.includes("jose maria"))return "JOSE MARIA";
    if(t.includes("filo del sol")||t.includes("filo"))return "FILO DEL SOL";
    return raw.toUpperCase().replace(/\s+/g," ").trim();
  },[norm]);

  const pick=useCallback((obj,names)=>{
    const keys=Object.keys(obj||{});
    for(const name of names){
      const wanted=norm(name);
      const exact=keys.find(k=>norm(k)===wanted);
      if(exact!==undefined)return obj[exact];
    }
    for(const name of names){
      const wanted=norm(name);
      const partial=keys.find(k=>{
        const nk=norm(k);
        return nk && (nk.includes(wanted)||wanted.includes(nk));
      });
      if(partial!==undefined)return obj[partial];
    }
    return "";
  },[norm]);

  const formatDateLocal=useCallback((v)=>{
    if(v===null||v===undefined||v==="")return "";
    if(v instanceof Date&&!isNaN(v.getTime()))return fmtFecha(v);
    const txt=String(v).trim();
    if(!txt)return "";
    if(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(txt))return txt;
    const iso=txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso)return `${iso[3]}/${iso[2]}/${iso[1].slice(-2)}`;
    const d=new Date(txt);
    if(!isNaN(d.getTime()))return fmtFecha(d);
    return txt;
  },[]);

  const toNumber=useCallback((v)=>{
    if(v===null||v===undefined||v==="")return 0;
    if(typeof v==="number")return isFinite(v)?v:0;

    let txt=String(v).trim();
    if(!txt)return 0;

    // RABA08 usa punto decimal: 10.00 debe ser 10, no 1000.
    // Solo se eliminan puntos cuando realmente parecen separadores de miles.
    txt=txt.replace(/\s/g,"");

    const hasComma=txt.includes(",");
    const hasDot=txt.includes(".");

    if(hasComma&&hasDot){
      // Formato argentino posible: 1.234,56
      txt=txt.replace(/\./g,"").replace(",",".");
    }else if(hasComma){
      // Decimal con coma: 10,50
      txt=txt.replace(",",".");
    }else if(hasDot){
      const parts=txt.split(".");
      const isThousands=parts.length>1&&parts.slice(1).every(part=>part.length===3);
      if(isThousands){
        txt=parts.join("");
      }
      // Si no es miles, se deja como decimal: 10.00 -> 10
    }

    const n=Number(txt);
    return isNaN(n)?0:n;
  },[]);

  const buildRemitosCompartidos=useCallback((sheetRows=[])=>{
    const read=(obj,names)=>{
      const keys=Object.keys(obj||{});
      for(const name of names){
        const wanted=norm(name);
        const exact=keys.find(k=>norm(k)===wanted);
        if(exact!==undefined)return obj[exact];
      }
      for(const name of names){
        const wanted=norm(name);
        const partial=keys.find(k=>{
          const nk=norm(k);
          return nk&&(nk.includes(wanted)||wanted.includes(nk));
        });
        if(partial!==undefined)return obj[partial];
      }
      return "";
    };
    const grouped=new Map();
    (sheetRows||[]).forEach(row=>{
      const id=String(read(row,["ID_REMITO","idRemito","id"])||"").trim();
      const codigo=String(read(row,["CODIGO_ARTICULO","codigoArticulo","codigo"])||"").trim();
      const cantidad=toNumber(read(row,["CANTIDAD_ENVIADA","cantidadEnviada","cantidad"]));
      if(!id||!codigo||cantidad<=0)return;
      if(!grouped.has(id)){
        const observaciones=String(read(row,["OBSERVACIONES","observaciones"])||"").trim();
        const destino=String(read(row,["DESTINO","destino"])||"").trim();
        const origen=String(read(row,["ORIGEN","origen"])||"").trim();
        const proyecto=normalizeCentroCosto(read(row,["PROYECTO","proyecto"])||observaciones||destino||origen);
        grouped.set(id,{
          id,
          comprobante:String(read(row,["N_REMITO","nRemito","comprobante"])||"S/N").trim(),
          fecha:String(read(row,["FECHA_REMITO","fechaRemito","fecha"])||"").trim(),
          origen,
          destino,
          proyecto,
          observaciones,
          createdAt:String(read(row,["FECHA_CARGA_APP","fechaCargaApp","createdAt"])||"").trim(),
          usuarioCarga:String(read(row,["USUARIO_CARGA","usuarioCarga","usuario"])||"").trim(),
          shared:true,
          items:[]
        });
      }
      grouped.get(id).items.push({
        codigo,
        descripcion:String(read(row,["DESCRIPCION","descripcion"])||"").trim(),
        cantidad
      });
    });
    return Array.from(grouped.values()).sort((a,b)=>String(b.fecha||"").localeCompare(String(a.fecha||""))||String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  },[norm,toNumber,normalizeCentroCosto]);


  const fechaSolicitudISO=useCallback((v)=>{
    const txt=String(v||"").trim();
    if(!txt)return "";
    const dm=txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if(dm){
      let y=Number(dm[3]);
      if(y<100)y+=2000;
      return `${String(y).padStart(4,"0")}-${String(dm[2]).padStart(2,"0")}-${String(dm[1]).padStart(2,"0")}`;
    }
    const iso=txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso)return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const d=new Date(txt);
    if(!isNaN(d.getTime()))return d.toISOString().slice(0,10);
    return "";
  },[]);

  const buildSolicitudStableKeyFromParts=useCallback((parts={})=>{
    const nSolicitud=String(parts.nSolicitud||parts.N_SOLICITUD||"").trim();
    const codigo=normCode(parts.codigoArticulo||parts.CODIGO_ARTICULO||"");
    const fechaISO=fechaSolicitudISO(parts.fechaSolicitud||parts.FECHA_SOLICITUD||parts.fecha||parts.FECHA||"");
    // Clave estable compartida entre PCs: número de solicitud + código + fecha de solicitud.
    // No depende de descripción, espacios, acentos, cantidad ni formato visual de fechas.
    return [normCode(nSolicitud),codigo,fechaISO].join("|");
  },[normCode,fechaSolicitudISO]);

  const postEstadoSolicitud=useCallback(async(action,payload={})=>{
    const res=await fetch(APPS_SCRIPT_URL,{
      method:"POST",cache:"no-store",redirect:"follow",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:new URLSearchParams({payload:JSON.stringify({action,...payload})}).toString()
    });
    if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
    const json=await res.json();
    if(!json.ok)throw new Error(json?.error?.message||"No se pudo sincronizar el estado de la solicitud.");
    return json;
  },[]);

  const loadEstadosSolicitudesCompartidos=useCallback(async({silent=true}={})=>{
    try{
      const res=await fetch(`${APPS_SCRIPT_URL}?action=estados_solicitudes&force=1&_=${Date.now()}`,{cache:"no-store",redirect:"follow"});
      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron leer los estados compartidos.");
      const closed={};
      const rejected={};
      (json.data||[]).forEach(r=>{
        const storedKey=String(r.CLAVE_SOLICITUD||r.clave||"").trim();
        const estado=String(r.ESTADO||r.estado||"").trim().toUpperCase();
        const info={
          observacion:String(r.OBSERVACION||r.observacion||"").trim(),
          nSolicitud:String(r.N_SOLICITUD||r.nSolicitud||"").trim(),
          codigoArticulo:String(r.CODIGO_ARTICULO||r.codigoArticulo||"").trim(),
          descripcion:String(r.DESCRIPCION||r.descripcion||"").trim(),
          fecha:String(r.FECHA||r.fecha||"").trim(),
          usuario:String(r.USUARIO||r.usuario||"").trim()
        };
        // Compatibilidad: toma la clave guardada y además genera la clave estable
        // a partir de los campos descriptivos para reconocer cierres antiguos.
        const stableKey=buildSolicitudStableKeyFromParts({
          nSolicitud:info.nSolicitud,
          codigoArticulo:info.codigoArticulo,
          fechaSolicitud:r.FECHA_SOLICITUD||r.fechaSolicitud||""
        });
        const keys=[storedKey,stableKey].filter(Boolean);
        keys.forEach(key=>{
          if(estado==="CERRADA_MANUAL"||estado==="CERRADA_REMITO")closed[key]={...info,tipoCierre:estado};
          else if(estado==="RECHAZADA")rejected[key]=info;
        });
      });
      const signature=JSON.stringify({closed,rejected});
      if(estadosSharedSignatureRef.current!==signature){
        estadosSharedSignatureRef.current=signature;
        setClosedSolicitudes(closed);
        setRejectedSolicitudes(rejected);
        try{
          window.localStorage.setItem(RABA03_CLOSED_STORAGE_KEY,JSON.stringify(closed));
          window.localStorage.setItem(RABA03_REJECTED_STORAGE_KEY,JSON.stringify(rejected));
        }catch(_){}
      }
      return {closed,rejected};
    }catch(err){
      console.warn("No se pudieron sincronizar los estados de solicitudes:",err);
      if(!silent)setError(err?.message||String(err));
      throw err;
    }
  },[buildSolicitudStableKeyFromParts]);

  const loadRemitosCompartidos=useCallback(async({silent=true}={})=>{
    try{
      const url=`${APPS_SCRIPT_URL}?action=remitos_cargados&limit=all&force=1&_=${Date.now()}`;
      const res=await fetch(url,{method:"GET",cache:"no-store",redirect:"follow"});
      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron leer los remitos cargados.");
      const shared=buildRemitosCompartidos(json.data||[]);
      // Sincronización realmente silenciosa: solo actualizar React si cambió el contenido.
      // Así el refresco automático no repinta Abastecimiento ni vuelve a cargar RABA03.
      const signature=JSON.stringify(shared);
      if(remitosSharedSignatureRef.current!==signature){
        remitosSharedSignatureRef.current=signature;
        setRemitos(shared);
        try{window.localStorage.setItem(RABA08_STORAGE_KEY,signature);}catch(_){}
      }
      return shared;
    }catch(err){
      console.warn("No se pudieron sincronizar remitos cargados:",err);
      if(!silent)setError(err?.message||String(err));
      throw err;
    }
  },[buildRemitosCompartidos]);

  useEffect(()=>{
    // La carga inicial completa se hace más abajo en forma secuencial. Este
    // efecto queda reservado para resincronizaciones periódicas y al recuperar
    // el foco, evitando dos consultas simultáneas al montar el módulo.
    const timer=window.setInterval(()=>{
      if(document.visibilityState==="visible"){
        loadRemitosCompartidos({silent:true}).catch(()=>{});
        loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
      }
    },30000);
    const onVisible=()=>{
      if(document.visibilityState==="visible"){
        loadRemitosCompartidos({silent:true}).catch(()=>{});
        loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
      }
    };
    window.addEventListener("focus",onVisible);
    document.addEventListener("visibilitychange",onVisible);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("focus",onVisible);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[loadRemitosCompartidos,loadEstadosSolicitudesCompartidos]);

  useEffect(()=>{
    if(tab==="remito")loadRemitosCompartidos({silent:true}).catch(()=>{});
    if(["solicitudes","pendientes","parciales","cerradas","rechazadas"].includes(tab)){
      loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
    }
  },[tab,loadRemitosCompartidos,loadEstadosSolicitudesCompartidos]);

  const saveRemitoCompartido=useCallback(async(remito)=>{
    const payload={
      ...remito,
      usuarioCarga:sessionStorage.getItem("dm_user")||"APP"
    };
    const res=await fetch(APPS_SCRIPT_URL,{
      method:"POST",
      cache:"no-store",
      redirect:"follow",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:new URLSearchParams({payload:JSON.stringify({action:"save_remito_cargado",remito:payload})}).toString()
    });
    if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
    const json=await res.json();
    if(!json.ok)throw new Error(json?.error?.message||"No se pudo guardar el remito en la hoja compartida.");
    return json;
  },[]);

  const filteredRemitos=useMemo(()=>{
    const q=norm(remitoSearch);
    if(!q)return remitos;
    return (remitos||[]).filter(rem=>norm(rem.comprobante).includes(q));
  },[remitos,remitoSearch,norm]);

  const buildSentByCode=useCallback((sourceRemitos=[])=>{
    const map={};
    (sourceRemitos||[]).forEach(remito=>{
      const proyecto=normalizeCentroCosto(remito.proyecto||remito.observaciones||remito.destino||remito.centroCosto||remito.origen||"");
      (remito.items||[]).forEach(item=>{
        const code=normCode(item.codigo);
        const qty=toNumber(item.cantidad);
        if(!code||qty<=0)return;
        const key=proyecto?`${code}__${proyecto}`:`${code}__*`;
        map[key]=(map[key]||0)+qty;
      });
    });
    return map;
  },[normCode,toNumber,normalizeCentroCosto]);

  const sentByCode=useMemo(()=>buildSentByCode(remitos),[remitos,buildSentByCode]);
  const sentByCodeRef=useRef(sentByCode);
  useEffect(()=>{sentByCodeRef.current=sentByCode;},[sentByCode]);

  const remitosByCode=useMemo(()=>{
    const map={};
    (remitos||[]).forEach(remito=>{
      const proyecto=normalizeCentroCosto(remito.proyecto||remito.observaciones||remito.destino||remito.centroCosto||remito.origen||"");
      (remito.items||[]).forEach(item=>{
        const code=normCode(item.codigo);
        const qty=toNumber(item.cantidad);
        if(!code||qty<=0)return;
        const keys=[`${code}__*`];
        if(proyecto)keys.push(`${code}__${proyecto}`);
        keys.forEach(key=>{
          if(!map[key])map[key]=[];
          map[key].push({
            numero:remito.comprobante||"",
            fecha:formatDateLocal(remito.fecha),
            cantidad:qty,
            lugar:remito.destino||remito.observaciones||remito.origen||"",
            insumo:item.descripcion||""
          });
        });
      });
    });
    return map;
  },[remitos,normCode,toNumber,normalizeCentroCosto,formatDateLocal]);

  const numeroSolicitudHistorica=useCallback((fecha)=>{
    const txt=formatDateLocal(fecha);
    const m=String(txt||"").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if(!m)return "";
    const dm=`${Number(m[1])}/${Number(m[2])}`;
    if(dm==="6/7")return "226";
    if(dm==="7/7")return "137";
    if(dm==="14/7")return "138";
    return "";
  },[formatDateLocal]);

  const normalizeRow=useCallback((r,idx,sentMap={})=>{
    // Para N° de solicitud / N° de pedido se exige coincidencia EXACTA de encabezado.
    // Así nunca se confunde "N° de pedido" con la columna "Pedido por".
    const pickExact=(obj,names)=>{
      const keys=Object.keys(obj||{});
      for(const name of names){
        const wanted=norm(name);
        const exact=keys.find(k=>norm(k)===wanted);
        if(exact!==undefined)return obj[exact];
      }
      return "";
    };
    const codigo=String(pick(r,["Código de articulo","Código de artículo","Codigo de articulo","Codigo de artículo","Código artículo","Codigo articulo","Código","Codigo"])||"").trim();
    const solicitada=toNumber(pick(r,["Cant. Solicitada","Cantidad solicitada","Cant Solicitada","Cantidad"]));
    const centroCostoRaw=String(pick(r,["Centro de Costo","Centro de costo","Proyecto","CC"])||"").trim();
    const centroCostoNorm=normalizeCentroCosto(centroCostoRaw);
    const codeNorm=normCode(codigo);
    const enviada=(sentMap[`${codeNorm}__${centroCostoNorm}`]||0)+(sentMap[`${codeNorm}__*`]||0);
    const restante=Math.max(0,solicitada-enviada);
    const pedidoRaw=pickExact(r,["N° de pedido","Nº de pedido","N de pedido","Numero de pedido","Número de pedido"]);
    const solicitudLegacy=pickExact(r,["N° de solicitud","Nº de solicitud","N de solicitud","Numero de solicitud","Número de solicitud","Solicitud"]);
    const fechaSolicitudRaw=pick(r,["Fecha de solicitud","Fecha solicitud","F. Sol."]);
    // Con el esquema nuevo, N° de solicitud y N° de pedido vienen en columnas separadas.
    // En una hoja antigua, la vieja columna N° de solicitud era en realidad el N° de pedido.
    const solicitudRaw=pedidoRaw!=="" ? solicitudLegacy : numeroSolicitudHistorica(fechaSolicitudRaw);
    return {
      id:`raba03-${idx}`,
      numeroSolicitud:String(solicitudRaw||"").trim(),
      nSolicitud:String(pedidoRaw||solicitudLegacy||idx+1).trim(),
      empresa:normalizeEmpresa(pick(r,["Empresa"])),
      fechaSolicitud:formatDateLocal(pick(r,["Fecha de solicitud","Fecha solicitud","F. Sol."])),
      fechaRequerida:formatDateLocal(pick(r,["Fecha requerida del producto","Fecha requerida","F. Req."])),
      pedidoPor:String(pick(r,["Pedido por","Solicitante"])||"").trim(),
      centroCosto:centroCostoNorm||centroCostoRaw,
      codigoArticulo:codigo,
      descripcion:String(pick(r,["Descripción de lo que se pidio","Descripción de lo que se pidió","Descripcion de lo que se pidio","Descripcion de lo que se pidió","Descripción","Descripcion"])||"").trim(),
      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante
    };
  },[formatDateLocal,pick,normCode,toNumber,normalizeCentroCosto,normalizeEmpresa,numeroSolicitudHistorica]);

  const buildSolicitudKey=useCallback((row)=>{
    return buildSolicitudStableKeyFromParts({
      nSolicitud:row.nSolicitud||row["N° de solicitud"]||row["Nº de solicitud"]||row["Solicitud"]||"",
      codigoArticulo:row.codigoArticulo||row["Código de articulo"]||row["Codigo de articulo"]||row["Código de artículo"]||"",
      fechaSolicitud:row.fechaSolicitud||row["Fecha de solicitud"]||""
    });
  },[buildSolicitudStableKeyFromParts]);

  const existingSolicitudKeys=useMemo(()=>new Set(rows.map(buildSolicitudKey)),[rows,buildSolicitudKey]);

  const openRejectSolicitud=useCallback((row)=>{
    setRejectModal({open:true,row,observacion:""});
  },[]);

  const confirmRejectSolicitud=useCallback(async()=>{
    const row=rejectModal.row;
    if(!row)return;
    const observacion=String(rejectModal.observacion||"").trim();
    if(!observacion){
      appAlert("Ingresá una observación para rechazar la solicitud.");
      return;
    }
    const key=buildSolicitudKey(row);
    try{
      await postEstadoSolicitud("save_estado_solicitud",{estado:{
        clave:key,estado:"RECHAZADA",observacion,
        nSolicitud:row.nSolicitud||"",codigoArticulo:row.codigoArticulo||"",
        descripcion:row.descripcion||"",fechaSolicitud:row.fechaSolicitud||"",usuario:sessionStorage.getItem("dm_user")||"APP"
      }});
      await loadEstadosSolicitudesCompartidos({silent:true});
      setRejectModal({open:false,row:null,observacion:""});
    }catch(err){appAlert("No se pudo guardar el rechazo para todos: "+(err?.message||err));}
  },[rejectModal,buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);

  const closeSolicitudManual=useCallback(async(row)=>{
    if(!row)return;
    const ok=await appConfirm("¿Cerrar esta solicitud parcial aunque no se hayan enviado todos los artículos?");
    if(!ok)return;
    const key=buildSolicitudKey(row);
    const info={
      observacion:"Cierre manual desde Parciales",
      nSolicitud:row.nSolicitud||"",
      codigoArticulo:row.codigoArticulo||"",
      descripcion:row.descripcion||"",
      fecha:row.fechaSolicitud||"",
      usuario:sessionStorage.getItem("dm_user")||"APP"
    };
    setActionLoading("Cerrando solicitud...");
    try{
      await postEstadoSolicitud("save_estado_solicitud",{estado:{
        clave:key,estado:"CERRADA_MANUAL",observacion:info.observacion,
        nSolicitud:info.nSolicitud,codigoArticulo:info.codigoArticulo,
        descripcion:info.descripcion,fechaSolicitud:row.fechaSolicitud||"",usuario:info.usuario
      }});
      // Reflejo inmediato en esta PC; la verificación compartida queda en segundo plano.
      setClosedSolicitudes(prev=>{
        const next={...(prev||{}),[key]:info};
        try{window.localStorage.setItem(RABA03_CLOSED_STORAGE_KEY,JSON.stringify(next));}catch(_){}
        return next;
      });
      loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
    }catch(err){
      await appAlert("No se pudo cerrar la solicitud para todos: "+(err?.message||err));
    }finally{
      setActionLoading("");
    }
  },[buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);

  const toggleSolicitudParaCerrar=useCallback((row)=>{
    if(!row)return;
    const key=buildSolicitudKey(row);
    setSelectedCloseKeys(prev=>{
      const next=new Set(prev);
      if(next.has(key))next.delete(key);
      else next.add(key);
      return next;
    });
  },[buildSolicitudKey]);

  const closeSelectedSolicitudes=useCallback(async()=>{
    const selectedRows=(rows||[]).filter(r=>selectedCloseKeys.has(buildSolicitudKey(r)));
    if(!selectedRows.length){
      await appAlert("Seleccioná al menos una solicitud para cerrar.");
      return;
    }
    const ok=await appConfirm(`¿Cerrar manualmente ${selectedRows.length} solicitud${selectedRows.length===1?"":"es"}?`);
    if(!ok)return;
    const usuario=sessionStorage.getItem("dm_user")||"APP";
    const estados=selectedRows.map(row=>({
      clave:buildSolicitudKey(row),
      estado:"CERRADA_MANUAL",
      observacion:"Cierre manual desde Parciales",
      nSolicitud:row.nSolicitud||"",
      codigoArticulo:row.codigoArticulo||"",
      descripcion:row.descripcion||"",
      fechaSolicitud:row.fechaSolicitud||"",
      usuario
    }));
    setActionLoading(`Cerrando ${selectedRows.length} solicitud${selectedRows.length===1?"":"es"}...`);
    try{
      await postEstadoSolicitud("save_estados_solicitudes_bulk",{estados});
      setClosedSolicitudes(prev=>{
        const next={...(prev||{})};
        estados.forEach(e=>{next[e.clave]={
          observacion:e.observacion,nSolicitud:e.nSolicitud,codigoArticulo:e.codigoArticulo,
          descripcion:e.descripcion,fecha:e.fechaSolicitud,usuario:e.usuario
        };});
        try{window.localStorage.setItem(RABA03_CLOSED_STORAGE_KEY,JSON.stringify(next));}catch(_){}
        return next;
      });
      setSelectedCloseKeys(new Set());
      loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
    }catch(err){
      await appAlert("No se pudieron cerrar las solicitudes: "+(err?.message||err));
    }finally{
      setActionLoading("");
    }
  },[rows,selectedCloseKeys,buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);

  const restoreRejectedSolicitud=useCallback(async(row)=>{
    if(!row)return;
    const key=buildSolicitudKey(row);
    try{
      await postEstadoSolicitud("delete_estado_solicitud",{clave:key});
      await loadEstadosSolicitudesCompartidos({silent:true});
    }catch(err){appAlert("No se pudo restaurar la solicitud para todos: "+(err?.message||err));}
  },[buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);

  const reopenManualClosedSolicitud=useCallback(async(row)=>{
    if(!row)return;
    const ok=await appConfirm("¿Reabrir esta solicitud cerrada manualmente?");
    if(!ok)return;
    const key=buildSolicitudKey(row);
    setActionLoading("Reabriendo solicitud...");
    try{
      await postEstadoSolicitud("delete_estado_solicitud",{clave:key});
      setClosedSolicitudes(prev=>{
        const next={...(prev||{})};
        delete next[key];
        try{window.localStorage.setItem(RABA03_CLOSED_STORAGE_KEY,JSON.stringify(next));}catch(_){}
        return next;
      });
      loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
    }catch(err){
      await appAlert("No se pudo reabrir la solicitud: "+(err?.message||err));
    }finally{
      setActionLoading("");
    }
  },[buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);

  const toggleSolicitudParaReabrir=useCallback((row)=>{
    if(!row)return;
    const key=buildSolicitudKey(row);
    setSelectedReopenKeys(prev=>{
      const next=new Set(prev);
      if(next.has(key))next.delete(key);
      else next.add(key);
      return next;
    });
  },[buildSolicitudKey]);

  const reopenSelectedSolicitudes=useCallback(async()=>{
    const selectedRows=(rows||[]).filter(r=>{
      const key=buildSolicitudKey(r);
      return selectedReopenKeys.has(key)&&Boolean(closedSolicitudes?.[key]);
    });
    if(!selectedRows.length){
      await appAlert("Seleccioná al menos una solicitud cerrada manualmente para reabrir.");
      return;
    }
    const ok=await appConfirm(`¿Reabrir ${selectedRows.length} solicitud${selectedRows.length===1?"":"es"}?`);
    if(!ok)return;
    const claves=selectedRows.map(r=>buildSolicitudKey(r));
    setActionLoading(`Reabriendo ${selectedRows.length} solicitud${selectedRows.length===1?"":"es"}...`);
    try{
      await postEstadoSolicitud("delete_estados_solicitudes_bulk",{claves});
      setClosedSolicitudes(prev=>{
        const next={...(prev||{})};
        claves.forEach(key=>{delete next[key];});
        try{window.localStorage.setItem(RABA03_CLOSED_STORAGE_KEY,JSON.stringify(next));}catch(_){}
        return next;
      });
      setSelectedReopenKeys(new Set());
      loadEstadosSolicitudesCompartidos({silent:true}).catch(()=>{});
    }catch(err){
      await appAlert("No se pudieron reabrir las solicitudes: "+(err?.message||err));
    }finally{
      setActionLoading("");
    }
  },[rows,selectedReopenKeys,closedSolicitudes,buildSolicitudKey,postEstadoSolicitud,loadEstadosSolicitudesCompartidos]);

  const mapRaba03Rows=useCallback((raw=[],sentMap={})=>raw.map((row,index)=>normalizeRow(row,index,sentMap)).filter(r=>
    [r.empresa,r.fechaSolicitud,r.fechaRequerida,r.pedidoPor,r.centroCosto,r.codigoArticulo,r.descripcion,r.cantidadSolicitada]
      .some(v=>String(v||"").trim()) &&
    !String(r.empresa||"").toLowerCase().includes("aprobado") &&
    !String(r.empresa||"").toLowerCase().includes("empresa")
  ),[normalizeRow]);

  const loadRaba03=useCallback(async({silent=false,remitosOverride=null}={})=>{
    if(!silent){
      setLoading(true);
      setError(null);
    }
    try{
      const url=`${APPS_SCRIPT_URL}?action=raba03&limit=all&_=${Date.now()}`;
      const res=await fetch(url,{cache:"no-store"});
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudo leer RABA03");
      const raw=Array.isArray(json.data)?json.data:(Array.isArray(json?.sources?.raba03?.data)?json.sources.raba03.data:[]);
      rawRaba03RowsRef.current=raw;
      const sentMap=Array.isArray(remitosOverride)?buildSentByCode(remitosOverride):sentByCodeRef.current;
      setRows(mapRaba03Rows(raw,sentMap));
    }catch(err){
      if(!silent){
        setError(err.message||String(err));
        setRows([]);
      }else{
        console.warn("No se pudo actualizar RABA03 silenciosamente:",err);
      }
    }finally{
      if(!silent)setLoading(false);
    }
  },[mapRaba03Rows,buildSentByCode]);

  // Carga inicial coordinada: primero se esperan los remitos y estados reales;
  // recién entonces se normaliza RABA03 con esas cantidades. Pasar los remitos
  // como argumento evita depender de que React haya completado setRemitos.
  useEffect(()=>{
    if(raba03InitialLoadDoneRef.current)return;
    raba03InitialLoadDoneRef.current=true;
    let cancelled=false;
    const run=async()=>{
      let sharedRemitos=null;
      try{sharedRemitos=await loadRemitosCompartidos({silent:true});}catch(_){}
      try{await loadEstadosSolicitudesCompartidos({silent:true});}catch(_){}
      if(cancelled)return;
      await loadRaba03({silent:false,remitosOverride:sharedRemitos});
    };
    run();
    return()=>{cancelled=true;};
  },[loadRaba03,loadRemitosCompartidos,loadEstadosSolicitudesCompartidos]);

  // Registro en el motor único de actualización de la aplicación.
  useEffect(()=>registerRefreshTask("abastecimiento",async()=>{
    let sharedRemitos=null;
    try{sharedRemitos=await loadRemitosCompartidos({silent:true});}catch(_){}
    await Promise.allSettled([
      loadRaba03({silent:true,remitosOverride:sharedRemitos}),
      loadEstadosSolicitudesCompartidos({silent:true})
    ]);
  },{views:["abastecimiento","abastecimientoDashboard","abastecimientoPendientes","abastecimientoParciales","abastecimientoCerradas","abastecimientoRechazadas","abastecimientoEnviosSinSolicitud","abastecimientoRemito","abastecimientoStock","abastecimientoStockDashboard","abastecimientoRABA03","abastecimientoEditarCodigos"],priority:20}),[loadRaba03,loadRemitosCompartidos,loadEstadosSolicitudesCompartidos]);

  // Cuando cambian los remitos compartidos, recalcular cantidades/estados usando la
  // copia de RABA03 ya cargada, sin nueva consulta y sin mostrar ningún loader.
  useEffect(()=>{
    if(!raba03InitialLoadDoneRef.current||!rawRaba03RowsRef.current.length)return;
    const refresh=()=>setRows(mapRaba03Rows(rawRaba03RowsRef.current,sentByCode));
    if(typeof window!=="undefined"&&window.requestIdleCallback){
      const id=window.requestIdleCallback(refresh,{timeout:500});
      return()=>window.cancelIdleCallback&&window.cancelIdleCallback(id);
    }
    const id=window.setTimeout(refresh,0);
    return()=>window.clearTimeout(id);
  },[remitos,mapRaba03Rows]);


  const handleSolicitudesExcelUpload=useCallback(async(file)=>{
    if(!file)return;
    try{
      setLoading(true);
      setError(null);
      setImportModal({open:false,loading:false,fileName:"",rows:[],message:"",error:""});

      const buffer=await file.arrayBuffer();
      const wb=XLSX.read(buffer,{type:"array",cellDates:true});
      const sheetName=wb.SheetNames[0];
      const ws=wb.Sheets[sheetName];
      const solicitudC3=String(ws?.["C3"]?.v??ws?.["C3"]?.w??"").trim();
      const solicitudMatch=solicitudC3.match(/(?:N[°º]?|NUMERO|NRO\.?)[^0-9]*(\d+)/i)||solicitudC3.match(/(\d+)/);
      const numeroSolicitudArchivo=solicitudMatch?String(solicitudMatch[1]):"";
      const rawRows=XLSX.utils.sheet_to_json(ws,{defval:"",raw:true,range:5});

      const pickExcel=(row,names)=>{
        const keys=Object.keys(row||{});
        for(const name of names){
          const wanted=norm(name);
          const exact=keys.find(k=>norm(k)===wanted);
          if(exact!==undefined)return row[exact];
        }
        for(const name of names){
          const wanted=norm(name);
          const partial=keys.find(k=>{
            const nk=norm(k);
            return nk&&(nk.includes(wanted)||wanted.includes(nk));
          });
          if(partial!==undefined)return row[partial];
        }
        return "";
      };

      const formatImportedExcelDate=(value)=>{
        if(value===null||value===undefined||value==="")return "";

        const pad=(n)=>String(n).padStart(2,"0");
        const format=(d)=>{
          if(!(d instanceof Date)||isNaN(d.getTime()))return "";
          return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
        };

        if(value instanceof Date){
          return format(value);
        }

        if(typeof value==="number"&&isFinite(value)){
          const parsed=XLSX.SSF&&XLSX.SSF.parse_date_code?XLSX.SSF.parse_date_code(value):null;
          if(parsed&&parsed.y&&parsed.m&&parsed.d){
            return `${pad(parsed.d)}/${pad(parsed.m)}/${parsed.y}`;
          }
        }

        const txt=String(value).trim();
        if(!txt)return "";

        const iso=txt.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if(iso){
          return `${pad(Number(iso[3]))}/${pad(Number(iso[2]))}/${Number(iso[1])}`;
        }

        const m=txt.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
        if(m){
          let a=Number(m[1]);
          let b=Number(m[2]);
          let y=Number(m[3]);
          if(y<100)y+=2000;

          // Los RABA01 exportados vienen como MM/DD/YYYY.
          // Si el primer número es mayor a 12, asumimos que ya venía DD/MM/YYYY.
          let day=a;
          let month=b;
          if(a<=12){
            month=a;
            day=b;
          }
          return `${pad(day)}/${pad(month)}/${y}`;
        }

        return txt;
      };

      const prepared=rawRows.map(row=>({
        numeroSolicitud:numeroSolicitudArchivo,
        empresa:normalizeEmpresa(pickExcel(row,["Empresa"] )),
        fechaSolicitud:formatImportedExcelDate(pickExcel(row,["Fecha de solicitud"] )),
        fechaRequerida:formatImportedExcelDate(pickExcel(row,["Fecha requerida del producto","Fecha requerida"] )),
        pedidoPor:String(pickExcel(row,["Autorizado por:","Autorizado por","Pedido por"] )||"").trim(),
        centroCosto:normalizeCentroCosto(pickExcel(row,["Centro de Costo","Centro de costo","Proyecto"] )||""),
        codigoArticulo:String(pickExcel(row,["Código de articulo","Código de artículo","Codigo de articulo","Codigo de artículo","Código artículo","Codigo articulo"] )||"").trim(),
        descripcion:String(pickExcel(row,["Descripción de lo que se pidio","Descripción de lo que se pidió","Descripcion de lo que se pidio","Descripcion de lo que se pidió","Descripción","Descripcion"] )||"").trim(),
        cantidadSolicitada:toNumber(pickExcel(row,["Cant.Solicitada","Cant. Solicitada","Cantidad solicitada","Cant Solicitada","Cantidad"] ))
      })).filter(row=>[
        row.numeroSolicitud,row.empresa,row.fechaSolicitud,row.fechaRequerida,row.pedidoPor,row.centroCosto,row.codigoArticulo,row.descripcion,row.cantidadSolicitada
      ].some(v=>String(v||"").trim()));

      if(!prepared.length){
        setImportModal({open:true,loading:false,fileName:file.name||"Excel de solicitudes",rows:[],message:"No encontré filas válidas. Revisá que el Excel tenga los encabezados en la fila 6.",error:""});
        return;
      }

      const keyCount=new Map();
      prepared.forEach(row=>{
        const k=buildSolicitudKey(row);
        keyCount.set(k,(keyCount.get(k)||0)+1);
      });
      const previewRows=prepared.map((row,idx)=>{
        const k=buildSolicitudKey(row);
        const repeatedInFile=(keyCount.get(k)||0)>1;
        const alreadyInBase=existingSolicitudKeys.has(k);
        return {...row,previewId:idx+1,estado:repeatedInFile?"Repetida":(alreadyInBase?"Ya existe":"Nueva")};
      });
      const repetidasArchivo=previewRows.filter(r=>r.estado==="Repetida").length;
      const yaExistentes=previewRows.filter(r=>r.estado==="Ya existe").length;
      const aviso=[];
      aviso.push(`Se detectaron ${previewRows.length} pedidos${numeroSolicitudArchivo?` de la solicitud N° ${numeroSolicitudArchivo}`:""}. Se agregarán TODOS como filas nuevas.`);
      if(!numeroSolicitudArchivo)aviso.push("No se pudo leer el número de solicitud desde la celda C3.");
      if(repetidasArchivo)aviso.push(`${repetidasArchivo} filas están repetidas dentro del archivo.`);
      if(yaExistentes)aviso.push(`${yaExistentes} filas parecen existir en la base actual.`);

      setImportModal({
        open:true,
        loading:false,
        fileName:file.name||"Excel de solicitudes",
        rows:previewRows,
        message:aviso.join(" "),
        error:""
      });
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      setImportModal({open:true,loading:false,fileName:file?.name||"Excel",rows:[],message:"",error:"Error leyendo el Excel: "+msg});
    }finally{
      setLoading(false);
    }
  },[norm,toNumber,normalizeCentroCosto,normalizeEmpresa,existingSolicitudKeys,buildSolicitudKey]);

  const confirmSolicitudesImport=useCallback(async()=>{
    const rowsToSend=(importModal.rows||[]).map(({previewId,estado,...row})=>row);
    if(!rowsToSend.length){
      setImportModal(prev=>({...prev,open:false}));
      return;
    }
    try{
      setImportModal(prev=>({...prev,loading:true,error:""}));
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        body:new URLSearchParams({payload:JSON.stringify({action:"add_raba03_rows_append_only",rows:rowsToSend})})
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron cargar las solicitudes en RABA03.");
      const inserted=Number(json.insertedRows||0);
      const duplicates=Number(json.duplicateRows||0);
      let msg=`${inserted} filas nuevas agregadas`;
      if(duplicates>0)msg+=` · aviso: ${duplicates} repetidas detectadas`;
      setImportModal(prev=>({...prev,open:false,loading:false,message:"",error:""}));
      setSuccessAlert({message:msg});
      setTab("solicitudes");
      await loadRaba03();
    }catch(err){
      const msg=err?.message||String(err);
      setImportModal(prev=>({...prev,loading:false,error:"Error cargando solicitudes: "+msg}));
      setError(msg);
    }
  },[importModal.rows,loadRaba03]);

  const guardarDatosRABA03=useCallback(async()=>{
    const payloadRows=(rows||[])
      .filter(r=>String(r.nSolicitud||"").trim())
      .map(r=>{
        const code=normCode(r.codigoArticulo);
        const proyecto=normalizeCentroCosto(r.centroCosto);
        const matches=[...(remitosByCode[`${code}__${proyecto}`]||[])];
        const seen=new Set();
        const unique=matches.filter(m=>{
          const k=`${m.numero}__${m.fecha}__${m.cantidad}`;
          if(seen.has(k))return false;
          seen.add(k);
          return true;
        });
        const numeros=[...new Set(unique.map(m=>String(m.numero||"").trim()).filter(Boolean))];
        const fechas=[...new Set(unique.map(m=>String(m.fecha||"").trim()).filter(Boolean))];
        const cantidadRemito=unique.reduce((acc,m)=>acc+toNumber(m.cantidad),0);
        return {
          nSolicitud:r.nSolicitud,
          cantidadEnviada:toNumber(r.cantidadEnviada),
          numeroRemito:numeros.join(" / "),
          fechaSalida:fechas.join(" / "),
          cantidad:cantidadRemito
        };
      });
    if(!payloadRows.length){
      appAlert("No hay datos para guardar.");
      return;
    }
    try{
      setLoading(true);
      setError(null);
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_cant_enviada",rows:payloadRows})})
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron guardar los datos en RABA03 base.");
      setSuccessAlert({message:`${Number(json.updatedRows||0)} filas guardadas en RABA03 base`});
      await loadRaba03();
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      appAlert("Error guardando datos: "+msg);
    }finally{
      setLoading(false);
    }
  },[rows,toNumber,loadRaba03,normCode,normalizeCentroCosto,remitosByCode]);


  const guardarCodigosRABA03=useCallback(async()=>{
    const payloadRows=Object.entries(codigoEdits)
      .map(([nSolicitud,codigoArticulo])=>({nSolicitud,codigoArticulo:String(codigoArticulo||"").trim()}))
      .filter(r=>String(r.nSolicitud||"").trim());
    if(!payloadRows.length){
      appAlert("No hay códigos modificados para guardar.");
      return;
    }
    try{
      setLoading(true);
      setError(null);
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        body:new URLSearchParams({payload:JSON.stringify({action:"save_raba03_codigos",rows:payloadRows})})
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron guardar los códigos en RABA03 base.");
      setCodigoEdits({});
      setSuccessAlert({message:`${Number(json.updatedRows||0)} códigos actualizados en RABA03 base`});
      await loadRaba03();
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      appAlert("Error guardando códigos: "+msg);
    }finally{
      setLoading(false);
    }
  },[codigoEdits,loadRaba03]);

  // Base visible para el usuario conectado. Todos los indicadores, gráficos y
  // tablas de solicitudes se calculan exclusivamente sobre estas filas.
  const assignedRows=useMemo(()=>
    (rows||[]).filter(r=>dmProjectMatches(r.centroCosto,assignedProject)),
  [rows,assignedProject]);
  const projects=useMemo(()=>Array.from(new Set(assignedRows.map(r=>r.centroCosto).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[assignedRows]);
  const companies=useMemo(()=>Array.from(new Set(assignedRows.map(r=>r.empresa).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[assignedRows]);
  const supervisors=useMemo(()=>Array.from(new Set(assignedRows.map(r=>canonicalSupervisor(r.pedidoPor)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es")),[assignedRows,canonicalSupervisor]);

  const filteredRows=useMemo(()=>{
    const q=norm(query);
    return assignedRows.filter(r=>{
      const key=buildSolicitudKey(r);
      const rechazada=Boolean(rejectedSolicitudes&&rejectedSolicitudes[key]);
      const cerradaManual=Boolean(closedSolicitudes&&closedSolicitudes[key]);
      const solicitada=toNumber(r.cantidadSolicitada);
      const enviada=toNumber(r.cantidadEnviada);
      const restante=toNumber(r.cantidadRestante);
      const cerrada=solicitada>0&&(restante<=0||cerradaManual);
      const fechaISO=fechaSolicitudISO(r.fechaSolicitud);
      if(tab==="rechazadas"){
        if(!rechazada)return false;
      }else if(rechazada){
        return false;
      }
      if(!matchMulti(r.centroCosto,project,"todos"))return false;
      if(!matchMulti(r.empresa,company,"todos"))return false;
      if(!matchMulti(canonicalSupervisor(r.pedidoPor),supervisor,"todos"))return false;
      if(rabaFilterMode==="dia"&&rabaDate&&fechaISO!==rabaDate)return false;
      if(rabaFilterMode==="periodo"){
        if(rabaDateFrom&&fechaISO&&fechaISO<rabaDateFrom)return false;
        if(rabaDateTo&&fechaISO&&fechaISO>rabaDateTo)return false;
        if((rabaDateFrom||rabaDateTo)&&!fechaISO)return false;
      }
      if(tab==="pendientes"&&enviada>0)return false;
      if(tab==="parciales"&&!(enviada>0&&restante>0&&!cerradaManual))return false;
      if(tab==="cerradas"&&!cerrada)return false;
      if(!q)return true;
      const obs=rejectedSolicitudes?.[key]?.observacion||"";
      return [r.nSolicitud,r.empresa,r.pedidoPor,r.centroCosto,r.codigoArticulo,r.descripcion,r.cantidadSolicitada,r.cantidadEnviada,r.cantidadRestante,obs].some(v=>norm(v).includes(q));
    });
  },[assignedRows,project,company,supervisor,rabaFilterMode,rabaDate,rabaDateFrom,rabaDateTo,query,tab,toNumber,fechaSolicitudISO,norm,canonicalSupervisor,buildSolicitudKey,rejectedSolicitudes,closedSolicitudes]);

  const sortedRows=useMemo(()=>{
    const dir=sort.dir==="asc"?1:-1;
    const parse=(v)=>{
      const txt=String(v??"").trim();
      if(!txt||txt==="—")return {t:"empty",v:""};
      const dm=txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
      if(dm){let y=Number(dm[3]); if(y<100)y+=2000; return {t:"date",v:new Date(y,Number(dm[2])-1,Number(dm[1])).getTime()};}
      const num=txt.replace(/\./g,"").replace(",",".");
      if(/^-?\d+(\.\d+)?$/.test(num))return {t:"number",v:Number(num)};
      return {t:"text",v:txt.toLowerCase()};
    };
    return [...filteredRows].sort((a,b)=>{
      const av=parse(a[sort.key]);
      const bv=parse(b[sort.key]);
      if(av.t==="empty"&&bv.t!=="empty")return 1;
      if(bv.t==="empty"&&av.t!=="empty")return -1;
      if(av.t===bv.t&&(av.t==="number"||av.t==="date"))return (av.v-bv.v)*dir;
      return String(av.v).localeCompare(String(bv.v),"es",{numeric:true,sensitivity:"base"})*dir;
    });
  },[filteredRows,sort]);

  const stats=useMemo(()=>{
    const activos=assignedRows.filter(r=>!rejectedSolicitudes?.[buildSolicitudKey(r)]);
    const pendientes=activos.filter(r=>toNumber(r.cantidadEnviada)<=0).length;
    const parciales=activos.filter(r=>toNumber(r.cantidadEnviada)>0&&toNumber(r.cantidadRestante)>0&&!closedSolicitudes?.[buildSolicitudKey(r)]).length;
    const cerradas=activos.filter(r=>toNumber(r.cantidadSolicitada)>0&&(toNumber(r.cantidadRestante)<=0||closedSolicitudes?.[buildSolicitudKey(r)])).length;
    const rechazadas=assignedRows.length-activos.length;
    const enviados=activos.filter(r=>toNumber(r.cantidadEnviada)>0).length;
    return {pendientes,parciales,cerradas,rechazadas,total:assignedRows.length,enviados};
  },[assignedRows,toNumber,buildSolicitudKey,rejectedSolicitudes,closedSolicitudes]);

  const parseRabaDateMs=useCallback((v)=>{
    const txt=String(v||"").trim();
    if(!txt)return null;
    const dm=txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if(dm){
      let y=Number(dm[3]);
      if(y<100)y+=2000;
      const d=new Date(y,Number(dm[2])-1,Number(dm[1]));
      return isNaN(d.getTime())?null:d.getTime();
    }
    const iso=txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(iso){
      const d=new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]));
      return isNaN(d.getTime())?null:d.getTime();
    }
    const d=new Date(txt);
    return isNaN(d.getTime())?null:d.getTime();
  },[]);

  const calcularIndicadorRABA03=useCallback((fechaSolicitud,fechaSalida)=>{
    const ini=parseRabaDateMs(fechaSolicitud);
    const fin=parseRabaDateMs(fechaSalida);
    if(ini===null||fin===null)return "";
    return Math.round((fin-ini)/86400000);
  },[parseRabaDateMs]);

  const raba03DownloadRows=useMemo(()=>{
    const out=[];
    (sortedRows||[]).forEach(row=>{
      const code=normCode(row.codigoArticulo);
      const proyecto=normalizeCentroCosto(row.centroCosto);
      const matches=[...(remitosByCode[`${code}__${proyecto}`]||[])];
      const seen=new Set();
      const unique=matches.filter(m=>{
        const k=`${m.numero}__${m.fecha}__${m.cantidad}`;
        if(seen.has(k))return false;
        seen.add(k);
        return true;
      });
      const base={};
      RABA03_EXPORT_COLUMNS.forEach(c=>{base[c.key]=(c.key==="fechaSolicitud"||c.key==="fechaRequerida")?formatDateLocal(row[c.key]):(row[c.key] instanceof Date?formatDateLocal(row[c.key]):(row[c.key]??""));});
      if(unique.length){
        unique.forEach(m=>out.push({
          ...base,
          numeroRemito:m.numero||"",
          fechaSalida:m.fecha||"",
          cantidadRemito:m.cantidad||"",
          indicador:calcularIndicadorRABA03(row.fechaSolicitud,m.fecha)
        }));
      }else{
        out.push({...base,numeroRemito:"",fechaSalida:"",cantidadRemito:"",indicador:""});
      }
    });
    return out;
  },[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);

  const raba03DashboardRows=useMemo(()=>{
    const out=[];
    (assignedRows||[]).forEach(row=>{
      const code=normCode(row.codigoArticulo);
      const proyecto=normalizeCentroCosto(row.centroCosto);
      const matches=[...(remitosByCode[`${code}__${proyecto}`]||[])];
      const seen=new Set();
      const unique=matches.filter(m=>{
        const k=`${m.numero}__${m.fecha}__${m.cantidad}`;
        if(seen.has(k))return false;
        seen.add(k);
        return true;
      });
      if(unique.length){
        unique.forEach(m=>out.push({
          nSolicitud:row.nSolicitud,
          empresa:row.empresa||"",
          centroCosto:row.centroCosto||"SIN PROYECTO",
          codigoArticulo:row.codigoArticulo||"S/C",
          descripcion:row.descripcion||"",
          cantidadSolicitada:row.cantidadSolicitada||0,
          numeroRemito:m.numero||"",
          fechaSalida:m.fecha||"",
          cantidadRemito:m.cantidad||0,
          indicador:calcularIndicadorRABA03(row.fechaSolicitud,m.fecha)
        }));
      }
    });
    return out;
  },[assignedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);

  const abastecimientoDashboardData=useMemo(()=>{
    const movimientos=(raba03DashboardRows||[]).map(r=>({...r,indicadorNum:Number(r.indicador)})).filter(r=>Number.isFinite(r.indicadorNum));
    const avg=movimientos.length?movimientos.reduce((a,r)=>a+r.indicadorNum,0)/movimientos.length:0;
    const max=movimientos.length?Math.max(...movimientos.map(r=>r.indicadorNum)):0;
    const min=movimientos.length?Math.min(...movimientos.map(r=>r.indicadorNum)):0;
    const filasActivas=assignedRows.filter(r=>!rejectedSolicitudes?.[buildSolicitudKey(r)]);
    const pendientes=filasActivas.filter(r=>toNumber(r.cantidadEnviada)<=0&&!closedSolicitudes?.[buildSolicitudKey(r)]).length;
    const parciales=filasActivas.filter(r=>toNumber(r.cantidadEnviada)>0&&toNumber(r.cantidadRestante)>0&&!closedSolicitudes?.[buildSolicitudKey(r)]).length;
    const cerradas=filasActivas.filter(r=>toNumber(r.cantidadSolicitada)>0&&(toNumber(r.cantidadRestante)<=0||closedSolicitudes?.[buildSolicitudKey(r)])).length;
    const porProyecto=Object.values(movimientos.reduce((acc,r)=>{
      const key=String(r.centroCosto||"SIN PROYECTO").trim()||"SIN PROYECTO";
      if(!acc[key])acc[key]={name:key,total:0,count:0,promedio:0};
      acc[key].total+=r.indicadorNum; acc[key].count+=1; acc[key].promedio=acc[key].total/acc[key].count;
      return acc;
    },{})).sort((a,b)=>b.promedio-a.promedio);
    const porMes=Object.values(movimientos.reduce((acc,r)=>{
      const d=parseRabaDateMs(r.fechaSalida);
      const key=d!==null?new Date(d).toISOString().slice(0,7):"SIN FECHA";
      if(!acc[key])acc[key]={mes:key,salidas:0,promedio:0,totalIndicador:0};
      acc[key].salidas+=1; acc[key].totalIndicador+=r.indicadorNum; acc[key].promedio=acc[key].totalIndicador/acc[key].salidas;
      return acc;
    },{})).sort((a,b)=>String(a.mes).localeCompare(String(b.mes)));
    const estados=[
      {name:"Pendientes",value:pendientes,color:C.yellow},
      {name:"Parciales",value:parciales,color:C.blue},
      {name:"Cerradas",value:cerradas,color:C.green},
    ];
    const demora=[
      {name:"0-3 días",value:movimientos.filter(r=>r.indicadorNum>=0&&r.indicadorNum<=3).length,color:C.green},
      {name:"4-7 días",value:movimientos.filter(r=>r.indicadorNum>=4&&r.indicadorNum<=7).length,color:C.blue},
      {name:"8-15 días",value:movimientos.filter(r=>r.indicadorNum>=8&&r.indicadorNum<=15).length,color:C.yellow},
      {name:">15 días",value:movimientos.filter(r=>r.indicadorNum>15).length,color:C.red},
    ];
    const masDemorados=[...movimientos].sort((a,b)=>b.indicadorNum-a.indicadorNum).slice(0,8);
    return {movimientos,avg,max,min,pendientes,parciales,cerradas,total:assignedRows.length,porProyecto,porMes,estados,demora,masDemorados};
  },[raba03DashboardRows,assignedRows,toNumber,parseRabaDateMs,buildSolicitudKey,rejectedSolicitudes,closedSolicitudes]);

  const enviosSinSolicitudRows=useMemo(()=>{
    const codigosSolicitados=new Set(
      (rows||[])
        .map(r=>normCode(r.codigoArticulo))
        .filter(Boolean)
    );

    const out=[];
    (remitos||[]).forEach(rem=>{
      const fecha=rem.fecha||"";
      (rem.items||[]).forEach((item,index)=>{
        const codigoNormalizado=normCode(item.codigo);
        if(!codigoNormalizado||codigosSolicitados.has(codigoNormalizado))return;
        out.push({
          id:`${rem.id||rem.comprobante||"remito"}-${index}-${codigoNormalizado}`,
          codigoArticulo:String(item.codigo||"").trim(),
          descripcion:String(item.descripcion||"").trim(),
          cantidadEnviada:toNumber(item.cantidad),
          fechaEnvio:fecha,
          numeroRemito:rem.comprobante||""
        });
      });
    });

    return out.sort((a,b)=>{
      const da=parseRabaDateMs(a.fechaEnvio)??0;
      const db=parseRabaDateMs(b.fechaEnvio)??0;
      if(db!==da)return db-da;
      return String(a.codigoArticulo||"").localeCompare(String(b.codigoArticulo||""),"es",{numeric:true,sensitivity:"base"});
    });
  },[rows,remitos,normCode,toNumber,parseRabaDateMs]);

  const exportarEnviosSinSolicitud=useCallback(()=>{
    if(!enviosSinSolicitudRows.length){
      appAlert("No hay envíos sin solicitud para exportar.");
      return;
    }
    const data=[
      ["Código de artículo","Descripción","Remito","Cant. enviada","Fecha de envío"],
      ...enviosSinSolicitudRows.map(r=>[r.codigoArticulo,r.descripcion,r.numeroRemito||"",r.cantidadEnviada,formatDateLocal(r.fechaEnvio)])
    ];
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(data);
    ws["!cols"]=[{wch:18},{wch:52},{wch:20},{wch:16},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws,"Envíos sin solicitud");
    XLSX.writeFile(wb,`Envios_sin_solicitud_${new Date().toISOString().slice(0,10)}.xlsx`);
  },[enviosSinSolicitudRows,formatDateLocal]);

  const generarRABA03Excel=useCallback(()=>{
    const baseRows=raba03DownloadRows||[];
    if(!baseRows.length){
      appAlert("No hay filas para exportar en RABA03.");
      return;
    }
    const columns=[...RABA03_EXPORT_COLUMNS,...RABA03_EXTRA_COLUMNS];
    const headers=columns.map(c=>c.label);
    const out=baseRows.map(row=>columns.map(c=>row[c.key] instanceof Date?formatDateLocal(row[c.key]):(row[c.key]??"")));
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet([headers,...out]);
    ws["!cols"]=columns.map(c=>({wch:Math.max(12,Math.round((c.width||120)/8))}));
    XLSX.utils.book_append_sheet(wb,ws,"RABA03");
    const stamp=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`RABA03_${stamp}.xlsx`);
  },[raba03DownloadRows]);

  const generarExcelEstadoRABA03=useCallback(()=>{
    const baseRows=sortedRows||[];
    if(!baseRows.length){
      appAlert("No hay filas para exportar.");
      return;
    }

    const estadoLabel={
      pendientes:"Pendientes",
      parciales:"Parciales",
      cerradas:"Cerradas",
      rechazadas:"Rechazadas"
    }[tab]||"Solicitudes";

    const headers=["Código","Descripción","Cantidad"];
    const out=baseRows.map(r=>[
      String(r.codigoArticulo||"S/C"),
      String(r.descripcion||""),
      toNumber(r.cantidadSolicitada)
    ]);

    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet([headers,...out]);
    ws["!cols"]=[{wch:16},{wch:65},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,estadoLabel.slice(0,31));
    const stamp=new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb,`RABA03_${estadoLabel}_${stamp}.xlsx`);
  },[sortedRows,tab,toNumber]);

  useEffect(()=>{
    window.dmGenerateRABA03=generarRABA03Excel;
    return()=>{
      if(window.dmGenerateRABA03===generarRABA03Excel)delete window.dmGenerateRABA03;
    };
  },[generarRABA03Excel]);

  useEffect(()=>{
    if(tab!=="raba03")return;
    const top=raba03TopScrollRef.current;
    const table=raba03TableScrollRef.current;
    if(!top||!table)return;
    let lock=false;
    const fromTop=()=>{
      if(lock)return;
      lock=true;
      table.scrollLeft=top.scrollLeft;
      lock=false;
    };
    const fromTable=()=>{
      if(lock)return;
      lock=true;
      top.scrollLeft=table.scrollLeft;
      lock=false;
    };
    top.addEventListener("scroll",fromTop,{passive:true});
    table.addEventListener("scroll",fromTable,{passive:true});
    return()=>{
      top.removeEventListener("scroll",fromTop);
      table.removeEventListener("scroll",fromTable);
    };
  },[tab,raba03DownloadRows.length]);

  const hayFiltrosRaba=useMemo(()=>Boolean(
    query.trim()||
    !multiIsAll(project,"todos")||
    !multiIsAll(company,"todos")||
    !multiIsAll(supervisor,"todos")||
    (rabaFilterMode==="dia"&&rabaDate)||
    (rabaFilterMode==="periodo"&&(rabaDateFrom||rabaDateTo))
  ),[query,project,company,supervisor,rabaFilterMode,rabaDate,rabaDateFrom,rabaDateTo]);

  const resetRabaFilters=useCallback(()=>{
    setQuery("");
    setProject("todos");
    setCompany("todos");
    setSupervisor("todos");
    setRabaDate("");
    setRabaDateFrom("");
    setRabaDateTo("");
    setRabaFilterMode("dia");
  },[]);

  const addRemitoItem=()=>setRemitoForm(prev=>({...prev,items:[...prev.items,{codigo:"",descripcion:"",cantidad:""}]}));
  const updateRemitoItem=(index,field,value)=>setRemitoForm(prev=>({
    ...prev,
    items:prev.items.map((it,i)=>i===index?{...it,[field]:value}:it)
  }));
  const removeRemitoItem=(index)=>setRemitoForm(prev=>({
    ...prev,
    items:prev.items.length>1?prev.items.filter((_,i)=>i!==index):prev.items
  }));
  const updateRemitoField=(field,value)=>setRemitoForm(prev=>({...prev,[field]:value}));

  const parsePdfDateToInput=useCallback((v)=>{
    const txt=String(v||"").trim();
    const m=txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if(!m)return new Date().toISOString().slice(0,10);
    const y=m[3].length===2?`20${m[3]}`:m[3];
    return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;
  },[]);

  const parseRaba08Text=useCallback((text)=>{
    const parsePdfCantidad=(valor)=>{
      const raw=String(valor||"").trim().replace(/\s/g,"");
      if(!raw)return 0;
      // En RABA08 el punto final es decimal: 10.00 = 10, no 1000.
      const n=Number(raw.replace(",","."));
      return Number.isFinite(n)?n:0;
    };

    const raw=String(text||"");
    const clean=raw
      .replace(/\r/g,"\n")
      .replace(/\u00a0/g," ")
      .replace(/[ \t]+/g," ")
      .trim();
    const flat=clean.replace(/\n+/g," ").replace(/\s+/g," ").trim();

    const comprobante=(flat.match(/Comprobante\s*:\s*(.+?)(?:\s+Fecha\s*:|\s+Origen\s*:|$)/i)?.[1]||"").trim();
    const fechaTxt=(flat.match(/Fecha\s*:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1]||"").trim();
    const origen=(flat.match(/Origen\s*:\s*(.+?)(?:\s+Destino\s*:|\s+Observaciones\s*:|$)/i)?.[1]||"").trim();
    const destino=(flat.match(/Destino\s*:\s*(.+?)(?:\s+Observaciones\s*:|\s+Art[ií]culo\s+|$)/i)?.[1]||"").trim();
    const observacionesRaw=(flat.match(/Observaciones\s*:\s*(.+?)(?:\s+Art[ií]culo\s+|\s+TOTAL\s*:|$)/i)?.[1]||"").trim();
    const observaciones=normalizeCentroCosto(observacionesRaw)||observacionesRaw;

    const items=[];
    const seen=new Set();
    const pushItem=(codigo,descripcion,cantidad)=>{
      const code=String(codigo||"").trim();
      const qty=parsePdfCantidad(cantidad);
      if(!code||qty<=0)return;
      const desc=String(descripcion||"").replace(/\s+/g," ").trim();
      const key=`${code}__${desc}__${qty}`;
      if(seen.has(key))return;
      seen.add(key);
      items.push({codigo:code,descripcion:desc,cantidad:qty});
    };

    const lines=clean.split("\n").map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean);
    let inItems=false;
    for(const line of lines){
      const nline=line.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      if(nline.includes("articulo")&&nline.includes("descripcion")&&nline.includes("cantidad")){
        inItems=true;
        continue;
      }
      if(!inItems)continue;
      if(nline.startsWith("total")||nline.startsWith("observaciones")||nline.startsWith("despacho")||nline.startsWith("firma")||nline.startsWith("aclaracion")||nline.startsWith("revisado"))break;

      // Ejemplo: 476 LAMPARA H11 12V LAMPARA 20.00
      // También soporta códigos alfanuméricos, ej. 1527ALT.
      const lm=line.match(/^([A-Za-z0-9.\/-]+)\s+(.+?)\s+(-?\d+(?:[.,]\d+)?)$/);
      if(lm)pushItem(lm[1],lm[2],lm[3]);
    }

    // Respaldo cuando PDF.js pega varias filas en una sola línea.
    if(!items.length){
      const sectionMatch=flat.match(/Art[ií]culo\s+Descripci[oó]n\s+Descr\s+Adicional\s+Cantidad\s+(.+?)(?:\s+TOTAL\s*:|\s+OBSERVACIONES\s*:|$)/i);
      const section=sectionMatch?.[1]||"";
      const compactRegex=/(?:^|\s)([A-Za-z0-9.\/-]+)\s+(.+?)\s+(-?\d+(?:[.,]\d+)?)(?=\s+[A-Za-z0-9.\/-]+\s+|\s*$)/g;
      let m;
      while((m=compactRegex.exec(section))!==null){
        pushItem(m[1],m[2],m[3]);
      }
    }

    return {
      comprobante:comprobante||"S/N",
      fecha:parsePdfDateToInput(fechaTxt),
      origen:origen||"01 DEPOSITO CENTRAL",
      destino,
      observaciones,
      items:items.length?items:[{codigo:"",descripcion:"",cantidad:""}]
    };
  },[parsePdfDateToInput,normalizeCentroCosto]);

  const loadPdfJs=useCallback(()=>new Promise((resolve,reject)=>{
    if(window.pdfjsLib)return resolve(window.pdfjsLib);
    const existing=document.querySelector('script[data-pdfjs="true"]');
    if(existing){
      existing.addEventListener("load",()=>resolve(window.pdfjsLib));
      existing.addEventListener("error",()=>reject(new Error("No se pudo cargar el lector PDF.")));
      return;
    }
    const script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async=true;
    script.dataset.pdfjs="true";
    script.onload=()=>resolve(window.pdfjsLib);
    script.onerror=()=>reject(new Error("No se pudo cargar el lector PDF."));
    document.body.appendChild(script);
  }),[]);

  const handleRemitoPdfUpload=useCallback(async(file,{agregarAlLote=false}={})=>{
    if(!file)return null;
    try{
      const pdfjs=await loadPdfJs();
      if(pdfjs.GlobalWorkerOptions){
        pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      const buffer=await file.arrayBuffer();
      const pdf=await pdfjs.getDocument({data:buffer}).promise;
      const parsedPages=[];
      for(let pageNum=1;pageNum<=pdf.numPages;pageNum++){
        const page=await pdf.getPage(pageNum);
        const content=await page.getTextContent();
        const rows=[];
        (content.items||[]).forEach(item=>{
          const y=Math.round((item.transform?.[5]||0)*2)/2;
          const x=item.transform?.[4]||0;
          let row=rows.find(r=>Math.abs(r.y-y)<2);
          if(!row){row={y,items:[]};rows.push(row);}
          row.items.push({x,str:item.str});
        });
        let pageText="";
        rows
          .sort((a,b)=>b.y-a.y)
          .forEach(row=>{
            pageText+=row.items.sort((a,b)=>a.x-b.x).map(it=>it.str).join(" ").replace(/\s+/g," ").trim()+"\n";
          });
        parsedPages.push(parseRaba08Text(pageText));
      }

      // Cada página del PDF se procesa de forma independiente para que los cortes
      // por TOTAL/OBSERVACIONES no impidan leer las páginas siguientes. Luego se
      // unifican todos los artículos y se eliminan únicamente las filas repetidas
      // con la misma combinación de código + descripción + cantidad.
      const firstParsed=parsedPages[0]||parseRaba08Text("");
      const uniqueItems=[];
      const seenItems=new Set();
      parsedPages.forEach(pageParsed=>{
        (pageParsed.items||[]).forEach(item=>{
          const codigo=String(item.codigo||"").trim();
          const descripcion=String(item.descripcion||"").replace(/\s+/g," ").trim();
          const cantidad=toNumber(item.cantidad);
          if(!codigo||cantidad<=0)return;
          const key=[
            codigo.toUpperCase(),
            descripcion.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase(),
            Number(cantidad).toFixed(6)
          ].join("__");
          if(seenItems.has(key))return;
          seenItems.add(key);
          uniqueItems.push({codigo,descripcion,cantidad});
        });
      });
      const parsed={
        ...firstParsed,
        items:uniqueItems.length?uniqueItems:[{codigo:"",descripcion:"",cantidad:""}]
      };
      if(agregarAlLote){
        const cleanItems=(parsed.items||[])
          .map(it=>({codigo:String(it.codigo||"").trim(),descripcion:String(it.descripcion||"").trim(),cantidad:toNumber(it.cantidad)}))
          .filter(it=>it.codigo&&it.cantidad>0);
        if(!cleanItems.length){
          appAlert(`No pude detectar artículos en ${file.name||"el PDF"}. Ese remito no fue agregado al lote.`);
          return null;
        }
        const loteItem={...parsed,items:cleanItems,_loteId:`lote-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,_archivo:file.name||"PDF"};
        setRemitosPendientes(prev=>[...prev,loteItem]);
        return loteItem;
      }
      setRemitoForm(prev=>({...prev,...parsed}));
      if(!parsed.items.some(it=>it.codigo&&toNumber(it.cantidad)>0)){
        appAlert("No pude detectar artículos del PDF. Revisá si el remito tiene el mismo formato y cargalos manualmente.");
      }
      return parsed;
    }catch(err){
      appAlert(`No pude leer el PDF automáticamente: ${err.message||err}`);
      return null;
    }
  },[loadPdfJs,parseRaba08Text,toNumber]);

  const handleMultipleRemitoPdfUpload=useCallback(async(files)=>{
    const list=Array.from(files||[]);
    if(!list.length)return;
    setLoading(true);
    try{
      for(const file of list){
        await handleRemitoPdfUpload(file,{agregarAlLote:true});
      }
    }finally{
      setLoading(false);
    }
  },[handleRemitoPdfUpload]);

  const buildRemitoDesdeFormulario=useCallback((form)=>{
    const cleanItems=(form.items||[])
      .map(it=>({codigo:String(it.codigo||"").trim(),descripcion:String(it.descripcion||"").trim(),cantidad:toNumber(it.cantidad)}))
      .filter(it=>it.codigo&&it.cantidad>0);
    if(!cleanItems.length)return null;
    const proyectoDetectado=normalizeCentroCosto([form.observaciones,form.destino,form.origen].filter(Boolean).join(" "));
    return {
      id:`raba08-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      comprobante:form.comprobante||"S/N",
      fecha:form.fecha,
      origen:form.origen,
      destino:form.destino,
      proyecto:proyectoDetectado,
      observaciones:form.observaciones,
      items:cleanItems,
      createdAt:new Date().toISOString(),
      shared:false
    };
  },[toNumber,normalizeCentroCosto]);

  const limpiarRemitoForm=useCallback(()=>setRemitoForm({
    comprobante:"",
    fecha:new Date().toISOString().slice(0,10),
    origen:"01 DEPOSITO CENTRAL",
    destino:"",
    observaciones:"",
    items:[{codigo:"",descripcion:"",cantidad:""}]
  }),[]);

  const agregarRemitoActualAlLote=useCallback(()=>{
    const nuevo=buildRemitoDesdeFormulario(remitoForm);
    if(!nuevo){
      appAlert("Cargá al menos un artículo con código y cantidad antes de agregar el remito al lote.");
      return;
    }
    setRemitosPendientes(prev=>[...prev,{...remitoForm,items:nuevo.items,_loteId:`lote-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}]);
    limpiarRemitoForm();
  },[remitoForm,buildRemitoDesdeFormulario,limpiarRemitoForm]);

  const quitarRemitoDelLote=useCallback((id)=>{
    setRemitosPendientes(prev=>prev.filter(r=>r._loteId!==id));
  },[]);

  const registerRemito=async()=>{
    const actual=buildRemitoDesdeFormulario(remitoForm);
    const formularios=[...remitosPendientes];
    if(actual)formularios.push(remitoForm);
    if(!formularios.length){
      appAlert("Cargá al menos un remito con artículos antes de guardar.");
      return;
    }

    const remitosAEnviar=formularios.map(buildRemitoDesdeFormulario).filter(Boolean);
    if(!remitosAEnviar.length){
      appAlert("No hay remitos válidos para guardar.");
      return;
    }

    try{
      setLoading(true);
      setError(null);
      let guardados=0;
      for(const nuevo of remitosAEnviar){
        await saveRemitoCompartido(nuevo);
        guardados++;
      }
      await loadRemitosCompartidos({silent:false});
      setSuccessAlert({message:`${guardados} ${guardados===1?"remito guardado":"remitos guardados"} y sincronizados para todos los usuarios`});
      setRemitosPendientes([]);
      limpiarRemitoForm();
      setRemitoSearch("");
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      appAlert("No se pudieron guardar todos los remitos. Los que Google Sheets confirmó antes del error sí quedaron registrados: "+msg);
      await loadRemitosCompartidos({silent:true}).catch(()=>{});
    }finally{
      setLoading(false);
    }
  };

  const deleteRemito=async(id)=>{
    if(!(await appConfirm("¿Eliminar este remito cargado?")))return;
    setRemitos(prev=>prev.filter(r=>r.id!==id));
    try{
      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        cache:"no-store",
        redirect:"follow",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:new URLSearchParams({payload:JSON.stringify({action:"delete_remito_cargado",idRemito:id})}).toString()
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudo eliminar el remito compartido.");
      await loadRemitosCompartidos({silent:false});
    }catch(err){
      console.warn("No se pudo eliminar el remito en la hoja compartida:",err);
    }
  };

  const badgeStyle=(kind)=>({
    display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:999,padding:"3px 9px",fontSize:10,fontWeight:900,letterSpacing:".03em",
    color:kind==="ok"?C.green:kind==="bad"?C.red:kind==="info"?C.blue:C.yellow,
    background:kind==="ok"?`${C.green}18`:kind==="bad"?`${C.red}18`:kind==="info"?`${C.blue}18`:`${C.yellow}18`,
    border:`1px solid ${kind==="ok"?C.green:kind==="bad"?C.red:kind==="info"?C.blue:C.yellow}55`,
    whiteSpace:"nowrap"
  });

  const thStyle={padding:"10px 11px",textAlign:"left",borderBottom:`1px solid ${C.border}35`,color:C.textSub,fontSize:10,textTransform:"uppercase",letterSpacing:".07em",fontWeight:900,whiteSpace:"nowrap",cursor:"pointer",userSelect:"none"};
  const tdStyle={padding:"9px 11px",borderBottom:`1px solid ${C.border}22`,color:C.text,fontSize:12,fontWeight:600,verticalAlign:"middle"};
  const inputStyle={height:34,border:`1px solid ${C.border}`,borderRadius:10,background:"rgba(10,10,10,.65)",color:C.text,padding:"0 12px",fontSize:12,fontWeight:600};


  const handleStockExcelUpload=useCallback(async(file)=>{
    if(!file)return;
    if(readOnly){appAlert("No tenés permisos para reemplazar el Stock compartido.");return;}
    if(!/\.(xlsx|xls)$/i.test(String(file.name||""))){appAlert("Seleccioná un archivo Excel .xlsx o .xls.");return;}
    try{
      setStockLoading(true);
      setStockPhase("Validando Excel…");
      setError(null);
      const buffer=await file.arrayBuffer();
      const validation=validateStockWorkbook(XLSX,buffer,file.name);
      const summary=stockValidationSummary(validation);
      if(validation.blocked)throw new Error(summary);
      const warning=validation.report.rejectedRows?"\n\nLas filas rechazadas no se publicarán.":"";
      if(!(await appConfirm(`${summary}${warning}\n\n¿Reemplazar el Stock compartido actual?`)))return;
      setStockPhase("Actualizando Stock compartido…");
      const result=await uploadStockExcel(APPS_SCRIPT_URL,{file,rows:validation.rows,sheetName:validation.sourceSheet,replace:stockRows.length>0});
      const persisted=Array.isArray(result.rows)?result.rows:validation.rows;
      setStockRows(persisted);
      setStockMeta(result.meta||null);
      setStockVisibleLimit(350);
      setTab("stock");
      setSuccessAlert({message:`Stock compartido actualizado: ${persisted.length} filas · versión ${result.meta?.version||"nueva"}`});
    }catch(err){
      setError(`Error leyendo Control de stock: ${err.message||err}`);
    }finally{
      setStockLoading(false);
      setStockPhase("");
    }
  },[APPS_SCRIPT_URL,appAlert,appConfirm,readOnly,setStockLoading,setStockMeta,setStockPhase,setStockRows,stockRows.length]);

  const handleClearSharedStock=useCallback(async()=>{
    if(!canClearSharedStock){appAlert("Solo un administrador puede eliminar el Stock compartido.");return;}
    if(!(await appConfirm("Esta acción elimina globalmente el Excel y la tabla de Stock para todos los usuarios. ¿Continuar?")))return;
    try{
      setStockLoading(true);
      setError(null);
      const result=await clearSharedStock(APPS_SCRIPT_URL);
      setStockRows([]);setStockMeta(result.meta||null);setStockVisibleLimit(350);
      setSuccessAlert({message:"El Stock compartido fue eliminado para todos los usuarios."});
    }catch(err){setError(`No se pudo eliminar el Stock compartido: ${err.message||err}`);}
    finally{setStockLoading(false);}
  },[APPS_SCRIPT_URL,appAlert,appConfirm,canClearSharedStock]);

  const stockTextCollator=useMemo(()=>new Intl.Collator("es",{numeric:true,sensitivity:"base"}),[]);
  const isStockDepositoPermitido=useCallback((row)=>{
    const dep=String(row?.descripcionDeposito||"").trim().toUpperCase();
    return dep==="DEPOSITO CENTRAL"||dep==="DEPOSITO BATIDERO"||dep==="DEPOSITO FILO DEL SOL";
  },[]);
  const stockBaseRows=useMemo(()=>stockRows.filter(isStockDepositoPermitido),[stockRows,isStockDepositoPermitido]);
  const formatStockOptionLabel=useCallback((key,value)=>{
    const col=STOCK_CONTROL_COLUMNS.find(c=>c.key===key);
    if(col?.numeric)return fmtNum(Number(value)||0);
    return String(value||"Sin dato");
  },[]);
  const stockFilterOptions=useMemo(()=>{
    const build=(key)=>{
      const col=STOCK_CONTROL_COLUMNS.find(c=>c.key===key);
      const map=new Map();
      (stockBaseRows||[]).forEach(row=>{
        const raw=row?.[key];
        const value=col?.numeric?String(Number(raw)||0):String(raw||"").trim();
        if(!value)return;
        if(!map.has(value))map.set(value,{value,label:formatStockOptionLabel(key,value)});
      });
      const arr=Array.from(map.values()).sort((a,b)=>{
        if(col?.numeric)return (Number(a.value)||0)-(Number(b.value)||0);
        return stockTextCollator.compare(a.label,b.label);
      });
      return [{value:"todos",label:`Todos ${col?.label||key}`} ,...arr];
    };
    return STOCK_FILTER_COLUMNS.reduce((acc,col)=>{
      acc[col.key]=build(col.key);
      return acc;
    },{});
  },[stockBaseRows,formatStockOptionLabel,stockTextCollator]);
  const stockMatchesFilter=useCallback((key,value)=>{
    const selected=stockFilters[key];
    if(!Array.isArray(selected)||selected.length===0||selected.includes("todos"))return true;
    const col=STOCK_CONTROL_COLUMNS.find(c=>c.key===key);
    const normalized=col?.numeric?String(Number(value)||0):String(value||"").trim();
    return selected.includes(normalized);
  },[stockFilters]);
  const filteredStockRows=useMemo(()=>stockBaseRows.filter(r=>{
    return STOCK_FILTER_COLUMNS.every(col=>stockMatchesFilter(col.key,r[col.key]));
  }),[stockBaseRows,stockMatchesFilter]);
  const sortedStockRows=useMemo(()=>{
    if(!stockSort.key||!stockSort.dir)return filteredStockRows;
    const dir=stockSort.dir==="asc"?1:-1;
    const key=stockSort.key;
    const col=STOCK_CONTROL_COLUMNS.find(c=>c.key===key);
    const numeric=!!col?.numeric;
    return [...filteredStockRows].sort((a,b)=>{
      const av=a[key];
      const bv=b[key];
      if(numeric)return ((Number(av)||0)-(Number(bv)||0))*dir;
      return stockTextCollator.compare(String(av||""),String(bv||""))*dir;
    });
  },[filteredStockRows,stockSort,stockTextCollator]);
  const visibleStockRows=useMemo(()=>sortedStockRows.slice(0,stockVisibleLimit),[sortedStockRows,stockVisibleLimit]);
  const toggleStockSort=(key)=>setStockSort(prev=>{
    if(prev.key!==key)return {key,dir:"asc"};
    if(prev.dir==="asc")return {key,dir:"desc"};
    return {key:null,dir:null};
  });
  const stockNumberColor=(value)=>{
    const n=Number(value);
    if(!n)return C.text;
    return n<0?C.red:C.green;
  };
  const stockDashboardData=useMemo(()=>{
    const rows=(filteredStockRows||[]).map(r=>{
      const saldo=Number(r.saldoControlStock)||0;
      const min=Number(r.stockMinimo)||0;
      const max=Number(r.stockMaximo)||0;
      return {...r,saldo,min,max,faltante:Math.max(0,min-saldo),exceso:Math.max(0,saldo-max)};
    });
    const bajoMinimo=rows.filter(r=>r.min>0&&r.saldo<r.min).sort((a,b)=>b.faltante-a.faltante);
    const sobreMaximo=rows.filter(r=>r.max>0&&r.saldo>r.max).sort((a,b)=>b.exceso-a.exceso);
    const dentroRango=rows.filter(r=>!(r.min>0&&r.saldo<r.min)&&!(r.max>0&&r.saldo>r.max));
    return {rows,bajoMinimo,sobreMaximo,dentroRango};
  },[filteredStockRows]);

  const generarInformeReposicionPDF=useCallback(()=>{
    const rows=[...(stockDashboardData.bajoMinimo||[])].sort((a,b)=>{
      const dep=stockTextCollator.compare(String(a.descripcionDeposito||""),String(b.descripcionDeposito||""));
      if(dep!==0)return dep;
      return (Number(b.faltante)||0)-(Number(a.faltante)||0);
    });
    if(!rows.length){
      appAlert("No hay insumos por debajo del stock mínimo para generar informe.");
      return;
    }
    const fecha=new Date().toLocaleDateString("es-AR");
    const grupos=rows.reduce((acc,r)=>{
      const dep=String(r.descripcionDeposito||"SIN DEPÓSITO").trim()||"SIN DEPÓSITO";
      if(!acc[dep])acc[dep]=[];
      acc[dep].push(r);
      return acc;
    },{});
    const escapeHtml=(v)=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
    const body=Object.keys(grupos).sort((a,b)=>stockTextCollator.compare(a,b)).map(dep=>`
      <section class="deposito">
        <h2>${escapeHtml(dep)}</h2>
        <table>
          <thead><tr><th>Código</th><th>Insumo</th><th class="num">Saldo</th><th class="num">Stock mínimo</th><th class="num">Cantidad a enviar</th></tr></thead>
          <tbody>
            ${grupos[dep].map(r=>`
              <tr>
                <td>${escapeHtml(r.codigoArticulo||"S/C")}</td>
                <td>${escapeHtml(r.descripcion||r.descripcionAdicional||"—")}</td>
                <td class="num">${escapeHtml(fmtNum(r.saldo))}</td>
                <td class="num">${escapeHtml(fmtNum(r.min))}</td>
                <td class="num fuerte">${escapeHtml(fmtNum(r.faltante))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </section>`).join("");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Informe reposición urgente</title>
      <style>
        @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 8px;padding:7px 9px;background:#111;color:#fff;border-radius:5px}.meta{font-size:11px;color:#555;margin-bottom:14px}.resumen{display:flex;gap:10px;margin:10px 0 14px}.card{border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:12px}.card b{font-size:18px;color:#d00}table{width:100%;border-collapse:collapse;margin-bottom:8px;page-break-inside:auto}th,td{border:1px solid #ddd;padding:6px 7px;font-size:11px;vertical-align:top}th{background:#f2f2f2;text-align:left}.num{text-align:right;white-space:nowrap}.fuerte{font-weight:800;color:#d00}.deposito{page-break-inside:auto}.footer{position:fixed;bottom:0;left:0;right:0;font-size:9px;color:#777;text-align:center}
      </style></head><body>
      <h1>Informe de reposición urgente</h1>
      <div class="meta">Generado el ${escapeHtml(fecha)} · Fuente: ${escapeHtml(stockFileName||"Excel de stock")}</div>
      <div class="resumen"><div class="card">Artículos críticos<br><b>${escapeHtml(fmtNum(rows.length))}</b></div><div class="card">Depósitos<br><b>${escapeHtml(fmtNum(Object.keys(grupos).length))}</b></div></div>
      ${body}<div class="footer">Delta Mining · Reposición urgente por stock mínimo</div>
      <script>window.onload=function(){setTimeout(function(){window.print();},250)};<\/script></body></html>`;
    const iframe=document.createElement("iframe");
    iframe.style.position="fixed";
    iframe.style.right="0";
    iframe.style.bottom="0";
    iframe.style.width="0";
    iframe.style.height="0";
    iframe.style.border="0";
    iframe.setAttribute("aria-hidden","true");
    document.body.appendChild(iframe);
    const doc=iframe.contentWindow?.document;
    if(!doc){appAlert("No se pudo preparar la ventana de impresión.");return;}
    doc.open();
    doc.write(html.replace("<script>window.onload=function(){setTimeout(function(){window.print();},250)};<\/script>",""));
    doc.close();
    setTimeout(()=>{
      try{iframe.contentWindow?.focus();iframe.contentWindow?.print();}
      finally{setTimeout(()=>{try{document.body.removeChild(iframe);}catch(_){}},1200);}
    },350);
  },[stockDashboardData.bajoMinimo,stockTextCollator,stockFileName,fmtNum]);

  const renderStockAlertTable=(title,rows,kind)=>{
    const isLow=kind==="low";
    const accent=isLow?C.red:C.yellow;
    const extraLabel=isLow?"Faltante":"Exceso";
    const limitKey=isLow?"stockMinimo":"stockMaximo";
    const extraKey=isLow?"faltante":"exceso";
    const cols=[
      {key:"codigoArticulo",label:"Código"},
      {key:"descripcion",label:"Descripción"},
      {key:"descripcionDeposito",label:"Depósito"},
      {key:"saldoControlStock",label:"Saldo",numeric:true,align:"right"},
      {key:limitKey,label:isLow?"Stock mínimo":"Stock máximo",numeric:true,align:"right"},
      {key:extraKey,label:extraLabel,numeric:true,align:"right"},
    ];
    let shownRows=[...(rows||[])];
    if(stockSort.key&&stockSort.dir){
      const dir=stockSort.dir==="asc"?1:-1;
      const col=cols.find(c=>c.key===stockSort.key);
      shownRows.sort((a,b)=>{
        if(col?.numeric)return ((Number(a[stockSort.key])||0)-(Number(b[stockSort.key])||0))*dir;
        return stockTextCollator.compare(String(a[stockSort.key]||""),String(b[stockSort.key]||""))*dir;
      });
    }
    return (
      <Card>
        <div style={{padding:14,borderBottom:`1px solid ${C.border}33`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{fontSize:15,fontWeight:900,color:C.text}}>{title}</div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {isLow&&(<button onClick={generarInformeReposicionPDF} style={{height:32,border:`1px solid ${C.blue}66`,background:`${C.blue}18`,color:C.blue,borderRadius:10,padding:"0 12px",fontSize:12,fontWeight:900,cursor:"pointer"}}>📄 Generar informe PDF</button>)}
            <span style={{...badgeStyle(isLow?"bad":"warn"),color:accent,borderColor:`${accent}66`,background:`${accent}16`}}>{fmtNum(rows.length)} alertas</span>
          </div>
        </div>
        <div style={{overflow:"auto",maxHeight:360}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:880}}>
            <thead style={{position:"sticky",top:0,background:"rgba(16,16,16,.96)",zIndex:1}}>
              <tr>
                {cols.map(col=>(
                  <th key={col.key} onClick={()=>toggleStockSort(col.key)} style={{...thStyle,textAlign:col.align||"left"}}>
                    {col.label}{stockSort.key===col.key?(stockSort.dir==="asc"?" ▲":" ▼"):""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownRows.length?shownRows.slice(0,300).map(r=>(
                <tr key={`${kind}-${r.id}`}>
                  <td style={tdStyle}>{r.codigoArticulo||"S/C"}</td>
                  <td style={{...tdStyle,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={[r.descripcion,r.descripcionAdicional].filter(Boolean).join(" — ")}>{r.descripcion||r.descripcionAdicional||"—"}</td>
                  <td style={{...tdStyle,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={r.descripcionDeposito}>{r.descripcionDeposito||"—"}</td>
                  <td style={{...tdStyle,textAlign:"right",fontWeight:900,color:accent}}>{fmtNum(r.saldo)}</td>
                  <td style={{...tdStyle,textAlign:"right"}}>{fmtNum(isLow?r.min:r.max)}</td>
                  <td style={{...tdStyle,textAlign:"right",fontWeight:900,color:accent}}>{fmtNum(isLow?r.faltante:r.exceso)}</td>
                </tr>
              )):(
                <tr><td colSpan={6} style={{...tdStyle,textAlign:"center",padding:24,color:C.textSub}}>Sin alertas para mostrar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const renderAbastecimientoDashboard=()=>{
    const d=abastecimientoDashboardData;
    const pieColors=[C.yellow,C.blue,C.green,C.red,C.teal];
    return (
      <div style={{display:"grid",gap:14}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:10}}>
          <StatCard icon="report" label="Promedio indicador" value={`${fmtNum(d.avg.toFixed(1))} días`} sub="fecha salida - fecha solicitud" color={C.red} small/>
          <StatCard icon="check" label="Ítems con salida" value={fmtNum(d.movimientos.length)} sub="con remito asignado" color={C.green} small/>
          <StatCard icon="warn" label="Pendientes" value={fmtNum(d.pendientes)} sub="sin artículos enviados" color={C.yellow} small/>
          <StatCard icon="database" label="Total solicitudes" value={fmtNum(d.total)} sub="ítems cargados" color={C.blue} small/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1.25fr .75fr",gap:14,alignItems:"stretch"}}>
          <Card>
            <div style={{padding:14,borderBottom:`1px solid ${C.border}33`}}>
              <div style={{fontSize:15,fontWeight:900,color:C.text}}>Promedio de indicador por centro de costo</div>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub}}>Días promedio entre solicitud y salida de remito.</div>
            </div>
            <div style={{height:260,padding:12}}>
              {d.porProyecto.length?(
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.porProyecto} layout="vertical" margin={{left:8,right:18,top:6,bottom:6}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${C.border}55`}/>
                    <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fill:C.textSub,fontSize:10}} width={112} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text}} formatter={v=>`${fmtNum(Number(v).toFixed(1))} días`}/>
                    <Bar dataKey="promedio" fill={C.red} radius={[0,8,8,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ):(<div style={{color:C.textSub,fontWeight:800,padding:20}}>Todavía no hay salidas con indicador para graficar.</div>)}
            </div>
          </Card>
          <Card>
            <div style={{padding:14,borderBottom:`1px solid ${C.border}33`}}>
              <div style={{fontSize:15,fontWeight:900,color:C.text}}>Estado de solicitudes</div>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub}}>Pendientes, parciales y cerradas.</div>
            </div>
            <div style={{height:260,padding:12,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.estados.filter(x=>x.value>0)} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {d.estados.filter(x=>x.value>0).map((entry,i)=><Cell key={entry.name} fill={entry.color||pieColors[i%pieColors.length]}/>) }
                  </Pie>
                  <Tooltip
                    wrapperStyle={{zIndex:50,pointerEvents:"none"}}
                    content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const item=payload[0];
                      const row=item.payload||{};
                      const totalEstado=d.estados.reduce((acc,x)=>acc+(Number(x.value)||0),0);
                      const value=Number(item.value)||0;
                      const pct=totalEstado>0?((value/totalEstado)*100).toFixed(1):"0.0";
                      const color=row.color||item.color||C.accent;
                      return(
                        <div style={{background:"rgba(16,16,16,.94)",border:`1px solid ${color}66`,borderRadius:10,padding:"8px 11px",boxShadow:"0 12px 28px rgba(0,0,0,.45)",minWidth:140,maxWidth:190,color:C.text,fontSize:11,lineHeight:1.25}}>
                          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                            <span style={{width:9,height:9,borderRadius:999,background:color,display:"inline-block",boxShadow:`0 0 10px ${color}66`}}/>
                            <span style={{fontFamily:"Inter",fontWeight:900,color:C.text}}>{row.name||item.name||"Estado"}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",gap:12,color:C.textSub}}>
                            <span>Solicitudes</span><strong style={{color:C.text}}>{fmtNum(value)}</strong>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",gap:12,color:C.textSub,marginTop:3}}>
                            <span>Participación</span><strong style={{color}}>{pct}%</strong>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{color:C.textSub,fontSize:11}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <Card>
            <div style={{padding:14,borderBottom:`1px solid ${C.border}33`}}>
              <div style={{fontSize:15,fontWeight:900,color:C.text}}>Salidas por mes</div>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub}}>Cantidad de remitos asociados a solicitudes.</div>
            </div>
            <div style={{height:240,padding:12}}>
              {d.porMes.length?(
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d.porMes} margin={{left:8,right:16,top:8,bottom:4}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${C.border}55`}/>
                    <XAxis dataKey="mes" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text}} formatter={v=>fmtNum(v)}/>
                    <Area type="monotone" dataKey="salidas" stroke={C.green} fill={`${C.green}33`} strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              ):(<div style={{color:C.textSub,fontWeight:800,padding:20}}>Sin salidas cargadas.</div>)}
            </div>
          </Card>
          <Card>
            <div style={{padding:14,borderBottom:`1px solid ${C.border}33`}}>
              <div style={{fontSize:15,fontWeight:900,color:C.text}}>Distribución de demoras</div>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub}}>Cantidad de ítems por rango de indicador.</div>
            </div>
            <div style={{height:240,padding:12}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.demora} margin={{left:8,right:16,top:8,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${C.border}55`}/>
                  <XAxis dataKey="name" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,color:C.text}} formatter={v=>fmtNum(v)}/>
                  <Bar dataKey="value" radius={[8,8,0,0]}>
                    {d.demora.map(entry=><Cell key={entry.name} fill={entry.color}/>) }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <Card>
          <div style={{padding:14,borderBottom:`1px solid ${C.border}33`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:900,color:C.text}}>Ítems con mayor demora</div>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub}}>Ordenado por indicador más alto.</div>
            </div>
            <span style={badgeStyle("info")}>Máx. {fmtNum(d.max)} días · Mín. {fmtNum(d.min)} días</span>
          </div>
          <div style={{overflow:"auto",maxHeight:320}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:980}}>
              <thead style={{position:"sticky",top:0,background:"rgba(16,16,16,.96)",zIndex:1}}>
                <tr><th style={thStyle}>N° solicitud</th><th style={thStyle}>Código</th><th style={thStyle}>Descripción</th><th style={thStyle}>Centro costo</th><th style={thStyle}>Remito</th><th style={thStyle}>Fecha salida</th><th style={{...thStyle,textAlign:"right"}}>Indicador</th></tr>
              </thead>
              <tbody>
                {d.masDemorados.length?d.masDemorados.map((r,i)=>(
                  <tr key={`demora-${r.nSolicitud}-${r.numeroRemito}-${i}`}>
                    <td style={tdStyle}>{r.nSolicitud}</td><td style={tdStyle}>{r.codigoArticulo}</td><td style={{...tdStyle,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={r.descripcion}>{r.descripcion||"—"}</td><td style={tdStyle}>{r.centroCosto}</td><td style={tdStyle}>{r.numeroRemito||"—"}</td><td style={tdStyle}>{formatDateLocal(r.fechaSalida)||r.fechaSalida||"—"}</td><td style={{...tdStyle,textAlign:"right",fontWeight:900,color:Number(r.indicador)>15?C.red:C.yellow}}>{fmtNum(r.indicador)} días</td>
                  </tr>
                )):(<tr><td colSpan={7} style={{...tdStyle,textAlign:"center",padding:24,color:C.textSub}}>Sin movimientos para mostrar.</td></tr>)}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const renderStockDashboard=()=>{
    const d=stockDashboardData;
    return (
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{padding:14,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <label style={{height:34,display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${C.green}66`,borderRadius:10,background:`${C.green}16`,color:C.green,padding:"0 12px",fontSize:12,fontWeight:900,cursor:readOnly?"not-allowed":"pointer",opacity:readOnly?.55:1}}>
              📥 Cargar Excel Stock
              <input type="file" accept=".xlsx,.xls" disabled={readOnly||stockLoading} onChange={e=>{handleStockExcelUpload(e.target.files?.[0]); e.target.value="";}} style={{display:"none"}}/>
            </label>
            <div style={{color:C.textSub,fontSize:12,fontWeight:800}}>{stockLoading?(stockPhase||"Sincronizando Stock compartido…"):stockFileName||"Sin archivo compartido cargado"}{stockMeta?.rowCount?` · ${fmtNum(stockMeta.rowCount)} filas`:""}{stockMeta?.version?` · v${stockMeta.version}`:""}{stockMeta?.updatedBy?` · ${stockMeta.updatedBy}`:""}{stockMeta?.updatedAt?` · ${new Date(stockMeta.updatedAt).toLocaleString("es-AR")}`:""}</div>
          </div>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:10}}>
          <StatCard icon="database" label="Artículos analizados" value={fmtNum(d.rows.length)} sub="del Excel cargado" color={C.blue} small/>
          <StatCard icon="warn" label="Bajo stock mínimo" value={fmtNum(d.bajoMinimo.length)} sub="requieren reposición" color={C.red} small/>
          <StatCard icon="check" label="Dentro del rango" value={fmtNum(d.dentroRango.length)} sub="sin alerta" color={C.green} small/>
          <StatCard icon="warn" label="Sobre stock máximo" value={fmtNum(d.sobreMaximo.length)} sub="exceso de inventario" color={C.yellow} small/>
        </div>
        {renderStockFiltersCard()}
        {renderStockAlertTable("Reposición urgente: saldo menor al stock mínimo",d.bajoMinimo,"low")}
        {renderStockAlertTable("Exceso de stock: saldo mayor al stock máximo",d.sobreMaximo,"high")}
      </div>
    );
  };

  const renderStockFiltersCard=()=> (
    <Card>
      <div style={{padding:14,display:"flex",gap:8,alignItems:"flex-end",flexWrap:"nowrap",overflowX:"auto"}}>
        {STOCK_FILTER_COLUMNS.map(col=>(
          <MultiSel
            key={col.key}
            label={col.label}
            value={stockFilters[col.key]}
            onChange={value=>setStockFilter(col.key,value)}
            options={stockFilterOptions[col.key]||[{value:"todos",label:`Todos ${col.label}`}]} />
        ))}
        <button onClick={()=>{setStockFilters({codigoArticulo:"todos",descripcion:"todos",descripcionDeposito:"todos"});setStockSort({key:null,dir:null});}} style={{height:34,border:`1px solid ${C.red}55`,background:C.redDim,color:C.red,borderRadius:10,padding:"0 12px",fontSize:12,fontWeight:900,cursor:"pointer",flex:"0 0 auto"}}>Limpiar filtros</button>
      </div>
    </Card>
  );

  const setStockFilter=(key,value)=>setStockFilters(prev=>({...prev,[key]:value}));
  const renderStockControl=()=>{
    return (
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{padding:14,display:"flex",alignItems:"flex-end",gap:10,flexWrap:"wrap"}}>
            <label style={{height:34,display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${C.green}66`,borderRadius:10,background:`${C.green}16`,color:C.green,padding:"0 12px",fontSize:12,fontWeight:900,cursor:readOnly?"not-allowed":"pointer",opacity:readOnly?.55:1}}>
              📥 Cargar Excel Stock
              <input type="file" accept=".xlsx,.xls" disabled={readOnly||stockLoading} onChange={e=>{handleStockExcelUpload(e.target.files?.[0]); e.target.value="";}} style={{display:"none"}}/>
            </label>
            {canClearSharedStock&&<button disabled={stockLoading} onClick={handleClearSharedStock} style={{height:34,border:`1px solid ${C.red}55`,background:C.redDim,color:C.red,borderRadius:10,padding:"0 12px",fontSize:12,fontWeight:900,cursor:stockLoading?"wait":"pointer"}}>Eliminar stock compartido</button>}
            <div style={{color:C.textSub,fontSize:12,fontWeight:800}}>{stockLoading?(stockPhase||"Sincronizando Stock compartido…"):stockFileName||"Sin archivo compartido cargado"}{stockMeta?.version?` · v${stockMeta.version}`:""}{stockMeta?.updatedBy?` · ${stockMeta.updatedBy}`:""}{stockMeta?.updatedAt?` · ${new Date(stockMeta.updatedAt).toLocaleString("es-AR")}`:""}</div>
            <div style={{marginLeft:"auto",color:C.textSub,fontSize:12,fontWeight:800}}>Mostrando {fmtNum(visibleStockRows.length)} de {fmtNum(sortedStockRows.length)} filtradas · Total {fmtNum(stockBaseRows.length)} filas</div>
          </div>
        </Card>
        {renderStockFiltersCard()}
        <div style={{background:"rgba(20,20,20,.72)",border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",backdropFilter:"blur(6px)"}}>
          <div style={{overflow:"auto",maxHeight:"calc(100vh - 270px)"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:1260,tableLayout:"fixed"}}>
              <thead style={{position:"sticky",top:0,background:"rgba(16,16,16,.96)",zIndex:1}}>
                <tr>
                  {STOCK_CONTROL_COLUMNS.map(col=>(
                    <th key={col.key} onClick={()=>toggleStockSort(col.key)} style={{...thStyle,textAlign:col.align||"left",width:col.width,minWidth:col.width,maxWidth:col.width,whiteSpace:"normal",lineHeight:1.15}}>
                      {col.label}{stockSort.key===col.key?(stockSort.dir==="asc"?" ▲":" ▼"):""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleStockRows.length?visibleStockRows.map(row=>(
                  <tr key={row.id}>
                    {STOCK_CONTROL_COLUMNS.map(col=>(
                      <td key={col.key} style={{...tdStyle,textAlign:col.align||"left",width:col.width,maxWidth:col.width,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:col.numeric?stockNumberColor(row[col.key]):tdStyle.color,fontWeight:col.numeric&&Number(row[col.key])!==0?900:tdStyle.fontWeight}}>
                        {typeof row[col.key]==="number"?fmtNum(row[col.key]):String(row[col.key]||"")}
                      </td>
                    ))}
                  </tr>
                )):(
                  <tr><td colSpan={STOCK_CONTROL_COLUMNS.length} style={{...tdStyle,color:C.textSub,textAlign:"center",padding:28}}>{stockLoading?"Cargando Stock compartido...":"No hay un Excel de Stock compartido activo."}</td></tr>
                )}
              </tbody>
            </table>
            {visibleStockRows.length<sortedStockRows.length&&(<div style={{padding:12,textAlign:"center",borderTop:`1px solid ${C.border}`,background:"rgba(16,16,16,.82)"}}>
              <button onClick={()=>setStockVisibleLimit(v=>v+350)} style={{height:34,border:`1px solid ${C.border}`,background:"rgba(255,255,255,.06)",color:C.text,borderRadius:10,padding:"0 14px",fontSize:12,fontWeight:900,cursor:"pointer"}}>Ver más filas ({fmtNum(sortedStockRows.length-visibleStockRows.length)} restantes)</button>
            </div>)}
          </div>
        </div>
      </div>
    );
  };

  const renderMainTable=()=>{
    const showActions=["solicitudes","pendientes","parciales","cerradas"].includes(tab);
    const showRejectedObs=tab==="rechazadas";
    const extraWidth=showActions||showRejectedObs?210:0;
    const colSpan=RABA03_COLUMNS.length+(showActions||showRejectedObs?1:0);
    return (
    <div style={{background:"rgba(20,20,20,.72)",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",backdropFilter:"blur(6px)",overflow:"hidden"}}>
      {!readOnly&&tab==="parciales"&&<div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.border}33`,background:"rgba(0,0,0,.20)"}}>
        <span style={{fontSize:11,fontWeight:800,color:C.textSub}}>{selectedCloseKeys.size} seleccionada{selectedCloseKeys.size===1?"":"s"}</span>
        <button onClick={closeSelectedSolicitudes} disabled={!selectedCloseKeys.size||Boolean(actionLoading)} style={{border:`1px solid ${C.green}88`,background:selectedCloseKeys.size?`${C.green}25`:"rgba(255,255,255,.04)",color:selectedCloseKeys.size?C.green:C.textSub,borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:900,cursor:selectedCloseKeys.size&&!actionLoading?"pointer":"not-allowed",opacity:selectedCloseKeys.size?1:.55,fontFamily:"Inter"}}>Cerrar todas</button>
      </div>}
      {!readOnly&&tab==="cerradas"&&<div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${C.border}33`,background:"rgba(0,0,0,.20)"}}>
        <span style={{fontSize:11,fontWeight:800,color:C.textSub}}>{selectedReopenKeys.size} seleccionada{selectedReopenKeys.size===1?"":"s"}</span>
        <button onClick={reopenSelectedSolicitudes} disabled={!selectedReopenKeys.size||Boolean(actionLoading)} style={{border:`1px solid ${C.blue}88`,background:selectedReopenKeys.size?`${C.blue}25`:"rgba(255,255,255,.04)",color:selectedReopenKeys.size?C.blue:C.textSub,borderRadius:9,padding:"7px 12px",fontSize:11,fontWeight:900,cursor:selectedReopenKeys.size&&!actionLoading?"pointer":"not-allowed",opacity:selectedReopenKeys.size?1:.55,fontFamily:"Inter"}}>Reabrir todas</button>
      </div>}
      <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
      <table style={{width:"100%",minWidth:1420+extraWidth,borderCollapse:"collapse",fontFamily:"Inter, system-ui, sans-serif",tableLayout:"fixed"}}>
        <thead style={{background:"rgba(0,0,0,.35)"}}>
          <tr>
            {RABA03_COLUMNS.map(col=>(
              <th key={col.key} onClick={()=>setSort(prev=>({key:col.key,dir:prev.key===col.key&&prev.dir==="asc"?"desc":"asc"}))} style={{...thStyle,textAlign:col.align||"left",width:col.width}}>
                {col.label}{sort.key===col.key?<span style={{color:C.red}}> {sort.dir==="asc"?"↑":"↓"}</span>:null}
              </th>
            ))}
            {(showActions||showRejectedObs)&&<th style={{...thStyle,cursor:"default",width:extraWidth,textAlign:"left"}}>{showRejectedObs?"Observación rechazo":"Acciones"}</th>}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length?sortedRows.map(r=>{
            const key=buildSolicitudKey(r);
            const rejectInfo=rejectedSolicitudes?.[key];
            const manualClosed=Boolean(closedSolicitudes?.[key]);
            return (
            <tr key={r.id}>
              <td style={tdStyle}>{r.numeroSolicitud||"—"}</td>
              <td style={tdStyle}>{r.nSolicitud||"—"}</td>
              <td style={tdStyle}>{r.empresa||"—"}</td>
              <td style={tdStyle}>{formatDateLocal(r.fechaSolicitud)||"—"}</td>
              <td style={tdStyle}>{formatDateLocal(r.fechaRequerida)||"—"}</td>
              <td style={tdStyle}>{r.pedidoPor||"—"}</td>
              <td style={tdStyle}>{r.centroCosto?<span style={badgeStyle("info")}>{r.centroCosto}</span>:"—"}</td>
              <td style={tdStyle}>{r.codigoArticulo||"S/C"}</td>
              <td style={{...tdStyle,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.descripcion}>{r.descripcion||"—"}</td>
              <td style={{...tdStyle,textAlign:"right"}}>{fmtNum(r.cantidadSolicitada)}</td>
              <td style={{...tdStyle,textAlign:"right",color:toNumber(r.cantidadEnviada)>0?C.green:C.text}}>{fmtNum(r.cantidadEnviada)}</td>
              <td style={{...tdStyle,textAlign:"right",color:(toNumber(r.cantidadRestante)>0&&!manualClosed)?C.yellow:C.green}}>{manualClosed?<span title="Cierre manual">Cerrada manual</span>:fmtNum(r.cantidadRestante)}</td>
              {showActions&&(
                <td style={{...tdStyle,whiteSpace:"nowrap"}}>
                  <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
                    {!readOnly&&<>
                      <button onClick={()=>openRejectSolicitud(r)} style={{border:`1px solid ${C.red}66`,background:`${C.red}18`,color:C.red,borderRadius:8,padding:"5px 9px",fontSize:10,fontWeight:900,cursor:"pointer",fontFamily:"Inter"}}>Rechazar</button>
                      {tab==="parciales"&&<button onClick={()=>toggleSolicitudParaCerrar(r)} style={{border:`1px solid ${selectedCloseKeys.has(key)?C.green:C.green+"66"}`,background:selectedCloseKeys.has(key)?`${C.green}42`:`${C.green}18`,color:C.green,borderRadius:8,padding:"5px 9px",fontSize:10,fontWeight:900,cursor:"pointer",fontFamily:"Inter"}}>{selectedCloseKeys.has(key)?"Seleccionada":"Cerrar"}</button>}
                      {tab==="cerradas"&&manualClosed&&<button onClick={()=>toggleSolicitudParaReabrir(r)} style={{border:`1px solid ${selectedReopenKeys.has(key)?C.blue:C.blue+"66"}`,background:selectedReopenKeys.has(key)?`${C.blue}42`:`${C.blue}18`,color:C.blue,borderRadius:8,padding:"5px 9px",fontSize:10,fontWeight:900,cursor:"pointer",fontFamily:"Inter"}}>{selectedReopenKeys.has(key)?"Seleccionada":"Reabrir"}</button>}
                    </>}
                  </div>
                </td>
              )}
              {showRejectedObs&&(
                <td style={{...tdStyle,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={rejectInfo?.observacion||""}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{rejectInfo?.observacion||"—"}</span>
                    {!readOnly&&<button onClick={()=>restoreRejectedSolicitud(r)} style={{marginLeft:"auto",border:`1px solid ${C.blue}66`,background:`${C.blue}18`,color:C.blue,borderRadius:8,padding:"4px 8px",fontSize:10,fontWeight:900,cursor:"pointer",fontFamily:"Inter",flex:"0 0 auto"}}>Restaurar</button>}
                  </div>
                </td>
              )}
            </tr>
          );}) : (
            <tr><td colSpan={colSpan} style={{...tdStyle,textAlign:"center",padding:28,color:C.textSub}}>Sin datos para mostrar.</td></tr>
          )}
        </tbody>
      </table>
      </div>
      <div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`}}>{fmtNum(sortedRows.length)} ítems mostrados</div>
    </div>
    );
  };


  const renderEditarCodigos=()=>{
    const modifiedCount=Object.keys(codigoEdits).length;
    const editRows=sortedRows;
    return (
      <div style={{display:"grid",gap:14}}>
        <div style={{background:"rgba(20,20,20,.72)",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",backdropFilter:"blur(6px)",overflow:"hidden"}}>
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}33`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:15,fontWeight:900,color:C.text}}>Editar códigos de solicitudes</div>
              <div style={{fontSize:11,fontWeight:700,color:C.textSub}}>Modificá los códigos y presioná Guardar datos para actualizar la planilla base.</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={badgeStyle(modifiedCount?"warn":"info")}>{fmtNum(modifiedCount)} códigos modificados</span>
              {modifiedCount>0&&<button onClick={()=>setCodigoEdits({})} style={{border:`1px solid ${C.red}55`,background:C.redDim,color:C.red,borderRadius:10,padding:"7px 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Descartar cambios</button>}
            </div>
          </div>
          <div style={{overflow:"auto",maxHeight:"calc(100vh - 330px)",minHeight:280}}>
            <table style={{width:"100%",minWidth:1280,borderCollapse:"collapse",fontFamily:"Inter, system-ui, sans-serif",tableLayout:"fixed"}}>
              <thead>
                <tr>
                  <th style={{...thStyle,cursor:"default",width:110,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>N° Solicitud</th>
                  <th style={{...thStyle,cursor:"default",width:120,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Empresa</th>
                  <th style={{...thStyle,cursor:"default",width:125,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Fecha solicitud</th>
                  <th style={{...thStyle,cursor:"default",width:150,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Pedido por</th>
                  <th style={{...thStyle,cursor:"default",width:140,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Centro de costo</th>
                  <th style={{...thStyle,cursor:"default",width:170,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Código de artículo</th>
                  <th style={{...thStyle,cursor:"default",position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Descripción</th>
                  <th style={{...thStyle,cursor:"default",width:130,textAlign:"right",position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)"}}>Cant. solicitada</th>
                </tr>
              </thead>
              <tbody>
                {editRows.length?editRows.map(r=>{
                  const currentValue=Object.prototype.hasOwnProperty.call(codigoEdits,r.nSolicitud)?codigoEdits[r.nSolicitud]:r.codigoArticulo;
                  const changed=Object.prototype.hasOwnProperty.call(codigoEdits,r.nSolicitud);
                  return (
                    <tr key={`edit-code-${r.id}`} style={{background:changed?`${C.yellow}12`:undefined}}>
                      <td style={tdStyle}>{r.nSolicitud}</td>
                      <td style={tdStyle}>{r.empresa||"—"}</td>
                      <td style={tdStyle}>{formatDateLocal(r.fechaSolicitud)||"—"}</td>
                      <td style={tdStyle}>{r.pedidoPor||"—"}</td>
                      <td style={tdStyle}>{r.centroCosto?<span style={badgeStyle("info")}>{r.centroCosto}</span>:"—"}</td>
                      <td style={tdStyle}>
                        <input value={currentValue||""} onChange={e=>{
                          const value=e.target.value;
                          setCodigoEdits(prev=>{
                            const next={...prev};
                            if(String(value||"").trim()===String(r.codigoArticulo||"").trim())delete next[r.nSolicitud];
                            else next[r.nSolicitud]=value;
                            return next;
                          });
                        }} placeholder="S/C" style={{...inputStyle,width:"100%",height:32,borderColor:changed?`${C.yellow}aa`:C.border,background:changed?`${C.yellow}10`:inputStyle.background,color:changed?C.yellow:C.text,fontWeight:900}}/>
                      </td>
                      <td style={{...tdStyle,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.descripcion}>{r.descripcion||"—"}</td>
                      <td style={{...tdStyle,textAlign:"right"}}>{fmtNum(r.cantidadSolicitada)}</td>
                    </tr>
                  );
                }):(
                  <tr><td colSpan={8} style={{...tdStyle,textAlign:"center",padding:28,color:C.textSub}}>Sin solicitudes para editar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`}}>{fmtNum(editRows.length)} solicitudes mostradas</div>
        </div>
      </div>
    );
  };

  const renderRABA03Descarga=()=>{
    const columns=[...RABA03_EXPORT_COLUMNS,...RABA03_EXTRA_COLUMNS];
    const tableMinWidth=1540;
    return (
      <div style={{display:"grid",gap:14}}>
        <Card>
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"nowrap",overflowX:"auto"}}>
            <Icon name="filter" size={14} color={C.textSub}/>
            <div style={{display:"flex",gap:7,flex:"0 0 auto"}}>
              <TabBtn active={rabaFilterMode==="dia"} onClick={()=>setRabaFilterMode("dia")}>Por día</TabBtn>
              <TabBtn active={rabaFilterMode==="periodo"} onClick={()=>setRabaFilterMode("periodo")}>Por período</TabBtn>
            </div>
            {rabaFilterMode==="dia"&&<DateIn label="Fecha" value={rabaDate} onChange={setRabaDate}/>}
            {rabaFilterMode==="periodo"&&<><PeriodMonthYear fechaD={rabaDateFrom} fechaH={rabaDateTo} setFechaD={setRabaDateFrom} setFechaH={setRabaDateTo}/><DateIn label="Desde" value={rabaDateFrom} onChange={setRabaDateFrom} max={rabaDateTo||undefined}/><DateIn label="Hasta" value={rabaDateTo} onChange={setRabaDateTo} min={rabaDateFrom||undefined} warn={rabaDateTo&&rabaDateFrom&&rabaDateTo<rabaDateFrom?"≥ Desde":null}/></>}
            <MultiSel label="Proyecto" value={project} onChange={setProject} options={[{value:"todos",label:"Todos"},...projects.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Empresa" value={company} onChange={setCompany} options={[{value:"todos",label:"Todas"},...companies.map(e=>({value:e,label:e}))]}/>
            <MultiSel label="Supervisor" value={supervisor} onChange={setSupervisor} options={[{value:"todos",label:"Todos"},...supervisors.map(s=>({value:s,label:s}))]}/>
            <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:290,flex:"0 0 290px"}}>
              <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Buscar</label>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar descripción, código, solicitante..." style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:12,outline:"none",fontFamily:"Inter"}}/>
            </div>
            <button onClick={resetRabaFilters} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosRaba?1:0.3,pointerEvents:hayFiltrosRaba?"auto":"none",alignSelf:"flex-end",flex:"0 0 auto"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
            <button onClick={guardarDatosRABA03} style={{marginLeft:"auto",border:`1px solid ${C.blue}66`,background:`${C.blue}18`,color:C.blue,borderRadius:10,padding:"9px 13px",fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"Inter",display:"inline-flex",alignItems:"center",gap:8,alignSelf:"flex-end",flex:"0 0 auto"}}>
              <Icon name="check" size={16} color="currentColor"/>
              Guardar datos
            </button>
            <button onClick={generarRABA03Excel} style={{border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,borderRadius:10,padding:"9px 13px",fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"Inter",display:"inline-flex",alignItems:"center",gap:8,alignSelf:"flex-end",flex:"0 0 auto"}}>
              <Icon name="fileSpreadsheet" size={16} color="currentColor"/>
              Generar RABA03
            </button>
          </div>
        </Card>
        <div style={{background:"rgba(20,20,20,.72)",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,.18)",backdropFilter:"blur(6px)",overflow:"hidden"}}>
          <div ref={raba03TopScrollRef} style={{overflowX:"auto",overflowY:"hidden",height:18,borderBottom:`1px solid ${C.border}22`,background:"rgba(0,0,0,.22)"}}>
            <div style={{width:tableMinWidth,height:1}}/>
          </div>
          <div ref={raba03TableScrollRef} style={{overflow:"auto",maxHeight:"calc(100vh - 260px)",minHeight:260}}>
            <table style={{width:"100%",minWidth:tableMinWidth,borderCollapse:"collapse",fontFamily:"Inter, system-ui, sans-serif",tableLayout:"fixed"}}>
              <thead>
                <tr>
                  {columns.map(col=>(
                    <th key={col.key} style={{...thStyle,cursor:"default",textAlign:col.align||"left",width:col.width,position:"sticky",top:0,zIndex:2,background:"rgba(0,0,0,.82)",boxShadow:"0 1px 0 rgba(255,255,255,.08)"}}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {raba03DownloadRows.length?raba03DownloadRows.map((r,idx)=>(
                  <tr key={`raba03-preview-${idx}`}>
                    {columns.map(col=>(
                      <td key={col.key} style={{...tdStyle,textAlign:col.align||"left",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={String(r[col.key] instanceof Date?formatDateLocal(r[col.key]):(r[col.key]??""))}>
                        {typeof r[col.key]==="number"?fmtNum(r[col.key]):String(r[col.key] instanceof Date?formatDateLocal(r[col.key]):(r[col.key]??""))||"—"}
                      </td>
                    ))}
                  </tr>
                )):(
                  <tr><td colSpan={columns.length} style={{...tdStyle,textAlign:"center",padding:28,color:C.textSub}}>Sin datos para mostrar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`}}>{fmtNum(raba03DownloadRows.length)} filas listas para descargar</div>
        </div>
      </div>
    );
  };

  const renderSuccessAlert=()=>{
    if(!successAlert)return null;
    return (
      <div style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,.50)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{width:"min(430px,92vw)",background:"rgba(24,24,24,.97)",border:`1px solid ${C.green}66`,borderRadius:18,boxShadow:"0 30px 90px rgba(0,0,0,.55)",padding:22,display:"grid",gap:16,textAlign:"center"}}>
          <div style={{width:48,height:48,borderRadius:14,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${C.green}88`,background:`${C.green}18`,color:C.green,fontSize:24,fontWeight:900}}>✓</div>
          <div style={{fontSize:18,fontWeight:900,color:C.text}}>Carga realizada</div>
          <div style={{fontSize:15,fontWeight:900,color:C.green}}>{successAlert.message}</div>
          <button onClick={()=>setSuccessAlert(null)} style={{justifySelf:"center",border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,borderRadius:10,padding:"10px 18px",fontWeight:900,cursor:"pointer"}}>Aceptar</button>
        </div>
      </div>
    );
  };

  const renderRejectModal=()=>{
    if(!rejectModal.open)return null;
    const row=rejectModal.row||{};
    return (
      <div style={{position:"fixed",inset:0,zIndex:10020,background:"rgba(0,0,0,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{width:"min(560px,94vw)",background:"rgba(24,24,24,.97)",border:`1px solid ${C.red}66`,borderRadius:18,boxShadow:"0 30px 90px rgba(0,0,0,.55)",padding:20,display:"grid",gap:14}}>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:C.text}}>Rechazar solicitud</div>
            <div style={{fontSize:12,fontWeight:700,color:C.textSub,marginTop:4}}>Solicitud {row.nSolicitud||"—"} · {row.codigoArticulo||"S/C"} · {row.descripcion||""}</div>
          </div>
          <textarea value={rejectModal.observacion} onChange={e=>setRejectModal(prev=>({...prev,observacion:e.target.value}))} placeholder="Escribí la observación del rechazo..." autoFocus style={{...inputStyle,minHeight:120,resize:"vertical",lineHeight:1.35}}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
            <button onClick={()=>setRejectModal({open:false,row:null,observacion:""})} style={{border:`1px solid ${C.border}`,background:"rgba(255,255,255,.06)",color:C.text,borderRadius:10,padding:"9px 13px",fontWeight:900,cursor:"pointer"}}>Cancelar</button>
            <button onClick={confirmRejectSolicitud} style={{border:`1px solid ${C.red}66`,background:`${C.red}18`,color:C.red,borderRadius:10,padding:"9px 13px",fontWeight:900,cursor:"pointer"}}>Rechazar</button>
          </div>
        </div>
      </div>
    );
  };

  const renderImportModal=()=>{
    if(!importModal.open)return null;
    const nuevos=(importModal.rows||[]).filter(r=>r.estado==="Nuevo").length;
    const actualizar=(importModal.rows||[]).filter(r=>r.estado==="Actualizar").length;
    return (
      <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{width:"min(1180px,96vw)",maxHeight:"88vh",overflow:"hidden",background:"rgba(24,24,24,.96)",border:`1px solid ${C.border}`,borderRadius:18,boxShadow:"0 30px 90px rgba(0,0,0,.55)",display:"grid",gridTemplateRows:"auto auto 1fr auto"}}>
          <div style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}55`,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:C.text}}>Previsualización de carga RABA03</div>
              <div style={{fontSize:12,fontWeight:700,color:C.textSub}}>{importModal.fileName||"Excel de solicitudes"}</div>
            </div>
            <button onClick={()=>setImportModal(prev=>({...prev,open:false}))} disabled={importModal.loading} style={{border:`1px solid ${C.border}`,background:"rgba(255,255,255,.06)",color:C.text,borderRadius:10,padding:"8px 11px",fontWeight:900,cursor:"pointer"}}>Cerrar</button>
          </div>
          <div style={{padding:"12px 18px",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",borderBottom:`1px solid ${C.border}33`}}>
            <span style={badgeStyle("info")}>Total: {fmtNum(importModal.rows.length)}</span>
            <span style={badgeStyle("ok")}>Nuevas: {fmtNum(nuevos)}</span>
            <span style={badgeStyle("warn")}>Actualizan: {fmtNum(actualizar)}</span>
            {importModal.message&&<span style={{color:C.textSub,fontWeight:800,fontSize:12}}>{importModal.message}</span>}
            {importModal.error&&<span style={{color:C.red,fontWeight:900,fontSize:12}}>{importModal.error}</span>}
          </div>
          <div style={{overflow:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Inter, system-ui, sans-serif",minWidth:1040}}>
              <thead style={{position:"sticky",top:0,background:"rgba(0,0,0,.8)",zIndex:1}}>
                <tr>{["Estado","Empresa","Fecha solicitud","Fecha requerida","Autorizado por","Centro de costo","Código","Descripción","Cant. solicitada"].map(h=><th key={h} style={{...thStyle,cursor:"default"}}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {(importModal.rows||[]).map((r,idx)=>(
                  <tr key={idx}>
                    <td style={tdStyle}><span style={badgeStyle(r.estado==="Actualizar"?"warn":"ok")}>{r.estado}</span></td>
                    <td style={tdStyle}>{r.empresa||"—"}</td>
                    <td style={tdStyle}>{formatDateLocal(r.fechaSolicitud)||"—"}</td>
                    <td style={tdStyle}>{formatDateLocal(r.fechaRequerida)||"—"}</td>
                    <td style={tdStyle}>{r.pedidoPor||"—"}</td>
                    <td style={tdStyle}>{r.centroCosto?<span style={badgeStyle("info")}>{r.centroCosto}</span>:"—"}</td>
                    <td style={tdStyle}>{r.codigoArticulo||"—"}</td>
                    <td style={tdStyle}>{r.descripcion||"—"}</td>
                    <td style={{...tdStyle,textAlign:"right"}}>{fmtNum(r.cantidadSolicitada)}</td>
                  </tr>
                ))}
                {!importModal.rows.length&&<tr><td colSpan={9} style={{...tdStyle,textAlign:"center",padding:28,color:C.textSub}}>Sin filas para previsualizar.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{padding:"14px 18px",borderTop:`1px solid ${C.border}55`,display:"flex",justifyContent:"flex-end",gap:10}}>
            <button onClick={()=>setImportModal(prev=>({...prev,open:false}))} disabled={importModal.loading} style={{border:`1px solid ${C.border}`,background:"rgba(255,255,255,.06)",color:C.text,borderRadius:10,padding:"9px 13px",fontWeight:900,cursor:"pointer"}}>Cancelar</button>
            <button onClick={confirmSolicitudesImport} disabled={importModal.loading||!importModal.rows.length} style={{border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,borderRadius:10,padding:"9px 13px",fontWeight:900,cursor:"pointer",opacity:(importModal.loading||!importModal.rows.length)?0.6:1}}>{importModal.loading?"Cargando...":"Confirmar carga"}</button>
          </div>
        </div>
      </div>
    );
  };

  const renderRemito=()=> (
    <div style={{display:"grid",gap:14}}>
      <div style={{background:"rgba(20,20,20,.72)",border:`1px solid ${C.border}`,borderRadius:16,padding:16,backdropFilter:"blur(6px)",display:"grid",gap:12}}>
        <div>
          <div style={{fontSize:15,fontWeight:900,color:C.text}}>Cargar Remito RABA08</div>
          <div style={{fontSize:11,color:C.textSub}}>Subí el PDF del RABA08 y la app completa comprobante, fecha, origen, destino, observaciones y artículos automáticamente. También podés corregir los datos antes de guardar.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(240px,1fr))",gap:10}}>
          <label style={{border:`1px dashed ${C.blue}88`,background:`${C.blue}12`,color:C.blue,borderRadius:14,padding:"12px 14px",fontSize:12,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span>📄 Cargar un PDF para revisar</span>
            <input type="file" accept="application/pdf,.pdf" onChange={e=>{handleRemitoPdfUpload(e.target.files?.[0]);e.target.value="";}} style={{display:"none"}}/>
          </label>
          <label style={{border:`1px dashed ${C.green}88`,background:`${C.green}12`,color:C.green,borderRadius:14,padding:"12px 14px",fontSize:12,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <span>📚 Seleccionar varios PDF y agregarlos al lote</span>
            <input type="file" multiple accept="application/pdf,.pdf" onChange={e=>{handleMultipleRemitoPdfUpload(e.target.files);e.target.value="";}} style={{display:"none"}}/>
          </label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(150px,1fr))",gap:10}}>
          <input value={remitoForm.comprobante} onChange={e=>updateRemitoField("comprobante",e.target.value)} placeholder="Comprobante / N° remito" style={inputStyle}/>
          <input value={remitoForm.fecha} onChange={e=>updateRemitoField("fecha",e.target.value)} type="date" style={inputStyle}/>
          <input value={remitoForm.origen} onChange={e=>updateRemitoField("origen",e.target.value)} placeholder="Origen" style={inputStyle}/>
          <input value={remitoForm.destino} onChange={e=>updateRemitoField("destino",e.target.value)} placeholder="Destino" style={inputStyle}/>
          <input value={remitoForm.observaciones} onChange={e=>updateRemitoField("observaciones",e.target.value)} placeholder="Observaciones" style={inputStyle}/>
        </div>
        <div style={{overflowX:"auto",border:`1px solid ${C.border}55`,borderRadius:14}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Inter, system-ui, sans-serif"}}>
            <thead style={{background:"rgba(0,0,0,.35)"}}>
              <tr>
                <th style={{...thStyle,cursor:"default"}}>Artículo / código</th>
                <th style={{...thStyle,cursor:"default"}}>Descripción</th>
                <th style={{...thStyle,cursor:"default",textAlign:"right"}}>Cantidad enviada</th>
                <th style={{...thStyle,cursor:"default"}}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {remitoForm.items.map((it,idx)=>(
                <tr key={idx}>
                  <td style={tdStyle}><input value={it.codigo} onChange={e=>updateRemitoItem(idx,"codigo",e.target.value)} placeholder="Ej: 196" style={{...inputStyle,width:"100%"}}/></td>
                  <td style={tdStyle}><input value={it.descripcion} onChange={e=>updateRemitoItem(idx,"descripcion",e.target.value)} placeholder="Descripción del remito" style={{...inputStyle,width:"100%"}}/></td>
                  <td style={{...tdStyle,textAlign:"right"}}><input value={it.cantidad} onChange={e=>updateRemitoItem(idx,"cantidad",e.target.value)} placeholder="0" style={{...inputStyle,width:120,textAlign:"right"}}/></td>
                  <td style={tdStyle}><button onClick={()=>removeRemitoItem(idx)} style={{border:`1px solid ${C.red}66`,background:`${C.red}16`,color:C.red,borderRadius:10,padding:"7px 10px",fontWeight:900,cursor:"pointer"}}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"space-between",flexWrap:"wrap"}}>
          <button onClick={addRemitoItem} style={{border:`1px solid ${C.blue}66`,background:`${C.blue}16`,color:C.blue,borderRadius:10,padding:"9px 12px",fontWeight:900,cursor:"pointer"}}>+ Agregar artículo</button>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button onClick={agregarRemitoActualAlLote} disabled={loading} style={{border:`1px solid ${C.blue}66`,background:`${C.blue}16`,color:C.blue,borderRadius:10,padding:"9px 12px",fontWeight:900,cursor:"pointer",opacity:loading?0.65:1}}>+ Agregar remito al lote</button>
            <button onClick={registerRemito} disabled={loading} style={{border:`1px solid ${C.green}66`,background:`${C.green}16`,color:C.green,borderRadius:10,padding:"9px 12px",fontWeight:900,cursor:"pointer",opacity:loading?0.65:1}}>{loading?"Guardando...":`Guardar ${remitosPendientes.length+((remitoForm.items||[]).some(it=>String(it.codigo||"").trim()&&toNumber(it.cantidad)>0)?1:0)} remito(s)`}</button>
          </div>
        </div>
        {remitosPendientes.length>0&&(
          <div style={{border:`1px solid ${C.green}55`,background:`${C.green}0d`,borderRadius:14,padding:12,display:"grid",gap:9}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div style={{fontWeight:900,color:C.green}}>Lote pendiente: {remitosPendientes.length} remito(s)</div>
              <button onClick={()=>setRemitosPendientes([])} style={{border:`1px solid ${C.red}55`,background:`${C.red}12`,color:C.red,borderRadius:9,padding:"6px 9px",fontWeight:900,cursor:"pointer"}}>Vaciar lote</button>
            </div>
            {remitosPendientes.map((r,idx)=>(
              <div key={r._loteId||idx} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"9px 10px",border:`1px solid ${C.border}44`,borderRadius:10,background:"rgba(0,0,0,.16)"}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:900,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{idx+1}. {r.comprobante||"S/N"} · {r.fecha||"sin fecha"}</div>
                  <div style={{fontSize:11,color:C.textSub}}>{(r.items||[]).length} artículo(s){r._archivo?` · ${r._archivo}`:""}</div>
                </div>
                <button onClick={()=>quitarRemitoDelLote(r._loteId)} style={{border:`1px solid ${C.red}55`,background:`${C.red}12`,color:C.red,borderRadius:9,padding:"6px 9px",fontWeight:900,cursor:"pointer"}}>Quitar</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{background:"rgba(20,20,20,.72)",border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",backdropFilter:"blur(6px)"}}>
        <div style={{padding:14,borderBottom:`1px solid ${C.border}33`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontWeight:900,color:C.text}}>Remitos cargados</div>
            <div style={{fontSize:11,color:C.textSub,fontWeight:700}}>Se sincronizan desde Google Sheets y se muestran a todos los usuarios.</div>
          </div>
          <input value={remitoSearch} onChange={e=>setRemitoSearch(e.target.value)} placeholder="Buscar por N° de remito" style={{...inputStyle,minWidth:240}}/>
        </div>
        {filteredRemitos.length?filteredRemitos.map(rem=>(
          <div key={rem.id} style={{padding:14,borderBottom:`1px solid ${C.border}22`,display:"grid",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
              <div style={{fontWeight:900,color:C.text}}>{rem.comprobante} · {formatDateLocal(rem.fecha)} <span style={{color:C.textSub,fontWeight:700}}>({rem.observaciones||"sin observaciones"})</span></div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={()=>setRemitoDetalleId(prev=>prev===rem.id?null:rem.id)} style={{border:`1px solid ${C.blue}66`,background:`${C.blue}16`,color:C.blue,borderRadius:10,padding:"6px 10px",fontWeight:900,cursor:"pointer"}}>{remitoDetalleId===rem.id?"Ocultar detalle":"Ver detalle"}</button>
                <button onClick={()=>deleteRemito(rem.id)} style={{border:`1px solid ${C.red}66`,background:`${C.red}16`,color:C.red,borderRadius:10,padding:"6px 10px",fontWeight:900,cursor:"pointer"}}>Eliminar</button>
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {(rem.items||[]).map((it,i)=><span key={i} style={badgeStyle("info")}>{it.codigo}: {fmtNum(it.cantidad)}</span>)}
            </div>
            {remitoDetalleId===rem.id&&(
              <div style={{border:`1px solid ${C.border}55`,borderRadius:12,overflow:"hidden",background:"rgba(0,0,0,.18)"}}>
                <div style={{padding:"10px 12px",display:"grid",gridTemplateColumns:"repeat(4,minmax(140px,1fr))",gap:10,borderBottom:`1px solid ${C.border}33`}}>
                  <div><span style={{fontSize:10,color:C.textSub,fontWeight:900,textTransform:"uppercase"}}>Fecha</span><div style={{color:C.text,fontWeight:900}}>{formatDateLocal(rem.fecha)}</div></div>
                  <div><span style={{fontSize:10,color:C.textSub,fontWeight:900,textTransform:"uppercase"}}>N° remito</span><div style={{color:C.text,fontWeight:900}}>{rem.comprobante||"S/N"}</div></div>
                  <div><span style={{fontSize:10,color:C.textSub,fontWeight:900,textTransform:"uppercase"}}>Lugar</span><div style={{color:C.text,fontWeight:900}}>{rem.destino||rem.origen||rem.observaciones||"-"}</div></div>
                  <div><span style={{fontSize:10,color:C.textSub,fontWeight:900,textTransform:"uppercase"}}>Origen</span><div style={{color:C.text,fontWeight:900}}>{rem.origen||"-"}</div></div>
                </div>
                <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"Inter, system-ui, sans-serif"}}>
                    <thead style={{background:"rgba(0,0,0,.28)"}}>
                      <tr>
                        <th style={{...thStyle,cursor:"default",width:120}}>Código</th>
                        <th style={{...thStyle,cursor:"default"}}>Insumo</th>
                        <th style={{...thStyle,cursor:"default",textAlign:"right",width:130}}>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rem.items||[]).map((it,i)=>(
                        <tr key={i}>
                          <td style={tdStyle}>{it.codigo||"-"}</td>
                          <td style={tdStyle}>{it.descripcion||"-"}</td>
                          <td style={{...tdStyle,textAlign:"right",fontWeight:900}}>{fmtNum(it.cantidad)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )):(
          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>
        )}
      </div>
    </div>
  );

  const renderEnviosSinSolicitud=()=>{
    const cols=[
      {key:"codigoArticulo",label:"Código de artículo",width:"16%"},
      {key:"descripcion",label:"Descripción",width:"47%"},
      {key:"numeroRemito",label:"Remito",width:"15%"},
      {key:"cantidadEnviada",label:"Cant. enviada",align:"right",width:"10%"},
      {key:"fechaEnvio",label:"Fecha de envío",width:"12%"},
    ];
    return (
      <Card>
        <div style={{padding:14,borderBottom:`1px solid ${C.border}33`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:15,fontWeight:900,color:C.text}}>Envíos sin solicitud</div>
            <div style={{fontSize:11,color:C.textSub,fontWeight:700}}>Artículos cargados mediante remitos cuyo código no existe en ninguna solicitud RABA03.</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:9}}>
            <span style={badgeStyle(enviosSinSolicitudRows.length?"bad":"ok")}>{fmtNum(enviosSinSolicitudRows.length)} registros</span>
            <button onClick={exportarEnviosSinSolicitud} style={{height:34,border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,borderRadius:10,padding:"0 12px",fontSize:12,fontWeight:900,cursor:"pointer"}}>Excel</button>
          </div>
        </div>
        <div style={{overflowX:"hidden",overflowY:"auto",maxHeight:650}}>
          <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
            <colgroup>
              {cols.map(c=><col key={c.key} style={{width:c.width}} />)}
            </colgroup>
            <thead style={{position:"sticky",top:0,zIndex:1,background:"rgba(16,16,16,.97)"}}>
              <tr>{cols.map(c=><th key={c.key} style={{...thStyle,textAlign:c.align||"left",cursor:"default",whiteSpace:"normal",lineHeight:1.15,paddingLeft:10,paddingRight:10}}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {enviosSinSolicitudRows.length?enviosSinSolicitudRows.map(r=>(
                <tr key={r.id}>
                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={r.codigoArticulo||""}>{r.codigoArticulo||"S/C"}</td>
                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} title={r.descripcion||""}>{r.descripcion||"—"}</td>
                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:800}} title={r.numeroRemito||""}>{r.numeroRemito||"—"}</td>
                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,textAlign:"right",fontWeight:900,color:C.yellow,whiteSpace:"nowrap"}}>{fmtNum(r.cantidadEnviada)}</td>
                  <td style={{...tdStyle,paddingLeft:10,paddingRight:10,whiteSpace:"nowrap"}}>{formatDateLocal(r.fechaEnvio)||"—"}</td>
                </tr>
              )):(<tr><td colSpan={5} style={{...tdStyle,textAlign:"center",padding:28,color:C.textSub}}>No se detectaron artículos enviados sin solicitud.</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  return (
    <div style={{display:"grid",gap:14,fontFamily:"Inter, system-ui, sans-serif"}}>
      {actionLoading&&ReactDOM.createPortal(
        <div style={{position:"fixed",inset:0,zIndex:999999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.68)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)"}}>
          <div style={{minWidth:390,background:"rgba(20,20,20,.97)",border:`1px solid ${C.border}`,borderRadius:18,padding:"22px 30px",boxShadow:"0 22px 70px rgba(0,0,0,.62)",textAlign:"center"}}>
            <LoadingMotoniveladora size={340} label={actionLoading}/>
          </div>
        </div>,document.body
      )}
      {renderImportModal()}
      {renderRejectModal()}
      {renderSuccessAlert()}
      {!["dashboard","remito","stock","stockDashboard","raba03","enviosSinSolicitud"].includes(tab)&&(<Card>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={rabaFilterMode==="dia"} onClick={()=>setRabaFilterMode("dia")}>Por día</TabBtn>
            <TabBtn active={rabaFilterMode==="periodo"} onClick={()=>setRabaFilterMode("periodo")}>Por período</TabBtn>
          </div>
          {rabaFilterMode==="dia"&&<DateIn label="Fecha" value={rabaDate} onChange={setRabaDate}/>}
          {rabaFilterMode==="periodo"&&<><PeriodMonthYear fechaD={rabaDateFrom} fechaH={rabaDateTo} setFechaD={setRabaDateFrom} setFechaH={setRabaDateTo}/><DateIn label="Desde" value={rabaDateFrom} onChange={setRabaDateFrom} max={rabaDateTo||undefined}/><DateIn label="Hasta" value={rabaDateTo} onChange={setRabaDateTo} min={rabaDateFrom||undefined} warn={rabaDateTo&&rabaDateFrom&&rabaDateTo<rabaDateFrom?"≥ Desde":null}/></>}
          <MultiSel label="Proyecto" value={project} onChange={setProject} options={[{value:"todos",label:"Todos"},...projects.map(p=>({value:p,label:p}))]}/>
          <MultiSel label="Empresa" value={company} onChange={setCompany} options={[{value:"todos",label:"Todas"},...companies.map(e=>({value:e,label:e}))]}/>
          <MultiSel label="Supervisor" value={supervisor} onChange={setSupervisor} options={[{value:"todos",label:"Todos"},...supervisors.map(s=>({value:s,label:s}))]}/>
          <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:290}}>
            <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Buscar</label>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar descripción, código, solicitante..." style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:12,outline:"none",fontFamily:"Inter"}}/>
          </div>
          {!readOnly&&<>
            {tab==="solicitudes"&&(<label style={{height:34,display:"inline-flex",alignItems:"center",gap:8,border:`1px solid ${C.green}66`,borderRadius:10,background:`${C.green}16`,color:C.green,padding:"0 12px",fontSize:12,fontWeight:900,cursor:"pointer",alignSelf:"flex-end"}} title="Importar Excel con encabezados en fila 6">
              📥 Cargar Excel Solicitudes
              <input type="file" accept=".xlsx,.xls" onChange={e=>{handleSolicitudesExcelUpload(e.target.files?.[0]); e.target.value="";}} style={{display:"none"}}/>
            </label>)}
            {["pendientes","parciales","cerradas","rechazadas"].includes(tab)&&(<button onClick={generarExcelEstadoRABA03} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.green}66`,background:`${C.green}18`,color:C.green,cursor:"pointer",fontSize:11,fontWeight:900,fontFamily:"Inter",alignSelf:"flex-end"}}><Icon name="fileSpreadsheet" size={12} color={C.green}/>Descargar Excel</button>)}
            <button onClick={tab==="editarCodigos"?guardarCodigosRABA03:guardarDatosRABA03} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.blue}44`,background:`${C.blue}16`,color:C.blue,cursor:"pointer",fontSize:11,fontWeight:800,fontFamily:"Inter",alignSelf:"flex-end"}}><Icon name="check" size={11} color={C.blue}/>Guardar datos</button>
          </>}
          <button onClick={resetRabaFilters} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltrosRaba?1:0.3,pointerEvents:hayFiltrosRaba?"auto":"none",alignSelf:"flex-end"}}><Icon name="close" size={11} color={C.red}/>Limpiar filtros</button>
        </div>
      </Card>)}


      {!["dashboard","stock","stockDashboard"].includes(tab)&&(
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="warn" label="Pendientes" value={fmtNum(stats.pendientes)} sub="sin artículos enviados" color={C.yellow} small/>
        <StatCard icon="report" label="Parciales" value={fmtNum(stats.parciales)} sub="enviados parcialmente" color={C.blue} small/>
        <StatCard icon="check" label="Cerradas" value={fmtNum(stats.cerradas)} sub="cantidad completa enviada o cierre manual" color={C.green} small/>
        <StatCard icon="close" label="Rechazadas" value={fmtNum(stats.rechazadas)} sub="con observación" color={C.red} small/>
        <StatCard icon="report" label="Total ítems" value={fmtNum(stats.total)} sub="solicitudes cargadas" color={C.blue} small/>
      </div>
      )}

      {error&&<div style={{border:`1px solid ${C.red}66`,background:`${C.red}14`,color:C.red,borderRadius:14,padding:14,fontWeight:800}}>Error leyendo RABA03: {error}</div>}
      {loading&&ReactDOM.createPortal(
        <div style={{position:"fixed",inset:0,zIndex:999990,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.62)",backdropFilter:"blur(5px)",WebkitBackdropFilter:"blur(5px)"}}>
          <div style={{background:"rgba(20,20,20,.96)",border:`1px solid ${C.border}`,borderRadius:16,padding:"20px 28px",boxShadow:"0 18px 60px rgba(0,0,0,.55)"}}>
            <LoadingMotoniveladora size={340} label="Cargando RABA03..."/>
          </div>
        </div>,document.body
      )}

      {tab==="dashboard"?renderAbastecimientoDashboard():(tab==="stock"?renderStockControl():(tab==="stockDashboard"?renderStockDashboard():(tab==="remito"?renderRemito():(tab==="raba03"?renderRABA03Descarga():(tab==="editarCodigos"?renderEditarCodigos():(tab==="enviosSinSolicitud"?renderEnviosSinSolicitud():renderMainTable()))))))}
    </div>
  );
}


export default React.memo(AbastecimientoModule);
