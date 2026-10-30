import {ROP02_SOURCE_KEYS} from "./rop02Sources.js";
const SECONDARY_ROP02_SOURCE_KEYS=ROP02_SOURCE_KEYS.filter(key=>key!=="rop02_fs"&&key!=="rop02_jm");
export const VIEW_SOURCES = Object.freeze({
  // El inicio prioriza las fuentes operativas registradas. Concurrencia=4:
  // FDS/JM + RMA15 FDS/JM salen en la primera tanda; el resto queda listo detrás.
  // ROP05 también se precarga para que Productividad/Control abran sin espera.
  v9Ops:[], // Panel V9: su API es independiente, no necesita precargar datasets pesados.
  bienvenida:["rop02_fs","rop02_jm","rma15_fs","rma15_jm","insumos","lista_equipos","rop05",...SECONDARY_ROP02_SOURCE_KEYS],
  equipmentProfile:["lista_equipos",...ROP02_SOURCE_KEYS,"rop05","rma15_fs","rma15_jm","insumos"],
  // Dashboard usa los mismos datasets hidratados por App desde Supabase.
  // No existe una segunda carga monolítica ni un snapshot bloqueante de Apps Script.
  dashboard:["rop02_fs","rop02_jm","rma15_fs","rma15_jm","rop05","insumos","lista_equipos",...SECONDARY_ROP02_SOURCE_KEYS],
  rop02:[...ROP02_SOURCE_KEYS],
  horometros:[...ROP02_SOURCE_KEYS],
  vehiculos:[...ROP02_SOURCE_KEYS,"lista_equipos"],
  controlErrores:[...ROP02_SOURCE_KEYS],
  ctrlEquipo:[...ROP02_SOURCE_KEYS],
  controlROP02:[...ROP02_SOURCE_KEYS],
  atrasoROP02:[...ROP02_SOURCE_KEYS],
  combustible:[...ROP02_SOURCE_KEYS],
  cambiosTurno:[...ROP02_SOURCE_KEYS],
  chc:[...ROP02_SOURCE_KEYS],
  rop05:["rop05"],
  gestionHumanaSitio:["lista_equipos",...ROP02_SOURCE_KEYS],
  gestionHumanaHistorial:["lista_equipos",...ROP02_SOURCE_KEYS],
  gestionHumanaRanking:[...ROP02_SOURCE_KEYS,"rop05"],
  control:[...ROP02_SOURCE_KEYS,"rop05"],
  mant:["insumos","rma15_fs","rma15_jm"],
  distMant:["rma15_fs","rma15_jm"],
  pmProgramado:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmDashboard:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmPlanificador:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmProgramacion:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmPanel:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmRealizado:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmRepuestos:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmGestion:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmConfig:["lista_equipos",...ROP02_SOURCE_KEYS],
  pmHistorial:["lista_equipos",...ROP02_SOURCE_KEYS],

  rma15CtrlEquipo:["insumos","rma15_fs","rma15_jm"],
  costosMant:["insumos","rma15_fs","rma15_jm","lista_equipos"],
  costosUnitarios:["insumos","rma15_fs","rma15_jm"],
  listaEquipos:["lista_equipos",...ROP02_SOURCE_KEYS],
  tallerCentral:["lista_equipos",...ROP02_SOURCE_KEYS],
  licitaciones:["lista_equipos"],
  licitacionesNueva:["lista_equipos"],
  licitacionesControl:["lista_equipos"],
  licitacionesEquipos:["lista_equipos","rma15_fs","rma15_jm","insumos"],
  licitacionesDatosEquipos:["lista_equipos",...ROP02_SOURCE_KEYS,"rma15_fs","rma15_jm","insumos"],
});

// Agrega una fuente nueva a las vistas que ya consumen partes ROP02.
// VIEW_SOURCES es un objeto estable; sus arrays internos son mutables.
export function attachRop02SourceToViews(dataset){
  const key=String(dataset||"");
  if(!/^rop02_[a-z0-9_]+$/.test(key))return 0;
  let added=0;
  for(const values of Object.values(VIEW_SOURCES)){
    if(!Array.isArray(values)||!values.some(v=>/^rop02_[a-z0-9_]+$/.test(v))||values.includes(key))continue;
    values.push(key);
    added++;
  }
  return added;
}
