# Correcciones de sincronización y ensayo aislado — 14/10/2026

## Qué está corregido en código

**Insumos:** conserva cron cada 15 minutos. Solo HEAD con count=exact, sin el GET de 1.000 registros cuyo cuerpo se descartaba. Conteo ausente/incorrecto ahora bloquea el proceso; no se interpreta como cero. Todas las peticiones y sus cuerpos tienen timeout; SOURCE_TIMEOUT se distingue del fallo HTTP y devuelve 504, sin reintento. No se repite un RPC de escritura al perder su respuesta; se informa outcomeUnknown para reconciliar en la siguiente ejecución programada. El límite de la lectura Google sigue en 50 segundos: se corrigió el manejo, no se promete que desaparezca la latencia de Google.

Se reutiliza el health leído cuando ya existe y no se reemplazan sus detalles desde un snapshot antiguo al registrar un error. Una comprobación completa sin cambios limpia el contador de fallo antiguo una sola vez; un usuario no autorizado no puede escribir health. Se conservan transformación, códigos/precios, payload, dryRun y controles de integridad/disminución de filas. Una respuesta fallida no se convierte en éxito.

**Watch Lista:** conserva cada 5 minutos y valida autorización en cada invocación. La consulta health devuelve únicamente server_version y destination_rows, sin los detalles o last_success_at que no se usan. Lecturas concurrentes dentro del mismo isolate comparten el chequeo en curso; después se elimina y una versión posterior se vuelve a consultar. No hay TTL nuevo ni un valor persistido que pueda esconder un horómetro recién cambiado. Isolates diferentes no comparten memoria: no se afirma exclusión distribuida. No se llama al worker si versión confirmada y filas válidas coinciden; una respuesta HTTP 200 con ok=false nunca se informa como sincronización correcta. Auth/health tienen timeout, además de los límites existentes de Google/worker. No se agregó retry automático ni se cambió el backend V9.

**SQL:** forward.sql conserva firma, asignaciones, respuesta y reglas previas del RPC. Los conflictos de ROP05/RMA15/Lista/Insumos solo ejecutan UPDATE si cambia un campo real, incluido raw_data. RMA15 compara también los insumos secundarios: una modificación exclusiva de código/nombre/cantidad debe actualizar la versión del padre. Los snapshots de hijos se agregan una vez por lote para no recorrer todo el payload por cada fila. El procedimiento previo de reemplazar hijos y eliminar registros ausentes permanece; no se agregaron borrados. El ahorro reportado de UPDATE corresponde a las tablas padre, no a una optimización de todos los inserts/deletes de hijos.

**Caché histórica:** comparar solo MAX(synced_at) no detecta el borrado de una fila antigua. Los snapshots guardan y comparan rowCounts por fuentes del dataset además de sus versiones. Así cambia la versión efectiva (timestamp + conteo) cuando corresponde y se invalida IndexedDB incluso si el máximo timestamp quedó igual. El escalar SQL de versión puede seguir igual tras ese borrado: no se afirma que se incremente siempre. Snapshots antiguos sin conteos se revalidan cuando el manifiesto aporta counts. No se modificaron filtros, reglas 26–25, TD/TN, JM/FS ni intervalos de refresco.

## SQL probado de verdad, sin producción

Se ejecutaron forward.sql y rollback.sql en PostgreSQL 17.5 embebido mediante PGlite 0.3.14, exclusivamente en memoria y sin conexión a Supabase. El esquema de columnas fue obtenido con SELECT read_only, sin copiar registros productivos. Los datos son sintéticos; RLS, triggers productivos, otras constraints y múltiples procesos no están clonados. Un trigger local de auditoría contó UPDATE reales, además de comparar timestamps.

Casos para rop05, rma15_fs, rma15_jm, lista_equipos e insumos: insert, repetición idéntica, cambio de una fila, conservación de otra, delete de fila, transición/null repetido, colección vacía y rollback. Ambos RMA15 incluyen cambio solo de insumos secundarios. Resultado: 10 UPDATE innecesarios antes → 0 después en el lote repetido; timestamps idénticos estables y cambios reales detectados. El rollback se ejecutó y restauró el comportamiento anterior. Eso NO significa que se haya aplicado nada a Supabase o probado Google.

Reproducción, sin alterar dependencias de la app:

```
npm install --prefix /workspace/sql-tools --cache /workspace/.npm-cache @electric-sql/pglite@0.3.14
node scripts/test-typed-sync-isolated.mjs
```

Para otra ubicación definir DELTA_PGLITE_MODULE con el path de dist/index.js del paquete. El script crea siempre una base nueva en memoria; no utiliza URL/contraseña de base de datos. Resultado detallado: supabase/proposals/20261014_skip_unchanged_typed_rows/isolated-results.json. Tests Edge usan fixtures y fetch simulado; incluyen fuente abortada, conteo no confirmado, limpieza de error, watch concurrente/versión nueva y worker ok=false. Browser de autenticación usa mocks; pasó primer ingreso, cambio, contraseña nueva y recarga sin excepciones.

## Medición separada por tipo

| Concepto | Antes | Después | Evidencia |
|---|---:|---:|---|
| UPDATE padre, lote sintético idéntico de 10 filas | 10 | 0 | PostgreSQL real aislado, trigger de auditoría |
| Invalidación por esos no-ops | 5 datasets cambian timestamp | 0 | Ensayo aislado; no equivale a observación productiva |
| Borrado de fila vieja con máximo igual | Historial podía reutilizar cache | Conteo distinto exige nueva descarga | Test de política cache; frontend corregido |
| GET Insumos descartado | 1 por control | 0 | Código/fixture; no desplegado en Supabase |
| Cuerpo del GET Insumos | 66.707 bytes / 1.000 filas | 0 para ese GET | Muestra HTTP real anterior + supresión preparada |
| JSON health Lista | 393 bytes | 54 bytes | Serialización SQL de registro real, no HTTP/billing |
| Dos watches simultáneos, sin cambio | 2 health + 2 Google + 2 auth | 1 health + 1 Google + 2 auth | Simulación; no reducción entre isolates |
| Watch único sin cambio | 0 workers | 0 workers | Se conserva comportamiento; no hay ahorro artificial por desactivación |
| Egress Last 30 days | 6,096 GB | Sin medición posterior productiva | Captura real aportada; no se desplegó en producción |

Estimaciones condicionadas: quitar un GET de 66.707 bytes por cada una de las 96 ejecuciones/día sería ~6,4 MB/día y 192,1 MB/30 días. Si aborta antes no hace ese GET; si entra dos veces al control, antes hacía dos GET. Proyección health watch por 288 chequeos/día: ~2,93 MB/30 días sobre el tamaño SQL observado, sin overhead HTTP. No sumar como ahorro facturado ni aplicar estos porcentajes a los 6,096 GB totales. El ahorro mayor de no invalidar datos idénticos depende de frecuencia real de lotes idénticos y bytes de las descargas evitadas; no se conoce aún.

Egress diario exacto por servicio sigue pendiente. 203,2 MB/día es el cálculo 6,096 GB / 30, no medición de un día. Objetivo 3,6–3,9 GB necesita ~36–41% menos que ese período; ni este test ni el Preview prueban que ya se haya logrado.

## Qué corre en Preview y qué no

El Preview actualizado contiene el frontend y su nueva validación de conteos, además de las optimizaciones anteriores. Apunta al backend Apps Script V9 y a Supabase existentes; solo se verifican lectura y navegación automática. Las funciones Edge nuevas y la migración SQL NO se ejecutan en Vercel ni se instalaron en Supabase. Sus pruebas son locales/aisladas, identificadas arriba. URL, commit, deployment y comprobaciones finales figuran en el recibo de esta entrega.

## Autorizaciones exactas antes de producción

1. Aplicar el forward SQL revisado en jwfocqaxlckuxoklwyxs, con backup/export de la definición vigente, comparación de huella del baseline y revisión de grants/triggers/RLS/constraints. No aplicar si el RPC remoto cambió. Rollback.sql es independiente de autenticación y restituye el RPC, pero vuelve a introducir timestamps artificiales; no recupera datos y no toca contraseñas.
2. Publicar las dos funciones Edge preparadas, manteniendo secretos y cron actuales (15/5 minutos). Revisar logs, fuente completa, cantidades/health y RPC antes/después. Los timeouts nuevos pueden revelar fallos ya existentes; un resultado unknown se reconcilia, no se reenvía la escritura a ciegas.
3. Publicar el frontend validado en delta-mining-ops conservando variables, dominio y V9, solo con autorización. No restaurar un frontend antiguo incompatible con hashes.
4. Medir Usage diario de todas las cuotas tras publicación autorizada. No habilitar pagos ni cambiar plan. El acceso Management ya funciona, pero counts recientes no son bytes facturados de 30 días.

Se mantiene pendiente el ensayo extremo a extremo con copias de Sheets y una base con RLS/triggers/volumen representativo. No se puede certificar ausencia absoluta de inconsistencia de servicios reales sin ese ensayo. No se escribieron horómetros/contraseñas reales ni se ejecutaron migraciones o despliegues productivos.


Validación final: npm run validate — 402 aprobadas, 0 fallidas, 0 omitidas; npm run build aprobado (advertencia existente footer remitos). FK de rma15_insumos comprobada mediante SELECT read_only y conservada en child-foreign-key.json; el ensayo usa la misma referencia/cascada. Los datasets confirmados vacíos también conservan caché válida; una colección local no vacía con counts cero se rechaza.


Prueba adicional: perder la respuesta del RPC no provoca otro intento de escritura; un RPC HTTP 200 sin ok=true se rechaza. Si los datos y el conteo están confirmados pero falla health, la respuesta informa ok=true / healthSync=pending, sin un falso fallo de guardado ni un segundo POST de health. La suite final cubre estos casos con mocks.
