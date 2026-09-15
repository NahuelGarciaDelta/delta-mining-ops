import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateAbastecimientoRemitos} from '../src/modules/abastecimiento/enviosSinSolicitud.js';
const norm=v=>String(v||'').trim().toUpperCase(),date=v=>new Date(v).getTime();
test('FIFO no asigna un remito a una solicitud futura',()=>{const out=allocateAbastecimientoRemitos({requestRows:[{id:'r1',codigoArticulo:'10',centroCosto:'JM',fechaSolicitud:'2026-09-10',cantidadSolicitada:5}],sourceRemitos:[{id:'m1',proyecto:'JM',fecha:'2026-09-09',comprobante:'R1',items:[{codigo:'10',descripcion:'X',cantidad:5}]}],normalizeCode:norm,normalizeProject:norm,parseDateMs:date,toNumber:Number,formatDate:v=>v});assert.equal(out.rows[0].cantidadEnviada,0);assert.equal(out.unmatched.length,1);assert.equal(out.unmatched[0].cantidadEnviada,5);});
