export function administrativoDailyHiControlVitePlugin(){
  return {
    name:'delta-administrativo-daily-hi-control',
    enforce:'pre',
    transform(code,id){
      const file=String(id||'').replace(/\\/g,'/');

      if(file.endsWith('/src/modules/analytics/ViewCambiosTurnoEnhanced.jsx')){
        let next=code;

        const componentHead='export default function ViewCambiosTurnoEnhanced({deps={},rop02All=[]}){\n const C={...UI_C,...(deps.C||{})},hoy=new Date();';
        const componentHeadAfter='export default function ViewCambiosTurnoEnhanced({deps={},rop02All=[]}){\n const C={...UI_C,...(deps.C||{})},hoy=new Date();\n const esAdministrativo=String(sessionStorage.getItem("dm_role")||"").trim().toUpperCase()==="ADMINISTRATIVO";';
        if(!next.includes(componentHead)){
          throw new Error('[delta-administrativo-daily-hi-control] No se encontro el inicio de ViewCambiosTurnoEnhanced.');
        }
        next=next.replace(componentHead,componentHeadAfter);

        const tabState=',[tab,setTab]=useState("resumen");';
        const tabStateAfter=',[tab,setTab]=useState(()=>esAdministrativo?"controlDiario":"resumen");\n useEffect(()=>{if(esAdministrativo&&tab!=="controlDiario")setTab("controlDiario");},[esAdministrativo,tab]);';
        if(!next.includes(tabState)){
          throw new Error('[delta-administrativo-daily-hi-control] No se encontro el estado de pestaña de Control de horas mensuales.');
        }
        next=next.replace(tabState,tabStateAfter);

        const tabsHead='{TabBtn?<><TabBtn active={tab==="resumen"}';
        const tabsHeadAfter='{!esAdministrativo&&TabBtn?<><TabBtn active={tab==="resumen"}';
        if(!next.includes(tabsHead)){
          throw new Error('[delta-administrativo-daily-hi-control] No se encontro la barra de pestañas del control mensual.');
        }
        next=next.replace(tabsHead,tabsHeadAfter);

        if(!next.includes('esAdministrativo?"controlDiario":"resumen"')||!next.includes('!esAdministrativo&&TabBtn')){
          throw new Error('[delta-administrativo-daily-hi-control] No se pudo restringir la vista mensual para ADMINISTRATIVO.');
        }
        return {code:next,map:null};
      }

      if(file.endsWith('/src/App.jsx')){
        let next=code;

        const adminNav=`      return [\n        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},\n        {id:"grp_control_rop02",icon:"shieldCheck",label:"Control de ROP02",type:"group",color:C.accent,children:[`;
        const adminNavAfter=`      return [\n        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},\n        {id:"cambiosTurno",icon:"clipboardCheck",label:"Control diario Hi y N°",type:"item",color:C.green},\n        {id:"grp_control_rop02",icon:"shieldCheck",label:"Control de ROP02",type:"group",color:C.accent,children:[`;
        if(!next.includes(adminNav)){
          throw new Error('[delta-administrativo-daily-hi-control] No se encontro el menu tecnico de ADMINISTRATIVO.');
        }
        next=next.replace(adminNav,adminNavAfter);

        const adminViews='const vistasAdministrativo=new Set(["bienvenida","controlErrores","ctrlEquipo","atrasoROP02","control","abastecimiento","abastecimientoPendientes","abastecimientoParciales","abastecimientoCerradas","abastecimientoRechazadas"]);';
        const adminViewsAfter='const vistasAdministrativo=new Set(["bienvenida","cambiosTurno","controlErrores","ctrlEquipo","atrasoROP02","control","abastecimiento","abastecimientoPendientes","abastecimientoParciales","abastecimientoCerradas","abastecimientoRechazadas"]);';
        if(!next.includes(adminViews)){
          throw new Error('[delta-administrativo-daily-hi-control] No se encontro la lista de vistas permitidas para ADMINISTRATIVO.');
        }
        next=next.replace(adminViews,adminViewsAfter);

        const title='titles.cambiosTurno="Control de horas mensuales";';
        const titleAfter='titles.cambiosTurno=esAdministrativo?"Control diario Hi y N°":"Control de horas mensuales";';
        if(!next.includes(title)){
          throw new Error('[delta-administrativo-daily-hi-control] No se encontro el titulo de Control de horas mensuales.');
        }
        next=next.replace(title,titleAfter);

        if(!next.includes('{id:"cambiosTurno",icon:"clipboardCheck",label:"Control diario Hi y N°"')||!next.includes('"bienvenida","cambiosTurno","controlErrores"')){
          throw new Error('[delta-administrativo-daily-hi-control] No se pudo habilitar Control diario Hi y N° para ADMINISTRATIVO.');
        }
        return {code:next,map:null};
      }

      return null;
    }
  };
}
