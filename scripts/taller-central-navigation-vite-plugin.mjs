export function tallerCentralNavigationVitePlugin(){
  return {
    name:'delta-taller-central-navigation',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/App.jsx'))return null;
      let s=code;
      const importAnchor='import { EquipmentProfileView } from "./modules/equipment/index.js";';
      if(s.includes(importAnchor)&&!s.includes('TallerCentralMovementPage')){
        s=s.replace(importAnchor,`${importAnchor}\nimport TallerCentralMovementPage from "./modules/taller-central/TallerCentralMovementPage.jsx";`);
      }
      s=s.replace('tallerCentral:"Taller Central",rop02:', 'tallerCentral:"Taller Central",tallerMovimientoSubida:"Subida de equipo",tallerMovimientoBaja:"Bajada de equipo",tallerMovimientoMovilizacion:"Movilización de equipo",tallerMovimientoCambio:"Cambio de equipo",rop02:');
      const oldNav=`if(activeModule==="tallerCentral"){\n      return [\n        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},\n        {id:"equipmentProfile",icon:"truck",label:"Ficha única del equipo",type:"item",color:C.teal},\n        {id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C.teal},\n      ];\n    }`;
      const newNav=`if(activeModule==="tallerCentral"){\n      return [\n        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},\n        {id:"equipmentProfile",icon:"truck",label:"Ficha única del equipo",type:"item",color:C.teal},\n        {id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C.teal},\n        {id:"grp_taller_movimientos",icon:"truck",label:"Movimiento de equipos",type:"group",color:C.accent,children:[\n          {id:"tallerMovimientoSubida",icon:"truck",label:"Subida"},\n          {id:"tallerMovimientoBaja",icon:"warn",label:"Bajada"},\n          {id:"tallerMovimientoMovilizacion",icon:"shuffle",label:"Movilización"},\n          {id:"tallerMovimientoCambio",icon:"repeat",label:"Cambio de equipo"},\n        ]},\n      ];\n    }`;
      if(s.includes(oldNav))s=s.replace(oldNav,newNav);
      const renderAnchor='{view==="equipmentProfile"&&<ModuleErrorBoundary name="Ficha única del equipo" onRetry={loadData}><EquipmentProfileView';
      if(s.includes(renderAnchor)&&!s.includes('tallerMovimientoSubida"].includes(view)')){
        const movementRender='{["tallerMovimientoSubida","tallerMovimientoBaja","tallerMovimientoMovilizacion","tallerMovimientoCambio"].includes(view)&&<ModuleErrorBoundary name="Movimiento de equipos" onRetry={loadData}><TallerCentralMovementPage mode={view==="tallerMovimientoBaja"?"BAJA":view==="tallerMovimientoMovilizacion"?"MOVILIZACION":view==="tallerMovimientoCambio"?"CAMBIO_EQUIPO":"SUBIDA"} listaEquipos={listaEquipos} rop02All={rop02All}/></ModuleErrorBoundary>}\n                ';
        s=s.replace(renderAnchor,movementRender+renderAnchor);
      }
      return s===code?null:{code:s,map:null};
    }
  };
}
