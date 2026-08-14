// ROP02 nunca se declara aquí: su única lectura normal es Supabase mediante
// rop02Repository/historicalDataService y consultas acotadas por pantalla.
export const VIEW_SOURCES=Object.freeze({
  bienvenida:["lista_equipos"],
  equipmentProfile:["lista_equipos","rop05","rma15_fs","rma15_jm","insumos"],
  dashboard:["insumos"],
  rop02:["lista_equipos"],horometros:[],vehiculos:["lista_equipos"],controlErrores:[],ctrlEquipo:[],controlROP02:[],atrasoROP02:[],combustible:[],cambiosTurno:[],chc:[],
  rop05:[],ranking:["rop05"],control:["rop05"],
  mant:["insumos"],distMant:[],
  pmProgramado:["lista_equipos"],pmDashboard:["lista_equipos"],pmPlanificador:["lista_equipos"],pmProgramacion:["lista_equipos"],pmPanel:["lista_equipos"],pmRealizado:["lista_equipos"],pmRepuestos:["lista_equipos"],pmGestion:["lista_equipos"],pmConfig:["lista_equipos"],pmHistorial:["lista_equipos"],
  rma15CtrlEquipo:["insumos"],costosMant:["insumos","lista_equipos"],costosUnitarios:["insumos"],
  listaEquipos:["lista_equipos"],tallerCentral:["lista_equipos"],
  licitaciones:["lista_equipos"],licitacionesNueva:["lista_equipos"],licitacionesControl:["lista_equipos"],licitacionesEquipos:["lista_equipos","rma15_fs","rma15_jm","insumos"],licitacionesDatosEquipos:["lista_equipos","rma15_fs","rma15_jm","insumos"],
});
