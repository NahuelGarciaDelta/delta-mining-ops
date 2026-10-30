# V9 — Puente conciliado con Supabase (30/10/2026)

## Estado verificado de datos reales

Se compararon los 5295 registros de `ENTREGAS_PREPARADAS` del libro privado de V9 con la tabla de producción `public.rop05` **solo mediante SELECT**, sin escribir en ella. El cálculo del SHA-256 de los 15 campos se ejecutó dentro de PostgreSQL sobre `raw_data` y se contrastó con `draft_sha256` de la columna I del puente.

[Libro de pruebas y puente persistente](https://docs.google.com/spreadsheets/d/1eAVJ4UJaPKz0xso_mxbvQCSoVb9viisREppxpaEQ-P8/edit) — pestaña `PUENTE_ROP05_V9` (5295 filas + encabezado). Se actualizó **solo** la columna J con la verificación individual.

- 5238 emparejamientos exactos con ROP05 Sheets y 34 emparejamientos únicos por clave funcional.
- **5272 de 5272 filas vinculadas tienen los 15 valores crudos idénticos a Supabase** (SHA-256). Para las 34 que diferían de Sheets, el `raw_data` de Supabase coincide con V9; no asumir por ello que la hoja ROP05 actual sea idéntica a Supabase ni aprobar automáticamente el corte.
- 23 tareas José María sin contraparte, `QUARANTINE_NO_LEGACY_ID`, no insertar.
- 25 filas de la hoja heredada no emparejadas conservadas en `LEGADO_SIN_PUENTE`, no borrar.
- 5297 filas de producción en el tramo legacy 4431–9727; `public.rop05` tiene 9726 filas (1 enero–29 octubre 2026) y utiliza `source_dataset='rop05'` con `source_row` físico.
- Identidad lógica de V9 = `dataset:source_id:t1|t2|t3`; no usar posición física como identidad primaria futura.

## Hallazgo importante en dato tipado

Auditoría READ-ONLY de cinco medidas numéricas sobre las 9726 filas productivas:

| Campo | Registros con raw numérico | Diferencias raw vs columna numérica tipada |
|---|---:|---:|
| ancho | 5297 | 0 |
| largo | 5297 | 0 |
| profundidad | 5297 | 0 |
| horas_productivas | 9726 | 0 |
| cantidad_produccion | 9725 | **1** |

En source_row=**6274**, tabla `public.rop05` id=32771173, equipo interno PCA-0113, raw_data de cantidad producida `0.44999999999999996` (equivalente aprox. a 0,45) y columna numérica tipada **45000000000000000**. La hoja ROP05 actual muestra `0,45`. Se añadió `DB_TYPED_NUMERIC_ANOMALY` con nota al vínculo V9 (`PUENTE_ROP05_V9!J1844`), que queda **bloqueado de publicación**.

El código SQL productivo `private.rop05_try_numeric(p_value)` elimina indiscriminadamente todos los puntos de la entrada; comprobación READ ONLY: `private.rop05_try_numeric('12.5')` devuelve `125`, y `private.rop05_try_numeric('0.44999999999999996')` devuelve `44999999999999996`. Esta función es utilizada por los procesos de staging de ROP05 y también por al menos un proceso RMA15. **No reemplazar en producción sin evaluar consumidores**. La diferencia concreta 45000000000000000 frente a 44999999999999996 sugiere normalizaciones adicionales, por lo que no se afirma ruta exacta del valor corrupto.

## Mitigación preparada (sin cambiar producción)

- SQL candidato en [rop05_safe_numeric_parser_candidate.sql](../../supabase/v9_migration/rop05_safe_numeric_parser_candidate.sql) crea una función V2 separada sin reemplazar `rop05_try_numeric`, con tratamiento conservador de separadores y `null` para formatos inválidos.
- Se creó y probó `delta_4g_sandbox.rop05_try_numeric_v2` en Supabase SANDBOX `biztlietuvvonigcfdwy`: **12/12 casos**, con decimales de punto/coma, separadores de miles y casos nulos.
- SQL candidato en [rop05_identity_sidecar_candidate.sql](../../supabase/v9_migration/rop05_identity_sidecar_candidate.sql): esquema propio `delta_v9`, tabla indexada por `task_key`, fila física legacy con unicidad, checksum, estado, RLS, acceso restringido, publicación por defecto **deshabilitada**. Solo código en la rama; **NO ejecutado en producción ni usado para importar IDs reales todavía**.
- El libro puente está validado contra BD en `5271 DB_MATCH_15_FIELDS`, `1 DB_TYPED_NUMERIC_ANOMALY`, `23 QUARANTINE_NO_LEGACY_ID`.
- No hay ACK real de V9, no hay nuevos triggers, no se ha desactivado V8.1 ni alterado `public.rop05`.

## Para el corte efectivo

1. Revisar anomalía numérica y desplegar arreglo compatible de parser, respaldar la fila 6274 y corregir con compare-and-swap de forma autorizada (no en este ensayo).
2. Tomar un snapshot de fuente/RPO05 y revalidar puente para evitar desactualización, manteniendo el legado activo.
3. Autorizar creación de sidecar aislado en producción sin cambiar esquema de `public.rop05`, cargar solo los vínculos verificados y poner en cuarentena los no vinculados.
4. Implementar ACK operativo y consumidor con revisión de publicación independiente del borrador, protección contra HTTP ambiguo, y regla de productividad diferida.
5. Cutover gradual reversible con métricas, retorno a V8.1 si hay discrepancias, sin autodelete de partes.
