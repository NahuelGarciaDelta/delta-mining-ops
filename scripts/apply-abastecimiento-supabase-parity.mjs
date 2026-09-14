import fs from 'node:fs';

const path='src/modules/abastecimiento/AbastecimientoModule.jsx';
let s=fs.readFileSync(path,'utf8');

const oldReq=`      const code=normCode(row.codigoArticulo);\n      const proyecto=normalizeCentroCosto(row.centroCosto);\n      const insumoKey=norm(row.descripcion);\n      if(!code||!proyecto||!insumoKey)return;\n      // Clave de asignación: código + proyecto + nombre normalizado del insumo.\n      // La fecha NO se usa para mezclar períodos: se valida abajo como límite temporal.\n      const key=[code,proyecto,insumoKey].join("__");`;
const newReq=`      const code=normCode(row.codigoArticulo);\n      const proyecto=normalizeCentroCosto(row.centroCosto);\n      if(!code||!proyecto)return;\n      // Paridad con la app Supabase: asignación por código + proyecto.\n      // La fecha se valida después para impedir consumir solicitudes futuras.\n      const key=\`${'${code}__${proyecto}'}\`;`;
if(!s.includes(oldReq))throw new Error('No se encontró la clave actual de solicitud');
s=s.replace(oldReq,newReq);

const oldShip=`        const code=normCode(item.codigo);\n        const insumoKey=norm(item.descripcion);\n        const cantidad=toNumber(item.cantidad);\n        if(!code||!insumoKey||cantidad<=0)return;\n        shipments.push({\n          id:\`${'${remito.id||remito.comprobante||"remito"}-${itemIndex}-${code}'}\`,\n          code,proyecto,insumoKey,fecha,fechaMs,cantidad,`;
const newShip=`        const code=normCode(item.codigo);\n        const cantidad=toNumber(item.cantidad);\n        if(!code||cantidad<=0)return;\n        shipments.push({\n          id:\`${'${remito.id||remito.comprobante||"remito"}-${itemIndex}-${code}'}\`,\n          code,proyecto,fecha,fechaMs,cantidad,`;
if(!s.includes(oldShip))throw new Error('No se encontró el bloque actual de shipment');
s=s.replace(oldShip,newShip);

const oldKey='      const key=shipment.proyecto&&shipment.insumoKey?[shipment.code,shipment.proyecto,shipment.insumoKey].join("__"):"";';
const newKey='      const key=shipment.proyecto?`${shipment.code}__${shipment.proyecto}`:"";';
if(!s.includes(oldKey))throw new Error('No se encontró la clave actual de shipment');
s=s.replace(oldKey,newKey);

const oldDeps='  },[normCode,norm,toNumber,normalizeCentroCosto,formatDateLocal]);';
const newDeps='  },[normCode,toNumber,normalizeCentroCosto,formatDateLocal]);';
if(!s.includes(oldDeps))throw new Error('No se encontró dependencia norm del allocator');
s=s.replace(oldDeps,newDeps);

const oldState=`  // Recalcular asignación excluyendo solicitudes rechazadas. Una rechazada nunca\n  // consume remitos y siempre debe mostrarse con Cant. enviada = 0.\n  const stateAwareRows=useMemo(()=>{\n    const base=(rows||[]).map(row=>({...row,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(row.cantidadSolicitada)),_matchedRemitos:[]}));\n    const activas=base.filter(row=>!rejectedSolicitudes?.[buildSolicitudKey(row)]);\n    const asignadas=allocateRemitosToRequests(activas,remitos).rows;\n    const activasById=new Map(asignadas.map(row=>[row.id,row]));\n    return base.map(row=>rejectedSolicitudes?.[buildSolicitudKey(row)]?row:(activasById.get(row.id)||row));\n  },[rows,remitos,rejectedSolicitudes,buildSolicitudKey,allocateRemitosToRequests,toNumber]);\n\n  // Base visible para el usuario conectado. Todos los indicadores, gráficos y\n  // tablas de solicitudes se calculan exclusivamente sobre estas filas.\n  const assignedRows=useMemo(()=>\n    (stateAwareRows||[]).filter(r=>dmProjectMatches(r.centroCosto,assignedProject)),\n  [stateAwareRows,assignedProject]);`;
const newState=`  // Paridad con Supabase: la asignación base se conserva tal como fue calculada\n  // sobre todas las solicitudes. Para las rechazadas sólo se corrige la presentación:\n  // Cant. enviada = 0 y Cant. restante = solicitada, sin redistribuir sus remitos a\n  // otras solicitudes y alterar los conteos operativos.\n  const assignedRows=useMemo(()=>\n    (rows||[])\n      .filter(r=>dmProjectMatches(r.centroCosto,assignedProject))\n      .map(row=>rejectedSolicitudes?.[buildSolicitudKey(row)]\n        ? {...row,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(row.cantidadSolicitada)),_matchedRemitos:[]}\n        : row),\n  [rows,assignedProject,rejectedSolicitudes,buildSolicitudKey,toNumber]);`;
if(!s.includes(oldState))throw new Error('No se encontró stateAwareRows actual');
s=s.replace(oldState,newState);

const start='  const enviosSinSolicitudRows=useMemo(()=>{';
const end='\n  const exportarEnviosSinSolicitud=useCallback(()=>{';
const i=s.indexOf(start),j=i>=0?s.indexOf(end,i):-1;
if(i<0||j<0)throw new Error('No se encontró bloque Envíos sin solicitud');
const historical=`  const enviosSinSolicitudRows=useMemo(()=>{\n    // Regla histórica: una línea de remito sólo deja de ser \"sin solicitud\" si\n    // al momento del envío YA existía una solicitud válida del mismo código/proyecto.\n    // Una solicitud creada posteriormente nunca absorbe retroactivamente ese envío.\n    const solicitudesHistoricas=(rows||[])\n      .filter(r=>!rejectedSolicitudes?.[buildSolicitudKey(r)])\n      .map(r=>({\n        codigo:normCode(r.codigoArticulo),\n        proyecto:normalizeCentroCosto(r.centroCosto),\n        fechaMs:parseChronoDateMs(r.fechaSolicitud)\n      }))\n      .filter(r=>r.codigo);\n    const out=[];\n    (remitos||[]).forEach(rem=>{\n      const fecha=rem.fecha||\"\";\n      const fechaMs=parseChronoDateMs(fecha);\n      const proyecto=normalizeCentroCosto(rem.proyecto||rem.observaciones||rem.destino||rem.centroCosto||rem.origen||\"\");\n      (rem.items||[]).forEach((item,index)=>{\n        const codigoNormalizado=normCode(item.codigo);\n        if(!codigoNormalizado)return;\n        const teniaSolicitudAlEnviar=solicitudesHistoricas.some(sol=>\n          sol.codigo===codigoNormalizado&&\n          (!proyecto||!sol.proyecto||sol.proyecto===proyecto)&&\n          (!sol.fechaMs||!fechaMs||sol.fechaMs<=fechaMs)\n        );\n        if(teniaSolicitudAlEnviar)return;\n        out.push({\n          id:\`${'${rem.id||rem.comprobante||"remito"}-${index}-${codigoNormalizado}'}\`,\n          codigoArticulo:String(item.codigo||\"\").trim(),\n          descripcion:String(item.descripcion||\"\").trim(),\n          proyecto:proyecto||\"SIN PROYECTO\",\n          cantidadEnviada:toNumber(item.cantidad),\n          fechaEnvio:fecha,\n          numeroRemito:rem.comprobante||\"\"\n        });\n      });\n    });\n    return out.sort((a,b)=>{\n      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);\n      if(fa!==fb)return fb-fa;\n      return String(a.codigoArticulo||\"\").localeCompare(String(b.codigoArticulo||\"\"),\"es\",{numeric:true,sensitivity:\"base\"});\n    });\n  },[rows,remitos,normCode,toNumber,normalizeCentroCosto,rejectedSolicitudes,buildSolicitudKey]);`;
s=s.slice(0,i)+historical+s.slice(j);

if(!s.includes('if(req.fechaMs&&shipment.fechaMs&&req.fechaMs>shipment.fechaMs)continue;'))throw new Error('Falta barrera temporal solicitud<=envío');
if(!s.includes('const teniaSolicitudAlEnviar=solicitudesHistoricas.some'))throw new Error('No quedó la regla histórica de Envíos sin solicitud');
if(s.includes('const stateAwareRows=useMemo'))throw new Error('stateAwareRows no debe seguir redistribuyendo remitos');
if(!s.includes('cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(row.cantidadSolicitada)),_matchedRemitos:[]'))throw new Error('Rechazadas no quedaron visualmente en cero');

fs.writeFileSync(path,s);
console.log('Supabase parity + historical unmatched patch applied.');
