# Incidente: Data API de Supabase sin respuesta

Fecha: 28/10/2026. Proyecto afectado: `jwfocqaxlckuxoklwyxs`.

## Evidencia reproducible

La ruta productiva que fallaba era:

```text
GET https://delta-mining-ops.vercel.app/api/supabase-read?target=/rest/v1/lista_equipos?select=*&order=source_row.asc&limit=1000&offset=0
```

El handler `api/supabase-read.js` aborta su llamada upstream a los 25 segundos y
devuelve HTTP 504 con el texto observado por los usuarios. La prueba controlada
recibió ese 504 después de 25,49 s.

Para descartar que el proxy fuese la causa raíz, se probó directamente la
consulta mínima, sin orden, sin JSON grande y sin conteo:

```text
GET /rest/v1/lista_equipos?select=source_row&limit=1
```

contra `https://jwfocqaxlckuxoklwyxs.supabase.co` con la clave publishable de la
aplicación. No recibió ningún byte en 10,00 s y agotó el timeout del cliente.
Por lo tanto, el 504 del proxy es un efecto del Data API/PostgREST que no está
respondiendo, no una consulta de 127 equipos que se pueda reparar sólo en Vercel.

## Medidas aplicadas en la rama de recuperación

- Se conserva la reducción previa de concurrencia, paginación sin `count=exact`,
  carga histórica bajo demanda y cachés explícitamente no verificadas.
- Se eliminó de la build el transform que redirigía lecturas públicas por
  `/api/supabase-read`. El navegador consulta el Data API de Supabase directamente
  con la clave publishable, que ya estaba incluida en el bundle y soporta CORS.
  Esto elimina el timeout artificial de 25 s y un salto de red, sin aumentar
  concurrencia ni reintentos.
- Se agregó una regresión que impide reintroducir ese proxy de 25 s.

No se hicieron cambios SQL, DDL, reinicios, cron, Edge Functions, Apps Script,
Google Sheets, permisos, credenciales ni datos históricos.

## Información para soporte de Supabase

Solicitar revisión de disponibilidad de PostgREST/pool y PostgreSQL del proyecto
en la ventana del incidente. Adjuntar:

- el timeout directo de la consulta mínima anterior;
- los errores previos `PGRST002`, `statement timeout`, `connection reset by peer`
  y `job startup timeout`;
- la respuesta de 25,49 s del proxy sólo como síntoma secundario;
- los datasets afectados: `lista_equipos`, `rop02`, `rop05` y `rma15`.

Pedir logs de Data API, saturación del pool, esperas/locks e I/O de PostgreSQL,
y confirmación de recuperación antes de ejecutar diagnósticos de tablas o
sincronizaciones. No reiniciar nuevamente la base como mitigación inicial.

## Verificación pendiente cuando el servicio responda

Ejecutar lecturas de una fila y luego las lecturas paginadas de Lista Maestra,
ROP02 y ROP05; contrastar los conteos de referencia sin borrar ni reintentar
escrituras. Después, comprobar las respuestas HTTP reales de los cron 29--32 y
de las Edge Functions, no sólo su estado en `pg_cron`.
