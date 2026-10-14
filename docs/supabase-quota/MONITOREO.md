# Monitoreo diario sin consultas a tablas

Abrir https://supabase.com/dashboard/org/prhrkgunfokkpopvvdsv/usage con una cuenta autorizada. Si el enlace redirige, elegir organización → Usage. Registrar inicio/fin del ciclo REAL y filtro de todos los proyectos. Revisar Database/Auth/Storage/Realtime, tamaño DB, conexiones, egress cacheado/no cacheado, storage, MAU, mensajes y otras cuotas; consultar Billing y el detalle de la advertencia. No sumar instantáneas diarias de MAU, tamaño DB o conexiones como si fueran consumo incremental.

La advertencia y su fecha 10/11/2026 están confirmadas en capturas del usuario, no mediante API. Egress 6,096 GB está por encima de la cuota Free publicada de 5 GB. Para atribuir sus causas y descartar otras cuotas falta exportación/desglose de Usage, ciclo anterior y actual y todos los proyectos. Las capturas muestran Free, pero falta confirmar límites/estado efectivo de cada recurso. Una clave pública de PostgREST no permite leer facturación ni la organización. No se usó service_role ni se intentó extraer credenciales. El requisito SUPABASE_ACCESS_TOKEN (solo api.supabase.com) quedó guardado en el borrador del entorno; revisar, guardar y publicar para habilitarlo. No ponerlo en VITE_* ni chat.

Se necesita un token Management con acceso autorizado a esa organización para leer lista de proyectos y diagnósticos. La disponibilidad/permisos de la API de Usage se deben verificar con ese acceso; hoy NO se probó ni se inventó un endpoint de facturación. Un token no garantiza que todos los conceptos de Usage estén expuestos. El dashboard/exportación sigue siendo la referencia para las métricas no disponibles por API.

Herramienta preparada: `node scripts/supabase-usage-budget.mjs /ruta/privada/usage.json`. No hace llamadas de red, no consume egress ni añade polling en la aplicación. Lee incrementos diarios de Usage de TODOS los proyectos y falla si faltan días/proyectos declarados o hay duplicados. El operador debe asegurarse de incluir todos los proyectos; el script no puede descubrir proyectos omitidos sin acceso Management.

Formato (valores de ejemplo, NO son mediciones):

```json
{
  "cycleStart": "2026-10-01",
  "cycleEndExclusive": "2026-11-01",
  "lastCompleteDay": "2026-10-01",
  "uncachedLimitBytes": 5000000000,
  "targetBytes": 3600000000,
  "growthFactor": 1.2,
  "projects": [{
    "ref": "REEMPLAZAR_POR_PROYECTO_REAL",
    "daily": [{"date":"2026-10-01","uncachedEgressBytes":120000000,"cachedEgressBytes":0}]
  }],
  "otherQuotas": []
}
```

Usar el límite y las unidades reales del dashboard, no inferir bytes facturados a partir de nuestras muestras JSON. Exportar cada día completo una sola vez. No introducir el total acumulado del ciclo como incremento diario ni sumar Database+Storage si ya están incluidos en el total de egress. Cached egress es un pool distinto. Repetir para todos los proyectos y días observados. Mantener otros conceptos como valores/rangos con sus límites, no agregarlos al egress.

El reporte calcula acumulado, promedio diario, proyección hasta el fin real del ciclo, margen, presupuesto diario restante y escenario de crecimiento de 20%. Una proyección no garantiza cumplimiento. Verificar nuevamente Usage tras publicar una optimización autorizada y acumular varios días representativos; el Preview por sí solo no reduce tráfico de usuarios productivos.

Objetivo provisional: máximo 3,6 GB no cacheados por ciclo de toda la organización, sujeto a confirmar límites/otras cuotas. 120 MB/día son 3,6 GB en 30 días y 3,72 GB en 31; 130 MB/día son 4,03 GB en 31 días. Para 3,6 GB en 31 días usar ~116,1 MB/día. Descontar uso de otros proyectos. Con 20% de crecimiento, 3,6 GB → 4,32 GB, dejando margen bajo un límite de 5 GB si no hay consumo adicional omitido.

Fuentes oficiales consultadas HTTP 200 el 14/10/2026:
- https://supabase.com/pricing : Free 5 GB egress, 5 GB cached egress, 500 MB database size, 1 GB file storage, 50.000 MAU, límite 2 proyectos activos. Pricing también publica 200 conexiones concurrentes Realtime, 2 millones de mensajes, 500.000 invocaciones Edge, 1 GB Log Ingestion y 100 GB Log Query. No se confirmó aquí el límite efectivo contratado de cada recurso; Logs aparece UPCOMING en la captura.
- https://supabase.com/docs/guides/platform/manage-your-usage/egress : cuota unificada Database/Auth/Storage; el uso ya servido no se reduce retroactivamente.
- https://supabase.com/docs/guides/platform/billing-faq#fair-use-policy : superar cuotas persistentemente puede causar restricciones; el aviso puede persistir tras bajar el uso y el período de gracia no se reinicia inmediatamente.

Para el 10/11: reducir TODAS las cuotas excedidas y mantener los límites, no solo optimizar consultas. No puede prometerse desaparición inmediata del aviso ni impedir una restricción si el ciclo acumulado ya excedió la cuota. Si las métricas están dentro de límites pero el dashboard mantiene una restricción/fecha, consultar Support con organización, ciclo y exportación, sin cambiar el plan ni habilitar pagos. No se envió ningún mensaje a Support ni se realizó una acción administrativa. No consta hoy si falta una gestión adicional para esta organización.


Actualización: acceso seguro probado HTTP 200. El colector scripts/collect-supabase-diagnostics.py ya se ejecutó y permite snapshot diario de counts, funciones y cron; ver ACCESO-Y-DIAGNOSTICOS.md. No devuelve egress facturado. El perfil de organización devuelve 403, pero proyecto/analytics/read-only SQL funcionan. No hace falta volver a proporcionar un token para estos diagnósticos.
