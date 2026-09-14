import fs from 'node:fs';

const path='src/modules/abastecimiento/AbastecimientoModule.jsx';
let s=fs.readFileSync(path,'utf8');

const oldSig='const allocateRemitosToRequests=useCallback((requestRows=[],sourceRemitos=[])=>{';
const newSig='const allocateRemitosToRequests=useCallback((requestRows=[],sourceRemitos=[],{allowPreSolicitud=false}={})=>{';
if(!s.includes(oldSig)) throw new Error('No se encontró firma allocateRemitosToRequests esperada');
s=s.replace(oldSig,newSig);

const oldDate='''        // Regla contractual: un envío jamás puede descontarse de una solicitud creada después.\n        if(req.fechaMs&&shipment.fechaMs&&req.fechaMs>shipment.fechaMs)continue;''';
const newDate='''        // Auditoría: por defecto un envío no puede asociarse a una solicitud creada después.\n        // Estado operativo: allowPreSolicitud=true permite descontar TODOS los remitos\n        // compatibles de solicitudes pendientes posteriores, sin alterar la tabla\n        // "Envíos sin solicitud", que sigue usando la regla histórica.\n        if(!allowPreSolicitud&&req.fechaMs&&shipment.fechaMs&&req.fechaMs>shipment.fechaMs)continue;''';
if(!s.includes(oldDate)) throw new Error('No se encontró condición temporal esperada');
s=s.replace(oldDate,newDate);

const oldState='const asignadas=allocateRemitosToRequests(activas,remitos).rows;';
const newState='const asignadas=allocateRemitosToRequests(activas,remitos,{allowPreSolicitud:true}).rows;';
if(!s.includes(oldState)) throw new Error('No se encontró asignación stateAwareRows esperada');
s=s.replace(oldState,newState);

if(!s.includes('return allocateRemitosToRequests(base,remitos).unmatched.sort')){
  throw new Error('La vista Envíos sin solicitud dejó de usar la asignación histórica estricta');
}
if(!s.includes('allocateRemitosToRequests(activas,remitos,{allowPreSolicitud:true}).rows')){
  throw new Error('Pendientes no quedó configurado para descontar todos los remitos compatibles');
}

fs.writeFileSync(path,s);
console.log('Dual Abastecimiento allocation patch applied.');
