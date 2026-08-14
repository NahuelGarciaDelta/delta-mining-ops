# Capa de datos históricos

## Flujo

React consume `historicalDataService.js`. Las consultas se cachean por dataset, rango,
proyecto, equipo, supervisor, orden y página. `query_dataset` filtra y ordena antes de
aplicar `limit`/`offset`.

## Aceleradores ROP02

El Apps Script crea las hojas técnicas en la misma base de movimientos:

- `ROP02_RESUMEN_MENSUAL`
- `ROP02_ULTIMO_ESTADO`

No reemplazan ni modifican las fuentes ROP02 RAW.

Después de desplegar una nueva versión del Apps Script, ejecutar manualmente una vez,
desde el editor de Apps Script:

1. `rebuildRop02MonthlySummary()`
2. `rebuildRop02LatestSnapshot()`

Mientras el backfill no termina, las propiedades `DM_ROP02_MONTHLY_READY` y
`DM_ROP02_LATEST_READY` permanecen en `0`; los endpoints no consideran completo un
snapshot parcial. Las ediciones posteriores actualizan solamente el período operativo
y la combinación equipo/proyecto afectada.

## Particiones anuales

`ROP02_PARTITIONS_BY_YEAR_` se configura en el Apps Script. Cada entrada futura debe
declarar `key`, `id`, `gid`, `sheet`, `proyecto` y `headerRow`. No se deben mover ni
borrar filas actuales al activar el router. Un rango que cruza diciembre/enero toma
automáticamente ambas particiones y no consulta otros años.

Ejemplo conceptual:

```js
var ROP02_PARTITIONS_BY_YEAR_ = {
  2026: [{key:"rop02_jm_2026",id:"...",gid:"...",sheet:"ROP02_2026",proyecto:"JOSE MARIA",headerRow:4}],
  2027: [{key:"rop02_jm_2027",id:"...",gid:"...",sheet:"ROP02_2027",proyecto:"JOSE MARIA",headerRow:4}]
};
```
