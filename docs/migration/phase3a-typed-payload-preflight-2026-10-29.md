# Fase 3A — ROP05 y RMA15, simulación de mapeo sin escrituras

Fecha: 2026-10-29. Estado: preparada y probada **localmente**, no instalada en Apps Script ni integrada en `main`.

## Diagnóstico del clon V9 confirmado por el usuario

El preflight V2 devolvió `ok: true`, `failed: 0`, con:
- ROP05: 9.684 filas válidas, GID de la hoja real 230972854 corregido en el clon.
- RMA15 JM: 2.124 filas válidas incluyendo las siete excepciones históricas sin interno (filas 849, 864, 957, 1020, 1086, 1088 y 1168).
- RMA15 FS: 1.542 filas válidas.

## Revisión de Supabase

- `apply_rop05_external_delta_v1(p_upserts, p_delete_source_rows)` y `apply_typed_sheet_delta_v1(p_dataset, p_upserts, p_delete_source_rows)` implementan upserts por `source_dataset + source_row`, aceptan cargas de hasta 10.000 registros por operación y **permiten borrados** si se solicitan. Ninguna se llamó en esta fase.
- El `raw_data` de los 3.666 registros RMA15 conserva turno, lugar e intervención; las columnas tipadas `turno`, `lugar` e `intervencion` están vacías.
- El `raw_data` de ROP05 contiene texto de observaciones en 8.580 de 9.684 filas; la columna tipada `observaciones` está vacía en las 9.684. Es crítico conservar el encabezado largo.
- Se mantiene la corrección de lectura de RMA15 preparada en esta rama, sin promover a producción.

## Módulo local de simulación

El paquete `DELTA_OPS_V9_UNIFICADO_FASE3A_MAPEO_SEGURO_20261029.zip` contiene:
- `DM_UNIFIED_ROP05_RMA15_PHASE3_DRYRUN_V1.gs`: mapea origen en memoria y valida fechas, números, campo interno, intervenciones, observaciones, insumos y excepciones; no escribe en ninguna fuente.
- `TEST_LOCAL_PHASE3A.cjs`: pruebas Node con 13.350 filas simuladas, 7 excepciones, fallo deliberado de fecha y 0 llamadas de escritura.
- `LEEME_FASE3A.md`: instrucciones.

Las pruebas locales resultaron correctas, pero todavía debe ejecutarse en el clon de Google Apps Script para verificar los valores reales. El módulo agrega `probarMigracionFase3aV1`, requiere el módulo V2 y no requiere credenciales.

## Corte seguro pendiente

La fase 3B debe comparar payload contra las tablas reales antes de producir escrituras, resolver y probar la sincronización incremental y confirmar que los procesos antiguos no se deshabiliten antes de que se cubran sus dependencias (outbox, ROP02, ROP05, RMA15, insumos, etc.).

No se modificaron los activadores, los proyectos Apps Script activos, las funciones SQL, Vercel producción ni `main`.

## Resultado del primer dry-run con hojas reales y corrección V2

La ejecución V1 del clon (19:30 hora Argentina) contó 13.350 filas y reportó validación fallida por considerar obligatoriamente numéricos valores históricos:
- ROP05: **4.429 filas** con tres dimensiones `SIN DATOS` (13.287 celdas), que están conservadas en `raw_data`.
- RMA15 JM: fila 445 `operativo=-` para trabajo sin equipo asignado y fila 809 `km_hs=S/H`.
- RMA15 FS: `_`, `S/H`, `N/A` y vacíos; fila 123 `km_hs=EXC-0005`, fila 834 `operativo` vacío.

Se confirmó en Supabase que en FS fila 123 el valor tipado `km_hs=-5` es una transformación errónea del identificador `EXC-0005`, y en fila 834 `equipo_operativo=false` pese a origen vacío. No se han modificado esos registros.

El módulo **`DM_UNIFIED_ROP05_RMA15_PHASE3_DRYRUN_V2.gs`** se entrega como archivo local de conversación, para **reemplazar el contenido** del archivo V1 en el clon. V2 conserva todos los valores originales en `raw_data`, acepta marcadores históricos no numéricos en dimensiones opcionales, evita conversiones de códigos a números, distingue advertencias de errores y reduce el tamaño del log.

En pruebas locales con los 13.350 registros simulados, los 3 datasets se mapearon sin errores fatales, se conservaron las 7 excepciones históricas JM y quedaron **dos advertencias explícitas FS 123 / 834**. Ninguna función de escritura fue invocada. **La prueba de los datos reales V2 sigue pendiente**.

`ok:true` de V2 solo significa **mapeo posible**; **no habilita escritura** y permanece `readyForWrites:false`. Falta comparación de valores contra Supabase, verificación de claves y fuentes, y reconciliación segura de datos tipados.


## Dry-run real V2 y ajuste V3 (19:39, 29/10)

El usuario ejecutó V2 sobre las hojas reales: ROP05 9.683/9.684, RMA15 JM 2.124/2.124 y RMA15 FS 1.542/1.542. El único fallo fue ROP05 fila **3165**: `cantidad_produccion="2 km"` con `unidad="KILÓMETROS LINEALES"`. Supabase ya registra `cantidad_produccion=2` y el literal `2 km` en `raw_data`.

Las tres advertencias no bloqueantes de RMA15 FS fueron:
- fila **642**: cantidad 5 `1 FILTRO TRANSMISION`;
- fila **834**: estado operativo original vacío;
- fila **979**: cantidad 6 `1 TERMOCONTRAIBLE`.

El nuevo archivo de diagnóstico `DM_UNIFIED_ROP05_RMA15_PHASE3_DRYRUN_V3.gs`, generado en contenedor y entregado como archivo separado, acepta `2 km` solo con unidad de kilómetros lineales y preserva el literal original. No intenta convertir ciegamente cantidades mixtas de insumos. Las advertencias subsisten para revisión manual y el resultado `readyForWrites` sigue siendo `false`.

Prueba simulada local V3 (13.350 registros + fila 3165 + caso de insumo descriptivo): `ok:true`, `failed:0`, 7 excepciones JM, cero accesos de escritura, rechazo explícito de incompatibilidad de unidad y fecha inválida. **El usuario todavía debe ejecutar V3 en el clon Apps Script real**.

No se activan triggers ni escrituras y producción permanece intacta.
