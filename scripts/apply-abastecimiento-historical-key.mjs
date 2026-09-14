import fs from 'node:fs';

const path='src/modules/abastecimiento/AbastecimientoModule.jsx';
let s=fs.readFileSync(path,'utf8');

const oldRequest=`      const code=normCode(row.codigoArticulo);\n      const proyecto=normalizeCentroCosto(row.centroCosto);\n      const insumoKey=norm(row.descripcion);\n      if(!code||!proyecto||!insumoKey)return;\n      // Clave de asignación: código + proyecto + nombre normalizado del insumo.\n      // La fecha NO se usa para mezclar períodos: se valida abajo como límite temporal.\n      const key=[code,proyecto,insumoKey].join("__");`;
const newRequest=`      const code=normCode(row.codigoArticulo);\n      const proyecto=normalizeCentroCosto(row.centroCosto);\n      if(!code||!proyecto)return;\n      // Regla histórica: la identidad para asignación es código + proyecto.\n      // La fecha es una barrera temporal: la solicitud debe existir antes del envío.\n      const key=\`${'${code}__${proyecto}'}\`;`;
if(!s.includes(oldRequest))throw new Error('No se encontró bloque de clave de solicitudes esperado');
s=s.replace(oldRequest,newRequest);

const oldShipment=`        const code=normCode(item.codigo);\n        const insumoKey=norm(item.descripcion);\n        const cantidad=toNumber(item.cantidad);\n        if(!code||!insumoKey||cantidad<=0)return;\n        shipments.push({\n          id:\`${'${remito.id||remito.comprobante||"remito"}-${itemIndex}-${code}'}\`,\n          code,proyecto,insumoKey,fecha,fechaMs,cantidad,`;
const newShipment=`        const code=normCode(item.codigo);\n        const cantidad=toNumber(item.cantidad);\n        if(!code||cantidad<=0)return;\n        shipments.push({\n          id:\`${'${remito.id||remito.comprobante||"remito"}-${itemIndex}-${code}'}\`,\n          code,proyecto,fecha,fechaMs,cantidad,`;
if(!s.includes(oldShipment))throw new Error('No se encontró bloque de remitos esperado');
s=s.replace(oldShipment,newShipment);

const oldKey='      const key=shipment.proyecto&&shipment.insumoKey?[shipment.code,shipment.proyecto,shipment.insumoKey].join("__"):"";';
const newKey='      const key=shipment.proyecto?`${shipment.code}__${shipment.proyecto}`:"";';
if(!s.includes(oldKey))throw new Error('No se encontró key de remito esperada');
s=s.replace(oldKey,newKey);

const oldDeps='  },[normCode,norm,toNumber,normalizeCentroCosto,formatDateLocal]);';
const newDeps='  },[normCode,toNumber,normalizeCentroCosto,formatDateLocal]);';
if(!s.includes(oldDeps))throw new Error('No se encontró dependencia norm esperada');
s=s.replace(oldDeps,newDeps);

if(!s.includes('if(req.fechaMs&&shipment.fechaMs&&req.fechaMs>shipment.fechaMs)continue;')){
  throw new Error('Se perdió la barrera temporal solicitud<=envío');
}
if(!s.includes('const key=`${code}__${proyecto}`;')){
  throw new Error('No quedó la clave histórica código+proyecto');
}
if(s.includes('const insumoKey=norm(row.descripcion);')){
  throw new Error('La descripción todavía bloquea la asignación de solicitudes');
}

fs.writeFileSync(path,s);
console.log('Historical code+project/date allocation restored.');
