const norm = v => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export function dateKey(v){
  if(v instanceof Date && !Number.isNaN(v.getTime())) return ymd(v);
  const raw = String(v ?? "").trim();
  if(!raw) return "";
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,"0")}-${String(m[3]).padStart(2,"0")}`;
  m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if(m){ let yy=Number(m[3]); if(yy<100) yy+=2000; return `${yy}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`; }
  const d = new Date(raw); return Number.isNaN(d.getTime()) ? "" : ymd(d);
}

export function equipmentCode(r){
  return String(r?.maquina || r?.interno || r?.codigo || r?.["Código Interno del Equipo"] || r?.["Codigo Int"] || "").trim();
}

export function projectLabel(v){
  const n=norm(v);
  if(n.includes("JOSE")&&n.includes("MARIA")) return "José María";
  if(n.includes("FILO")&&n.includes("SOL")) return "Filo del Sol";
  return String(v||"S/D").trim()||"S/D";
}

export function stateKey(r){
  if(num(r?.horas)>0) return "TRABAJO";
  const s=norm(r?.estado||r?.status||r?.operativo||r?.horasRaw);
  if(s==="FS"||s.includes("FUERA")) return "FS";
  if(s==="EM"||s.includes("MANT")) return "EM";
  if(s==="OD"||s.includes("DISPOSIC")) return "OD";
  if(s==="TRABAJO"||s.includes("TRABAJO")||s==="OPERATIVO") return "TRABAJO";
  return "S/D";
}

export function enumerateDays(from,to){
  const a=new Date(`${from}T12:00:00`), b=new Date(`${to}T12:00:00`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||a>b) return [];
  const out=[];
  for(const d=new Date(a);d<=b;d.setDate(d.getDate()+1)) out.push(ymd(d));
  return out;
}

export function buildFleetUtilization(rows=[],from="",to=""){
  const days=enumerateDays(from,to);
  const totalDays=days.length;
  const byEquipment=new Map();
  for(const r of rows||[]){
    if(r?._excluded) continue;
    const d=dateKey(r?.fecha??r?.date), c=equipmentCode(r);
    if(!d||!c||(from&&d<from)||(to&&d>to)) continue;
    let eq=byEquipment.get(c);
    if(!eq){eq={code:c,project:r?.proyecto||"S/D",hours:0,byDay:new Map()};byEquipment.set(c,eq);}
    eq.hours += num(r?.horas);
    if(r?.proyecto) eq.project=r.proyecto;
    const day=eq.byDay.get(d)||{hours:0,states:[]};
    day.hours+=num(r?.horas); day.states.push(stateKey(r)); eq.byDay.set(d,day);
  }
  return [...byEquipment.values()].map(eq=>{
    const counts={TRABAJO:0,OD:0,EM:0,FS:0,"S/D":0};
    for(const d of days){
      const x=eq.byDay.get(d);
      if(!x){counts["S/D"]++;continue;}
      let s="S/D";
      if(x.hours>0) s="TRABAJO";
      else if(x.states.includes("FS")) s="FS";
      else if(x.states.includes("EM")) s="EM";
      else if(x.states.includes("OD")) s="OD";
      counts[s]++;
    }
    const utilization=totalDays?counts.TRABAJO/totalDays*100:0;
    const availability=totalDays?(counts.TRABAJO+counts.OD)/totalDays*100:0;
    return {code:eq.code,project:projectLabel(eq.project),hours:eq.hours,workDays:counts.TRABAJO,odDays:counts.OD,emDays:counts.EM,fsDays:counts.FS,noRecordDays:counts["S/D"],utilization,availability,totalDays};
  }).sort((a,b)=>b.utilization-a.utilization||b.hours-a.hours||a.code.localeCompare(b.code,"es",{numeric:true}));
}
