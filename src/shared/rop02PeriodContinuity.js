/**
 * Separa el rango visible de los registros de referencia de continuidad.
 *
 * Un control por mes debe comparar el primer registro del mes contra el
 * último registro anterior del mismo equipo y proyecto, sin exponer los
 * errores antiguos ni mezclar cambios de proyecto.
 *
 * No consulta a Supabase ni altera filas: usa sólo datos ROP02 ya cargados.
 */
export function selectRop02PeriodContinuityRows(rows=[],from="",to=""){
  const current=[];
  const previous=new Map();
  for(const row of rows||[]){
    const date=String(row?.fecha||"").slice(0,10);
    if(!date||(to&&date>to))continue;
    if(!from||date>=from){
      current.push(row);
      continue;
    }
    const machine=String(row?.maquina||row?._internoRaw||"").trim().toUpperCase();
    const project=String(row?.proyecto||"SIN PROYECTO").trim().toUpperCase();
    if(!machine)continue;
    const key=machine+"|||"+project;
    const entry=previous.get(key);
    if(!entry||date>entry.date){
      previous.set(key,{date,rows:[row]});
    }else if(date===entry.date){
      // Conservar TD y TN del mismo día, no solo la última fila visitada.
      entry.rows.push(row);
    }
  }
  return [...previous.values()].flatMap(entry=>entry.rows).concat(current);
}

export function limitRop02ErrorsToPeriod(errors,from="",to=""){
  const inRange=row=>{
    const date=String(row?.fecha||"").slice(0,10);
    return Boolean(date&&(!from||date>=from)&&(!to||date<=to));
  };
  return {
    ...errors,
    erroresPartes:(errors?.erroresPartes||[]).filter(inRange),
    erroresHoro:(errors?.erroresHoro||[]).filter(inRange),
    erroresDuplicados:(errors?.erroresDuplicados||[]).filter(inRange),
  };
}
