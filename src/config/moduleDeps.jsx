import React from "react";
import {
  AlertBanner, Badge, C, Card, ChartTip, DateIn, HelpTip, Icon, LoadingMotoniveladora,
  MultiSel, PeriodMonthYear, Sel, Spinner, StatCard, SubTab, TabBtn, Table, SortableTH,
  dmProjectMatches, matchMulti, multiIncludes, multiIsAll, normalizeMultiValue, sortRowsForTable
} from "../components/ui/index.jsx";
import { APPS_SCRIPT_URL } from "./app.js";
import { appAlert, appConfirm } from "../services/dialogService.js";
import { postAddListaEquipo, postBulkUpdateListaEquipos, postUpdateListaEquipo, postUpdateROP02Row } from "../services/writeActions.js";
import { positionTip } from "../shared/dom.js";
import { HIST_COSTO_MENSUAL_ACUMULADO } from "../data/historicalCostData.js";
import { informeCostosCommand as dmCategoriasCommand } from "../modules/informe-costos/services/informeCostosWorkerClient.js";
import {
  AmortRow, BtnExcel, CategoriaModeloTableRow, CodeMultiSearch, HealthDashboard, ParamInput
} from "../modules/analytics/index.js";
import {
  IMG_CARGADORA_FRONTAL, IMG_EXCAVADORA, IMG_MINICARGADORA, IMG_MOTONIVELADORA,
  IMG_RETROPALA, IMG_RODILLO_COMPACTADOR, IMG_TOPADORA, LISTA_COLUMNS,
  ListaEquipoFieldInput, ROP05_TIPOS_MAQUINA, VEH_CAMIONETA, VEH_COMBUSTIBLE,
  VEH_REGADOR, VEH_TRACTOR, VEH_VOLCADOR, buildHorometroMapForLista,
  buildListaEquipoInfoIndex, buildMonthKeysCosto, buildVehicleListaIndex, byDateFilter,
  canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmDisplayTarea,
  dmMatchTipoMaquinaSeleccion, dmNormKey, dmNormalizeUnidad, dmTipoMaquinaOptions,
  esMaquinaCosto, excelFromCols, findColumnKey, fmtARS, fmtFecha, fmtNum, fmtPct, fmtUSD,
  generarExcelCodigosSinPrecio, generarExcelICHC, generarExcelListaMaestra,
  generarExcelMantenimiento, generarReporteControl, getInsumoExtra, getListaEquipoInfoMatch,
  getListaVehicleMatch, getMachineType, getPropiedadVehiculoFromListaRow, getValue,
  getExactValue, isExcluded, isRop02ControlMachineExcluded,
  isValidEquipoCodigoParaCorrelacion, isYearOnlyListaField, machineCodeOutsideParentheses,
  machineLookupVariants, mainMachineCode, monthKeyCosto, monthLabelCosto, normDate,
  normProject, normalizeInflatedMoneyValue, normalizeInsumoCode, normalizeMachineCode,
  normalizeVehicleFamily, normalizeYearValue, proyColor, semaforo, tipoEquipoCosto,
  tipoMatchMachineROP05, toMoneyNumber, toNumber, uniq, validPropiedadValue
} from "../shared/domain/index.jsx";

export const COSTOS_UNITARIOS_DEPS = Object.freeze({
  C,Card,Icon,Spinner,Badge,StatCard,Table,SortableTH,Sel,MultiSel,DateIn,TabBtn,AlertBanner,HelpTip,
  fmtNum,fmtFecha,fmtARS,fmtUSD,uniq,normDate,normalizeInsumoCode,normalizeInflatedMoneyValue,toMoneyNumber,getExactValue,getInsumoExtra,getValue,cleanKey,toNumber,multiIsAll,matchMulti,dmNormKey,canonicalEquivalentMachineCode,tipoEquipoCosto,esMaquinaCosto,excelFromCols,generarExcelCodigosSinPrecio
});

export const OPERATIONAL_ANALYTICS_DEPS = Object.freeze({
  C,Icon,Spinner,Badge,StatCard,Card,Table,Sel,MultiSel,DateIn,PeriodMonthYear,TabBtn,AlertBanner,HelpTip,
  fmtNum,fmtFecha,uniq,normDate,cleanMachine,canonicalEquivalentMachineCode,isRop02ControlMachineExcluded,dmMatchTipoMaquinaSeleccion,dmTipoMaquinaOptions,matchMulti,multiIsAll,multiIncludes,normalizeMachineCode,getMachineType,isExcluded,excelFromCols,proyColor,semaforo,appAlert
});

const HealthDashboardBound = props => <HealthDashboard deps={OPERATIONAL_ANALYTICS_DEPS} {...props}/>;

export const INFORME_COSTOS_DEPS = Object.freeze({
  AmortRow, Badge, C, Card, CategoriaModeloTableRow, DateIn,
  HIST_COSTO_MENSUAL_ACUMULADO, MultiSel, ParamInput, PeriodMonthYear, SortableTH,
  appAlert, appConfirm, buildMonthKeysCosto, byDateFilter,
  canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmCategoriasCommand,
  esMaquinaCosto, findColumnKey, fmtNum, getMachineType, getValue,
  mainMachineCode, matchMulti, monthKeyCosto, monthLabelCosto, multiIsAll,
  normalizeInsumoCode, normalizeMachineCode, normalizeMultiValue, positionTip,
  proyColor, sortRowsForTable, tipoEquipoCosto, toNumber, uniq
});

export const createOficinaTecnicaDeps = BlockingDataLoader => Object.freeze({
  AlertBanner, Badge, BtnExcel, C, Card, ChartTip, DateIn, HealthDashboard:HealthDashboardBound,
  IMG_CARGADORA_FRONTAL, IMG_EXCAVADORA, IMG_MINICARGADORA, IMG_MOTONIVELADORA,
  IMG_RETROPALA, IMG_RODILLO_COMPACTADOR, IMG_TOPADORA, Icon, LISTA_COLUMNS,
  ListaEquipoFieldInput, MultiSel, PeriodMonthYear, Sel, Spinner, StatCard, SubTab, TabBtn, Table,
  VEH_CAMIONETA, VEH_COMBUSTIBLE, VEH_REGADOR, VEH_TRACTOR, VEH_VOLCADOR,
  appAlert, appConfirm, buildHorometroMapForLista, buildListaEquipoInfoIndex, buildVehicleListaIndex,
  byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmDisplayTarea,
  dmMatchTipoMaquinaSeleccion, dmNormalizeUnidad, dmTipoMaquinaOptions, excelFromCols, findColumnKey,
  fmtFecha, fmtNum, fmtPct, generarExcelICHC, generarExcelListaMaestra, generarReporteControl,
  getListaEquipoInfoMatch, getListaVehicleMatch, getPropiedadVehiculoFromListaRow, getValue,
  isRop02ControlMachineExcluded, isValidEquipoCodigoParaCorrelacion, isYearOnlyListaField,
  machineCodeOutsideParentheses, machineLookupVariants, mainMachineCode, matchMulti, multiIsAll,
  normDate, normProject, normalizeMachineCode, normalizeVehicleFamily, normalizeYearValue,
  postAddListaEquipo, postBulkUpdateListaEquipos, postUpdateListaEquipo, postUpdateROP02Row,
  proyColor, semaforo, uniq, validPropiedadValue, BlockingDataLoader
});

export const MANTENIMIENTO_DEPS = Object.freeze({
  C, Card, Badge, MultiSel, Sel, DateIn, PeriodMonthYear, TabBtn, StatCard, SortableTH, BtnExcel, Icon,
  fmtNum, fmtUSD, fmtFecha, normDate, uniq, matchMulti, multiIsAll, tipoMatchMachineROP05,
  normalizeInsumoCode, positionTip, sortRowsForTable, appAlert, appConfirm, proyColor, getValue,
  generarExcelMantenimiento, ROP05_TIPOS_MAQUINA, CodeMultiSearch
});

export const ABASTECIMIENTO_DEPS = Object.freeze({
  APPS_SCRIPT_URL, C, Card, DateIn, Icon, LoadingMotoniveladora, MultiSel, PeriodMonthYear,
  StatCard, TabBtn, appAlert, appConfirm, dmProjectMatches, fmtFecha, fmtNum, matchMulti, multiIsAll,
});

export const LICITACIONES_DEPS = Object.freeze({
  APPS_SCRIPT_URL, C, Icon, Spinner, appAlert, appConfirm, dmNormKey,
});
