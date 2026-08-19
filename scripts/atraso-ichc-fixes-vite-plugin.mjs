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
