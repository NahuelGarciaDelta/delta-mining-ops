export function atrasoIchcFixesVitePlugin(){
  return {
    name:'delta-atraso-ichc-fixes',
    enforce:'pre',
    transform(code,id){
      let s=code;
      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx')){
        s=s.replace('if(Array.isArray(rows)&&ignoredCodes?.size){','if(false&&Array.isArray(rows)&&ignoredCodes?.size){');
      }
      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')){
        const atrasoSourceFilter='const rop02Prod=useMemo(()=>atrasoSource.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002" && r.fecha),[atrasoSource]);';
        if(!s.includes(atrasoSourceFilter)){
          throw new Error('[delta-atraso-ichc-fixes] No se encontro el filtro base de ViewAtrasoROP02. Se cancela el build para evitar desplegar Atraso sin camiones/camionetas.');
        }
        s=s.replace(
          atrasoSourceFilter,
          `const isAtrasoTruckOrPickup=row=>{\n    const tipo=String(row?.equipo||row?._tipo||row?.tipoEquipo||row?.["Tipo de Máquina"]||row?.["Tipo de Maquina"]||"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase();\n    const raw=String(row?.maquina||row?._internoRaw||"").trim().toUpperCase().replace(/\\s*\\(.*?\\)/g,"").replace(/[-_\\s]+JM$/i,"");\n    const compact=raw.replace(/[^A-Z0-9]/g,"");\n    const tipoVehiculo=tipo.includes("CAMIONETA")||tipo.includes("CAMION");\n    const prefijoVehiculo=/^(CTA|CAA|CAC|CAR|CAV|CAT|CDC)/.test(compact);\n    const patenteVehiculo=/^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(compact)||/^[A-Z]{3}[0-9]{3}(?:[A-Z]{2})?$/.test(compact);\n    return tipoVehiculo||prefijoVehiculo||patenteVehiculo;\n  };\n  const rop02Prod=useMemo(()=>atrasoSource.filter(r=>Boolean(r?.fecha)&&(!r._excluded||isAtrasoTruckOrPickup(r))),[atrasoSource]);`
        );
        s=s.replace(
          'const atrasadosAceptados=atrasosFiltrados.filter(r=>r.admitido);\n  const saltosSinCausa=saltosFiltrados.filter(r=>!r.admitido).length;',
          'const atrasadosAceptadosBase=atrasosFiltrados.filter(r=>r.admitido);\n  const saltosAceptados=saltosFiltrados.filter(r=>r.admitido);\n  const atrasadosAceptados=[...atrasadosAceptadosBase,...saltosAceptados].sort((a,b)=>String(b.fechaAdmitido||b.ultimaCarga||"").localeCompare(String(a.fechaAdmitido||a.ultimaCarga||"")));\n  const saltosPendientes=saltosFiltrados.filter(r=>!r.admitido);\n  const saltosSinCausa=saltosPendientes.length;'
        );
        s=s.replace('Saltos de carga por equipo (${saltosFiltrados.length})','Saltos de carga por equipo (${saltosPendientes.length})');
        s=s.replace('colsSaltos.filter(c=>c.key!=="accion"),saltosFiltrados,"Saltos_ROP02"','colsSaltos.filter(c=>c.key!=="accion"),saltosPendientes,"Saltos_ROP02"');
        s=s.replace('cols={colsSaltos} rows={saltosFiltrados}','cols={colsSaltos} rows={saltosPendientes}');
        s=s.replace(
          '<StatCard icon="prod" label="% Cumplimiento" value={`${totales.pct}%`} sub={totales.pct>=90?"ÓPTIMO":totales.pct>=70?"ATENCIÓN":"CRÍTICO"} color={semPct(totales.pct).color} small/>',
          '<StatCard icon="prod" label="% Cumplimiento" value={`${totales.pctPromedio}%`} sub={totales.pctPromedio>=90?"ÓPTIMO":totales.pctPromedio>=70?"ATENCIÓN":"CRÍTICO"} color={semPct(totales.pctPromedio).color} small/>'
        );
        s=s.replace('const sem=semPct(totales.pct);','const sem=semPct(totales.pctPromedio);');
        s=s.replace('>{totales.pct}%</span>','>{totales.pctPromedio}%</span>');
      }
      return s===code?null:{code:s,map:null};
    }
  };
}
