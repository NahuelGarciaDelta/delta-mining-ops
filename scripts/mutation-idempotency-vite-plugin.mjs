const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

export function mutationIdempotencyVitePlugin(){
  return{
    name:"delta-global-mutation-idempotency",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      let next=code;

      if(file.endsWith("/src/main.jsx")){
        const importAnchor='import {prewarmSavedDataSources} from "./services/appCache.js";';
        if(!next.includes(importAnchor))throw new Error("[delta-global-mutation-idempotency] No se encontró el import de appCache en main.jsx");
        next=next.replace(importAnchor,`${importAnchor}\nimport {installMutationGuard} from "./services/mutationGuard.js";`);

        const installAnchor='if(typeof window!=="undefined"){\n  applyAppearance(readLastAppearance(),C);';
        if(!next.includes(installAnchor))throw new Error("[delta-global-mutation-idempotency] No se encontró el arranque del navegador en main.jsx");
        next=next.replace(installAnchor,'if(typeof window!=="undefined"){\n  // Guard global: una misma escritura nunca sale dos veces por doble clic, lag o dos pestañas.\n  installMutationGuard();\n  applyAppearance(readLastAppearance(),C);');

        return next===code?null:{code:next,map:null};
      }

      if(!file.endsWith("/src/modules/abastecimiento/AbastecimientoModule.jsx"))return null;

      const randomId='id:`raba08-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,';
      if(!next.includes(randomId))throw new Error("[delta-global-mutation-idempotency] No se encontró el ID aleatorio de remito");
      next=next.replace(randomId,'id:(typeof window!=="undefined"&&typeof window.dmStableRemitoId==="function"?window.dmStableRemitoId({...form,proyecto:proyectoDetectado,items:cleanItems},remitosRef.current):`raba08-${Date.now()}-${Math.random().toString(36).slice(2,8)}`),');

      const importRows='    const rowsToSend=(importModal.rows||[]).map(({previewId,estado,...row})=>row);\n    if(!rowsToSend.length){\n      setImportModal(prev=>({...prev,open:false}));\n      return;\n    }';
      const safeImportRows='    const previewRows=importModal.rows||[];\n    // Nunca reenviar filas que la propia vista ya identificó como existentes o repetidas.\n    const rowsToSend=previewRows.filter(row=>row.estado==="Nueva").map(({previewId,estado,...row})=>row);\n    const skippedDuplicates=previewRows.length-rowsToSend.length;\n    if(!rowsToSend.length){\n      setImportModal(prev=>({...prev,open:false,loading:false,message:"",error:""}));\n      setSuccessAlert({message:`No se agregaron filas: ${skippedDuplicates} ya existían o estaban repetidas.`});\n      return;\n    }';
      if(!next.includes(importRows))throw new Error("[delta-global-mutation-idempotency] No se encontró el bloque de importación RABA03");
      next=next.replace(importRows,safeImportRows);

      const successRows='      let msg=`${inserted} filas nuevas agregadas`;\n      if(duplicates>0)msg+=` · aviso: ${duplicates} repetidas detectadas`;';
      const safeSuccessRows='      let msg=`${inserted} filas nuevas agregadas`;\n      if(skippedDuplicates>0)msg+=` · ${skippedDuplicates} duplicadas omitidas`;\n      if(duplicates>0)msg+=` · aviso backend: ${duplicates} repetidas detectadas`;';
      if(!next.includes(successRows))throw new Error("[delta-global-mutation-idempotency] No se encontró el resumen de importación RABA03");
      next=next.replace(successRows,safeSuccessRows);

      const unsafePreview="Se agregarán TODOS como filas nuevas.";
      if(next.includes(unsafePreview))next=next.replace(unsafePreview,"Sólo se agregarán las filas nuevas; las existentes o repetidas se omitirán.");

      if(!next.includes('window.dmStableRemitoId')||!next.includes('row.estado==="Nueva"')||!next.includes('duplicadas omitidas')){
        throw new Error("[delta-global-mutation-idempotency] La protección anti-duplicados no quedó aplicada completa");
      }
      return{code:next,map:null};
    }
  };
}
