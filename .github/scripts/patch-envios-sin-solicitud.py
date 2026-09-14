from pathlib import Path

path = Path("src/modules/abastecimiento/AbastecimientoModule.jsx")
text = path.read_text(encoding="utf-8")

old_import = 'import {useProgressiveRows} from "../../hooks/useProgressiveRows.js";'
new_import = old_import + '\nimport { buildEnviosSinSolicitudRows } from "./enviosSinSolicitud.js";'
if "buildEnviosSinSolicitudRows" not in text:
    if old_import not in text:
        raise SystemExit("Import anchor not found")
    text = text.replace(old_import, new_import, 1)

old_fields = '''      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante
    };'''
new_fields = '''      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante,
      numeroRemitoFuente:String(pick(r,["Nº Remito","N° Remito","Numero Remito","Número Remito"])||"").trim(),
      fechaSalidaFuente:formatDateLocal(pick(r,["Fecha de salida","Fecha salida"])),
      cantidadEnviadaFuente:toNumber(pick(r,["Cant. Enviada","Cantidad enviada","Cant Enviada"])),
      _raba03ExplicitLinksLoaded:true
    };'''
if "_raba03ExplicitLinksLoaded:true" not in text:
    if old_fields not in text:
        raise SystemExit("normalizeRow anchor not found")
    text = text.replace(old_fields, new_fields, 1)

old_block = '''  const enviosSinSolicitudRows=useMemo(()=>{
    const base=(rows||[]).map(r=>({...r,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(r.cantidadSolicitada)),_matchedRemitos:[]}));
    return allocateRemitosToRequests(base,remitos).unmatched.sort((a,b)=>{
      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);
      if(fa!==fb)return fb-fa;
      return String(a.codigoArticulo||"").localeCompare(String(b.codigoArticulo||""),"es",{numeric:true,sensitivity:"base"});
    });
  },[rows,remitos,toNumber,allocateRemitosToRequests]);'''
new_block = '''  const enviosSinSolicitudRows=useMemo(()=>buildEnviosSinSolicitudRows({
    rows,
    remitos,
    normCode,
    toNumber,
    normalizeCentroCosto,
    parseChronoDateMs
  }),[rows,remitos,normCode,toNumber,normalizeCentroCosto]);'''
if old_block in text:
    text = text.replace(old_block, new_block, 1)
elif "buildEnviosSinSolicitudRows({" not in text:
    raise SystemExit("enviosSinSolicitudRows anchor not found")

path.write_text(text, encoding="utf-8")
