# Fase 3B — Auditoría de Supabase, sin escrituras

**Fecha:** 2026-10-29. **Alcance:** consultas de solo lectura a Supabase y comparación de estructura con el preflight Apps Script Fase 3A V3 (usuario confirma `ok:true`, `failed:0`, `readyForWrites:false`).

## Conteo por fuente / destino

| Dataset | Filas fuente validadas por clon | Filas Supabase | Rango source_row Supabase | Distintos source_row | Duplicados |
| --- | ---: | ---: | --- | ---: | ---: |
| rop05 | 9.684 | 9.684 | 2–9685 | 9.684 | 0 |
| rma15_jm | 2.124 | 2.124 | 6–2129 | 2.124 | 0 |
| rma15_fs | 1.542 | 1.542 | 6–1547 | 1.542 | 0 |

Coinciden el número de registros y la identidad posicional de las tres fuentes; **esto NO verifica que todos los valores de campo sean idénticos** ni garantiza ausencia de cambios concurrentes.

## Campos tipados incompletos

- `public.rma15`: para las 3.666 filas `turno`, `lugar` e `intervencion` están vacíos (como campos tipados), pero `raw_data` contiene esos 3 datos en las 3.666. La rama de migración tiene fallback de lectura para turno e intervención en `rma15Legacy`. Se requerirá un mapeo correcto para escrituras futuras.
- `public.rop05`: `observaciones` está vacío en 9.684 filas, aunque el texto original bajo la clave extensa `OBSERVACION DE LA TAREA SEGUN LA SELECCIONADA... ` existe en 8.580. Se incorporó fallback de lectura en `rop05Legacy` en la rama y se añadió una prueba de regresión, aún no ejecutada como suite completa.

## Advertencias de fuente y conversiones históricas

- ROP05 fila 3165: texto de cantidad `2 km` y unidad `KILÓMETROS LINEALES`, Supabase almacena cantidad numérica 2, con texto original en raw_data.
- RMA15 FS fila 123: raw km/hs `EXC-0005` pero tipado `-5`. **No es una lectura válida de horómetro**; nueva lógica nunca debe extraer -5 del código de equipo.
- RMA15 FS fila 834: raw operativo vacío mientras tipado `false`. No inferir estado fuera de servicio.
- RMA15 FS fila 642 insumo 5: cantidad literal `1 FILTRO TRANSMISION`; fila 979 insumo 6: `1 TERMOCONTRAIBLE`. Ambos se conservan en raw_data; no convertir automáticamente a número en una escritura de producción.
- RMA15 JM fila 445: estado operativo `-`, trabajo de cartelería. JM fila 809: km/hs `S/H`.
- RMA15 JM 7 históricos sin código interno aceptados: filas 849, 864, 957, 1020, 1086, 1088, 1168.

## Requisitos obligatorios de la fase 3C antes de habilitar escrituras

1. Sincronización incremental por fuente + fila con lote acotado (p. ej., 250–350) y cursores persistentes; limitar egress y tiempo.
2. `p_delete_source_rows=[]` **siempre**; no usar sync autoritativo de reposición ni reemplazos masivos.
3. Preservar campos tipados cuando un valor de origen sea vacío/no aplicable y nunca inferir `false` operativo ni lectura `0` sin negocio acordado. Conservar raw_data exacto.
4. Comparar el payload transformado antes de cualquier RPC, validar identidad de fila, conteos, fecha, intervenciones, observaciones, insumos y excepciones. Abort en cambios inesperados.
5. Instalar y comprobar primero en el clon con escrituras bloqueadas y 0 activadores. Crear trigger solo después de plan de corte y con guardas para impedir dos escritores simultáneos.
6. No cambiar `main`, Vercel producción o Apps Script originales ni ejecutar ninguna corrección de datos hasta autorización explícita y backup.

## Cambios únicamente en la rama de migración

- `src/services/supabaseReadApi.js`: fallback de ROP05 observaciones (nuevo) y de RMA15 turno/intervención (anterior), priorizando valores tipados no vacíos.
- `tests/rop05-raw-data-observations-fallback.test.mjs` y `tests/rma15-raw-data-fallback.test.mjs`: pruebas de regresión agregadas, no equivalen a ejecución de suite.

**Estado:** Fase 3A completada; fase 3B conteos, claves y diagnóstico de campos completados; **escrituras NO autorizadas** y `readyForWrites:false`. Se requiere validación de equivalencia campo por campo antes de habilitar nuevos productores.
