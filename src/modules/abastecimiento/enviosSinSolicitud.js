const normalizeIdentityPart=value=>String(value??"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g," ")
  .trim()
  .replace(/\s+/g,"-");

const stableDatePart=(value,parseDateMs)=>{
  const ms=parseDateMs(value);
  if(!Number.isFinite(ms)||ms<=0)return normalizeIdentityPart(value)||"SIN-FECHA";
  const date=new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

export function buildEnvioSinSolicitudKey({
  codigoArticulo="",proyecto="",fechaEnvio="",numeroRemito="",descripcion="",
  remitoId="",lineaId="",remitoIndex=0,itemIndex=0,parseDateMs=()=>NaN,
}={}){
  const stableLine=normalizeIdentityPart(lineaId)||`${normalizeIdentityPart(remitoId)||`REMITO-${remitoIndex}`}#${itemIndex}`;
  return [
    normalizeIdentityPart(codigoArticulo)||"SIN-CODIGO",
    normalizeIdentityPart(proyecto)||"SIN-PROYECTO",
    stableDatePart(fechaEnvio,parseDateMs),
    normalizeIdentityPart(numeroRemito)||"SIN-REMITO",
    normalizeIdentityPart(descripcion)||"SIN-DESCRIPCION",
    stableLine,
  ].join("|");
}

export function allocateAbastecimientoRemitos({
  requestRows=[],sourceRemitos=[],normalizeCode=value=>String(value||"").trim(),
  normalizeProject=value=>String(value||"").trim(),parseDateMs=()=>NaN,
  toNumber=value=>Number(value)||0,formatDate=value=>value,
  isRejected=()=>false,
}={}){
  const rows=(requestRows||[]).map(row=>({
    ...row,
    cantidadEnviada:0,
    cantidadRestante:Math.max(0,toNumber(row?.cantidadSolicitada)),
    _matchedRemitos:[],
  }));
  const queues=new Map();
  rows.forEach((row,index)=>{
    if(isRejected(row))return;
    const code=normalizeCode(row.codigoArticulo);
    const project=normalizeProject(row.centroCosto);
    const requestDateMs=parseDateMs(row.fechaSolicitud);
    if(!code||!project||!Number.isFinite(requestDateMs)||requestDateMs<=0)return;
    const key=`${code}__${project}`;
    if(!queues.has(key))queues.set(key,[]);
    queues.get(key).push({index,requestDateMs,sourceIndex:index});
  });
  queues.forEach(queue=>queue.sort((a,b)=>a.requestDateMs-b.requestDateMs||a.sourceIndex-b.sourceIndex));

  const shipments=[];
  (sourceRemitos||[]).forEach((remito,remitoIndex)=>{
    const project=normalizeProject(remito?.proyecto||remito?.observaciones||remito?.destino||remito?.centroCosto||remito?.origen||"");
    const fechaEnvio=remito?.fecha||"";
    const shipmentDateMs=parseDateMs(fechaEnvio);
    (remito?.items||[]).forEach((item,itemIndex)=>{
      const code=normalizeCode(item?.codigo);
      const quantity=toNumber(item?.cantidad);
      if(!code||!project||quantity<=0)return;
      const key=buildEnvioSinSolicitudKey({
        codigoArticulo:code,proyecto:project,fechaEnvio,numeroRemito:remito?.comprobante||"",
        descripcion:item?.descripcion||"",remitoId:remito?.id||"",
        lineaId:item?.id||item?.sourceRow||item?._sourceRow||"",remitoIndex,itemIndex,parseDateMs,
      });
      shipments.push({
        key,code,project,fechaEnvio,shipmentDateMs,quantity,
        numeroRemito:remito?.comprobante||"",descripcion:item?.descripcion||"",
        lugar:remito?.destino||remito?.observaciones||remito?.origen||"",
        remitoIndex,itemIndex,
      });
    });
  });
  shipments.sort((a,b)=>(a.shipmentDateMs||0)-(b.shipmentDateMs||0)||a.remitoIndex-b.remitoIndex||a.itemIndex-b.itemIndex);

  const unmatched=[];
  for(const shipment of shipments){
    let remaining=shipment.quantity;
    const queue=queues.get(`${shipment.code}__${shipment.project}`)||[];
    for(const request of queue){
      if(remaining<=0)break;
      // No hay retroactividad: sólo una solicitud ya existente puede consumir el envío.
      if(!Number.isFinite(shipment.shipmentDateMs)||shipment.shipmentDateMs<=0||request.requestDateMs>shipment.shipmentDateMs)continue;
      const row=rows[request.index];
      const pending=Math.max(0,toNumber(row.cantidadSolicitada)-toNumber(row.cantidadEnviada));
      if(pending<=0)continue;
      const applied=Math.min(pending,remaining);
      row.cantidadEnviada=toNumber(row.cantidadEnviada)+applied;
      row.cantidadRestante=Math.max(0,toNumber(row.cantidadSolicitada)-row.cantidadEnviada);
      row._matchedRemitos.push({
        key:shipment.key,numero:shipment.numeroRemito,fecha:formatDate(shipment.fechaEnvio),
        cantidad:applied,lugar:shipment.lugar,insumo:shipment.descripcion,
      });
      remaining-=applied;
    }
    if(remaining>0){
      unmatched.push({
        id:shipment.key,codigoArticulo:shipment.code,descripcion:shipment.descripcion,
        proyecto:shipment.project,cantidadEnviada:remaining,fechaEnvio:shipment.fechaEnvio,
        numeroRemito:shipment.numeroRemito,
      });
    }
  }
  return{rows,unmatched};
}
