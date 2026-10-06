# Fase 0 — Diagnóstico de performance

Rama de trabajo: `phase0-performance-measurement`

Base original: `6d41d3fb0cbba32658ff0d8aa915739fa66f3a30`

Esta fase **no optimiza** la aplicación. Sólo agrega medición reversible y sin cambios de consultas, datasets, caché, lógica de negocio, Supabase, Google Sheets o Apps Script.

## Activación

La instrumentación queda inactiva en builds normales salvo que se habilite explícitamente. En desarrollo Vite (`import.meta.env.DEV`) queda habilitada automáticamente.

También puede habilitarse con cualquiera de estas opciones:

- abrir la aplicación con `?dmPerf=1`;
- definir `VITE_DM_PERF_DIAGNOSTICS=1` en un entorno de diagnóstico;
- en consola: `localStorage.setItem('dm_perf_debug','1'); location.reload();`.

Para deshabilitarla desde una sesión instrumentada:

```js
window.dmPerf.disable()
```

## Lectura de resultados

En consola del navegador:

```js
window.dmPerf.report()
```

Devuelve y muestra el resumen. Para obtener el objeto completo:

```js
window.dmPerf.snapshot()
```

Para empezar una medición limpia:

```js
window.dmPerf.reset()
```

No se envía telemetría a ningún servicio externo. Los eventos viven sólo en memoria de la pestaña y se limitan a 3.000 entradas.

Las URL se sanitizan: sólo se conservan ruta y parámetros diagnósticos permitidos (`action`, `dataset`, `source`, `limit`, `offset`). Tokens y otros parámetros quedan fuera del registro.

## Qué se mide

### Carga y navegación

Eventos principales:

- `app:bootstrap`
- `app:mount-start`
- `app:mount-rendered`
- `app:data-hydrated`
- `view:start`
- `view:ready`
- `browser:navigation`
- `longtask`

`view:ready.durationMs` mide desde el cambio de vista hasta que la aplicación considera disponibles los datos requeridos por esa vista.

### Red

Cada `fetch` se instrumenta sólo cuando el diagnóstico está habilitado:

- URL sanitizada;
- método;
- status;
- duración hasta consumir el body;
- bytes cuando el método de lectura permite medirlos;
- `Content-Length` cuando está disponible.

`PerformanceObserver` agrega además `transferSize`, `encodedBodySize` y `decodedBodySize` cuando el navegador los expone.

### Datasets Supabase

`dataset:load` registra para las fuentes tipadas:

- dataset;
- tabla;
- filas devueltas;
- filas crudas;
- páginas;
- requests estimados por paginación;
- bytes JSON estimados;
- duración.

La paginación y la consulta original no cambian.

### Caché

Se registran:

- `cache:read`: datasets solicitados, hits, misses, filas y bytes estimados;
- `cache:write`: datasets persistidos, filas y bytes estimados.

No se cambia TTL, invalidación, IndexedDB ni memoria.

### Actualizar

Se registran:

- `refresh:view`: duración total del refresh de la vista;
- `refresh:tasks`: conjunto de tareas registradas;
- `refresh:task`: duración y resultado de cada tarea.

La prioridad, paralelismo y orden existentes se conservan.

---

# Mapeo obligatorio previo a optimizar

## A. Precarga de Bienvenida

`VIEW_SOURCES.bienvenida` contiene actualmente nueve fuentes:

1. `rop02_fs`
2. `rop02_jm`
3. `rma15_fs`
4. `rma15_jm`
5. `insumos`
6. `lista_equipos`
7. `rop05`
8. `rop02_filosur`
9. `rop02_zorro`

La carga por vista ya tiene fallback bajo demanda: `App.jsx` ejecuta `loadSources(VIEW_SOURCES[view] || [], {background:true})` al cambiar de vista. Por lo tanto, quitar una fuente de Bienvenida no la elimina de la aplicación; cambia principalmente cuándo se paga su costo de descarga. **No se modifica todavía** porque hay dependencias de la pantalla inicial y del dashboard interno.

Dependencias confirmadas:

| Fuente | Uso confirmado al inicio / Bienvenida | Riesgo si se retira hoy |
| --- | --- | --- |
| ROP02 JM/FS/Filo Sur/Zorro | `rop02All`, disponibilidad, equipos activos, estados, resumen y dashboard. Bienvenida además consulta un snapshot ROP02 reducido para algunos indicadores. | Alto hasta medir cuánto del full dataset sigue siendo necesario junto al snapshot. |
| RMA15 JM/FS | Resumen de OT/mantenimiento y dashboard; existe fallback histórico cuando el resumen de OT no responde. | Medio/alto. |
| Lista Maestra | Clasificación de equipos, familia/modelo, identificación de camiones/camionetas/equipos viales y otras vistas. | Alto para el resumen de flota. |
| ROP05 | Se entrega a `ViewBienvenida` y se usa en el subdashboard ejecutivo. | Medio; probablemente diferible si el usuario no abre dashboard, pero debe medirse. |
| Insumos | Forma parte de `rawSources` y de dependencias compartidas de mantenimiento/costos. No hay evidencia suficiente para retirarlo de Bienvenida sin medir consumidores indirectos. | Medio; candidato a estudio, no a eliminación inmediata. |

La Fase 0 debe comparar al menos:

- sesión fría sin IndexedDB;
- sesión caliente con IndexedDB;
- Bienvenida sin abrir dashboard;
- Bienvenida abriendo dashboard;
- primera apertura posterior de Oficina Técnica/Mantenimiento.

Sólo después de esas mediciones se decidirá qué fuentes pueden pasar a demanda.

## B. `select=*` y `raw_data`

No se cambia ningún `select=*` en esta fase.

Hay una razón estructural: los adaptadores de `supabaseReadApi.js` conservan compatibilidad con el esquema histórico mediante `raw_data`.

### ROP05

El adaptador comienza con `...(row.raw_data || {})` y luego superpone aliases tipados como fecha, supervisor, proyecto, interno, parte, tipo, tarea, horas, dimensiones, cantidad, unidad, observaciones y mes.

Consecuencia: además de los campos tipados, cualquier columna histórica presente en `raw_data` sigue siendo observable por consumidores genéricos. No es seguro retirar `raw_data` sin sustituir primero esa compatibilidad.

### RMA15

También expande `raw_data` completo y agrega aliases tipados. Además genera dinámicamente pares `codigo N`, `nombre N`, `cantidad N` desde `row.insumos`.

Consecuencia: una proyección reducida debe incluir no sólo campos de la OT sino también `insumos` y cualquier campo legacy que todavía se consulte dinámicamente.

### Lista Maestra

Expande `raw_data` completo. El propio adaptador busca variantes en el raw para:

- `Familia`
- `FAMILIA`
- `Tipo`
- `Tipo de equipo`
- cualquier clave cuyo nombre comience con `familia`
- `Codigo nuevo` / `Código nuevo`
- `Codigo de Drusila` / `Código de Drusila`
- `Codigo anterior` / `Código anterior`
- `Marca`
- `Modelo`
- `Lugar de alquiler`

Consecuencia: `raw_data` todavía cumple una función real de compatibilidad y no es sólo peso muerto.

### Insumos

Expande `raw_data` y agrega aliases para:

- `Codigo` / `Código`
- `Descripcion` / `Descripción`
- `Precio` / `Precio Unitario`

Consecuencia: los consumidores históricos pueden seguir leyendo columnas no tipadas mediante el objeto expandido.

### Conclusión de la Fase 0 sobre `select=*`

La recomendación de reducir columnas sigue siendo válida como objetivo, pero **no es un quick win seguro todavía**. Antes hace falta:

1. registrar qué columnas llegan realmente por dataset;
2. medir el peso de `raw_data` frente al payload total;
3. identificar accesos dinámicos (`getVal`, búsquedas por nombre de columna, spreads y exports);
4. crear una lista explícita de compatibilidad por dataset;
5. recién entonces probar una proyección reducida con regresiones de filtros, exports, perfiles, costos y mantenimiento.

---

# Tabla esperada después de capturar una sesión

## Carga inicial

| Dataset | Filas | Requests | Bytes | Duración | Caché |
| --- | ---: | ---: | ---: | ---: | --- |
| ... | ... | ... | ... | ... | hit/miss |

## Navegación

| Vista | Tiempo hasta ready | Requests nuevos | Datos reutilizados |
| --- | ---: | ---: | --- |
| ... | ... | ... | ... |

## Refresh

| Task | Duración | Resultado | Vista |
| --- | ---: | --- | --- |
| ... | ... | ... | ... |

# Criterio para avanzar a Fase 1

No reducir datasets ni columnas hasta tener al menos una captura fría y una caliente, y hasta comprobar que cualquier ahorro propuesto supera el riesgo de romper compatibilidad legacy.
