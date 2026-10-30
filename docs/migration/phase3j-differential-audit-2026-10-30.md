# Fase 3J — Diferencial de campos (2026-10-30)

**Estado:** comprobación read-only de columnas tipadas frente a raw_data en Supabase productivo ejecutada; módulo de 16 testigos preparado y probado localmente (7/7); pendiente ejecución en Apps Script del clon.

## Resultado de consultas SELECT
- Coincidencia de cantidades: ROP05 9.702, RMA15 JM 2.124, RMA15 FS 1.542 (13.368 en total); solo prueba paridad de recuentos.
- 8.598 textos de observaciones ROP05 presentes en raw_data pero ausentes en columna tipada.
- En los 3.666 RMA15 turno, lugar e intervencion están presentes en raw_data y ausentes en sus columnas tipadas.
- En 4.429 filas ROP05 por campo largo, ancho y profundidad, el literal 'SIN DATOS' se representó como 0 en columnas tipadas (13.287 celdas, no registros).
- 6 RMA15 JM y 28 RMA15 FS km_hs descriptivos fueron tipados como 0.
- Un operativo ambiguo en JM y uno en FS tienen Boolean tipado pese a no haber SI/NO en el texto fuente.
- Valores como '2 km' (ROP05 3165) y el insumo descriptivo de RMA15 FS 979 requieren conservar literal; no editar automáticamente.

## Prueba de testigos preparada
Nuevo módulo `DM_UNIFIED_PHASE3J_RAW_SNAPSHOT_READONLY_V1.gs` en el ZIP `DELTA_OPS_V9_UNIFICADO_FASE3J_DIFERENCIAL_SOLO_LECTURA_20261030.zip`: selecciona 16 filas físicas repartidas entre los tres datasets, compara digest MD5 de campos raw en Sheets con digest de los valores raw_data obtenido por SELECT remoto el mismo día, y reporta coincidencia sin exponer literales ni usar red/credenciales. Test VM 7/7 PASS. El usuario debe ejecutarlo únicamente en el clon Apps Script de pruebas, primero `probarMigracionFase3jPreflightV1`; no se ha validado aún en GAS real. Cambios legítimos en la fuente vuelven obsoleta la referencia y deben producir mismatch; no fuerces hashes ni recargues históricos.

## Indicador global de avance
Estimación de ingeniería de unificación completa: **aprox. 45 %**, desglosado: infraestructura/aislamiento 15/15; mapeo/auditorías 17/25; protocolo cola/ACK 10/20; integración real de todos los datasets 3/25; corte/monitoreo/rollback 0/15. No es una métrica del sistema. Se requiere mantener V8.1 y V9 originales hasta equivalencia real y prueba de un solo escritor.

Producción, Supabase y GitHub main sin cambios. Ninguna escritura productiva habilitada por esta fase.