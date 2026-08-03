const FIXED_EQUIVALENCES = {
  'CFN-0041':'PCA-0081','CFN-0043':'PCA-0093','CFN-0044':'PCA-0095','CFN-0045':'PCA-0095',
  'EXC-0014':'EXC-0034','EXC-0019':'EXC-0048','MOT-0024':'MOT-0047',
  'RTP-0010':'RTP-0016','RTP-0012':'RTP-0024','TOP-0014':'TOP-0032','TOP-0059':'TOP-0058'
};
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const compact=v=>norm(v).replace(/[^A-Z0-9]/g,'');
const num=v=>{if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v??'').trim().replace(/[^0-9,.-]/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0;};
const read=(obj,aliases)=>{if(!obj)return'';const wanted=aliases.map(compact);for(const k of Object.keys(obj))if(wanted.includes(compact(k)))return obj[k];return'';};
const cleanCode=v=>{const s=norm(v).replace(/_/g,'-').replace(/\s+/g,'');const m=s.match(/([A-Z]{2,5})-?0*([0-9]{1,5})/);return m?`${m[1]}-${String(Number(m[2])).padStart(4,'0')}`:s;};
function buildEquipmentMap(lista=[]){const map={...FIXED_EQUIVALENCES};for(const row of lista){const nuevo=cleanCode(read(row,['Código Nuevo','Codigo Nuevo','Código Actual','Codigo Actual','Código Interno','Codigo Interno','CODIGO N° INTERNO','Interno']));const olds=[read(row,['Código Drusila','Codigo Drusila','Código de Drusila','Codigo de Drusila','Interno Drusila']),read(row,['Código Viejo','Codigo Viejo','Código Anterior','Codigo Anterior','Cod Viejo'])].map(cleanCode).filter(Boolean);if(nuevo)olds.forEach(o=>{if(o&&o!==nuevo)map[o]=nuevo;});}return map;}
function canonical(code,map){let c=cleanCode(code),guard=0;while(map[c]&&map[c]!==c&&guard++<8)c=map[c];return c;}
function monthKey(value){if(!value)return'';const s=String(value).trim();let m=s.match(/^(\d{4})[-/]([01]?\d)/);if(m)return`${m[1]}-${String(Number(m[2])).padStart(2,'0')}`;m=s.match(/^([0-3]?\d)[/-]([01]?\d)[/-](\d{4})/);if(m)return`${m[3]}-${String(Number(m[2])).padStart(2,'0')}`;const d=new Date(s);return Number.isNaN(d.getTime())?'':`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function sectionOf(project){const p=norm(project);return p.includes('JOSE')||p==='JM'?'JM':'FS';}
function maintenanceType(row){if(row?._esPreventivo!==undefined)return!!row._esPreventivo;return norm(row?.tipoMant??read(row,['Tipo mantenimiento','Tipo de mantenimiento','TIPO MANT.','Tipo Mant.'])).includes('PREV');}
function rowCost(row){const direct=num(row?._costoTotalARS);if(direct)return direct;return(Array.isArray(row?.insumos)?row.insumos:[]).reduce((s,x)=>s+num(x?.costoTotal??x?.total??x?.importe),0);}
function aggregateRows({rows,history,months,fixedMonths,monthlyDollar,usdRate,equipmentMap,minLiveMonth='2026-04'}){const map=Object.create(null);const ensure=(equipo,section)=>{const key=`${section}__${equipo}`;return map[key]||(map[key]={equipo,section,months:{},prev:0,corr:0,total:0});};for(const x of history||[]){const equipo=canonical(x?.equipo,equipmentMap);if(!equipo)continue;const row=ensure(equipo,x?.section==='JM'?'JM':'FS');for(const m of fixedMonths||[]){const d=x?.months?.[m.key]||{};const dst=row.months[m.key]||(row.months[m.key]={prev:0,corr:0,total:0});dst.prev+=num(d.prev);dst.corr+=num(d.corr);dst.total+=num(d.total)||num(d.prev)+num(d.corr);}}for(const r of rows||[]){const mes=monthKey(r?.fecha??read(r,['Fecha','FECHA','Fecha OT']));if(!mes||mes<minLiveMonth)continue;const equipo=canonical(r?.maquina??read(r,['Máquina','Maquina','Equipo','Código interno','Codigo interno']),equipmentMap);if(!equipo)continue;const section=sectionOf(r?.proyecto??read(r,['Proyecto','Lugar','Proyecto/Lugar']));const row=ensure(equipo,section);const dst=row.months[mes]||(row.months[mes]={prev:0,corr:0,total:0});const rate=num(monthlyDollar?.[mes])||num(usdRate)||1;const usd=rowCost(r)/rate;if(maintenanceType(r))dst.prev+=usd;else dst.corr+=usd;dst.total+=usd;}for(const row of Object.values(map)){for(const m of months||[]){const d=row.months[m.key]||{};row.prev+=num(d.prev);row.corr+=num(d.corr);row.total+=num(d.total);}}return Object.values(map).filter(x=>x.total>0).sort((a,b)=>a.section.localeCompare(b.section)||a.equipo.localeCompare(b.equipo));}
function aggregateBase(rows,equipmentMap){const map=Object.create(null);for(const r of rows||[]){const equipo=canonical(r?.maquina??read(r,['Máquina','Maquina','Equipo','Código interno','Codigo interno']),equipmentMap);if(!equipo)continue;const item=map[equipo]||(map[equipo]={equipo,prev:0,corr:0,total:0});const cost=rowCost(r);if(maintenanceType(r))item.prev+=cost;else item.corr+=cost;item.total+=cost;}return Object.values(map).filter(x=>x.total>0).sort((a,b)=>a.equipo.localeCompare(b.equipo));}
self.onmessage=e=>{const{id,type,payload}=e.data||{};try{if(type==='calculate'){const equipmentMap=buildEquipmentMap(payload.listaEquipos||[]);const result={tabla1:aggregateBase(payload.rma15Base||[],equipmentMap),costoMensualAcumulado:aggregateRows({rows:payload.rma15||[],history:payload.historial||[],months:payload.meses||[],fixedMonths:payload.mesesFijos||[],monthlyDollar:payload.monthlyDollar||{},usdRate:payload.usdRate,equipmentMap}),costoMensualAcumuladoMO:aggregateRows({rows:payload.rma15MO||[],history:payload.historialMO||[],months:payload.meses||[],fixedMonths:payload.mesesFijos||[],monthlyDollar:payload.monthlyDollar||{},usdRate:payload.usdRate,equipmentMap})};self.postMessage({id,ok:true,result});return;}if(type==='categories'){
      const assignments=payload.assignments||{};
      if(payload.mode==='applyRows'){
        const categoryOrder=(payload.categories||[]).map(norm);
        const rows=(payload.rows||[]).map(r=>({...r}));
        const groups=Object.create(null);
        for(const row of rows){
          const assigned=norm(assignments[row._categoriaKey]);
          if(assigned)row.tipo=assigned;
          row._grupoIndex=Math.max(0,categoryOrder.indexOf(norm(row.tipo)));
          if(categoryOrder.indexOf(norm(row.tipo))<0)row._grupoIndex=998;
          (groups[row.tipo]||(groups[row.tipo]=[])).push(row);
        }
        for(const arr of Object.values(groups)){
          const vals=arr.map(x=>num(x.pctMant)).filter(v=>v>0);
          const prom=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
          arr.sort((a,b)=>num(a._ordenGrupo)-num(b._ordenGrupo)||String(a.equipo).localeCompare(String(b.equipo)));
          arr.forEach((x,i)=>{x.promTipo=prom;x._firstTipo=i===0;x._grupoSize=i===0?arr.length:0;});
        }
        rows.sort((a,b)=>num(a._grupoIndex)-num(b._grupoIndex)||num(a._ordenGrupo)-num(b._ordenGrupo)||String(a.equipo).localeCompare(String(b.equipo)));
        self.postMessage({id,ok:true,result:{rows}});return;
      }
      const oldName=norm(payload.oldName),newName=norm(payload.newName)||'SIN CATEGORIA',next={...assignments};
      for(const k of Object.keys(next))if(norm(next[k])===oldName)next[k]=newName;
      self.postMessage({id,ok:true,result:{assignments:next}});return;
    }throw new Error(`Tipo desconocido: ${type}`);}catch(error){self.postMessage({id,ok:false,error:error?.message||String(error)});}};
