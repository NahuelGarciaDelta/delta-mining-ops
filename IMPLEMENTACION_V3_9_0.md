# Delta Mining OPS v3.9.0 — Integración de plataforma

## 1. Motor único de actualización
- `src/services/refreshManager.js` centraliza tareas de actualización propias de cada módulo.
- El botón **Actualizar** del encabezado es el único refresco maestro de datos.
- La misma ruta se usa para el auto-refresh cada 5 minutos y al recuperar conexión.
- Abastecimiento, Mantenimiento Programado, Licitaciones y Ficha de Equipo registran sus endpoints propios en el motor.
- Las vistas basadas en datasets estándar declaran sus fuentes en `src/config/viewSources.js`.
- Se eliminó el evento legacy `delta-mining:auto-refresh`.

## 2. Permisos por acción
- `src/services/permissionService.js` define: `view`, `edit`, `approve`, `delete`, `export`.
- Oficina Técnica y ADMIN poseen permisos completos.
- Un usuario de Mantenimiento puede operar PM pero el Informe de Costos queda en solo lectura.
- Abastecimiento puede gestionar solicitudes de su área sin habilitar edición de costos.
- Licitaciones aplica permisos separados de edición, eliminación y exportación.
- Configuración de usuario muestra permisos efectivos; sólo ADMIN puede cambiar el área del usuario.
- Apps Script valida que un usuario no-admin no pueda autoasignarse otra área mediante `update_user_profile`.

## 3. Ficha única del equipo
Nueva vista `equipmentProfile` accesible desde el sidebar y haciendo clic en columnas Interno/Código Interno.
Integra:
- Lista Maestra: marca, modelo, familia, propiedad, costo/tarifa y datos técnicos.
- ROP02: actividad, horómetro, horas, combustible y proyecto actual.
- ROP05: horas productivas.
- RMA15: OT, insumos, costo e indicador operativo.
- PM: historial de `PM_REGISTROS`.
- Gráficos: evolución del horómetro y costo mensual de insumos RMA15.

## 4. Dashboard ejecutivo
La bienvenida incorpora un resumen transversal con accesos directos a módulos:
- equipos activos;
- disponibilidad registrada;
- PM críticos;
- costo de mantenimiento del mes;
- solicitudes abiertas;
- stock crítico;
- productividad mensual;
- licitaciones con hitos próximos.

## 5. Tablas avanzadas
El componente compartido `Table` incorpora:
- orden ascendente / descendente / original;
- búsqueda global;
- filtros por columna;
- columnas visibles configurables;
- primera columna fija;
- redimensionamiento de columnas;
- densidad compacta/normal/cómoda;
- exportación CSV de lo filtrado;
- persistencia de preferencias de tabla;
- acceso a Ficha de Equipo desde columnas de interno.
Las tablas HTML legacy conservan ordenamiento global de tres estados y navegación por interno mediante delegación segura.

## 6. Comparación
Mantenimiento, Productividad ROP05 e Informe de Costos incorporan:
- período seleccionado contra período inmediatamente anterior de igual duración;
- José María contra Filo del Sol cuando no se restringe el filtro de proyecto.

## 7. PWA y funcionamiento offline
- Service Worker v3.9.0 con cache seguro y stale-while-revalidate para assets.
- Navegación offline desde el último shell válido.
- Datasets persisten por fuente en IndexedDB con fallback a localStorage.
- La app hidrata datos cacheados antes de consultar Google Sheets y sincroniza silenciosamente.
- Banner visible `Datos guardados — sin conexión` cuando se pierde internet.
- `Cache.put()` ya no puede romper la app por errores de red.

## 8. Error boundaries
Módulos principales están aislados con `ModuleErrorBoundary`; un error local ofrece **Reintentar** sin derribar la aplicación completa.

## 9. Rendimiento / cache por dataset
- `appCache.js` persiste cada fuente por separado.
- `VIEW_SOURCES` determina qué dataset necesita cada vista.
- Se evita volver a descargar fuentes ajenas al módulo activo.
- Los datos locales aparecen primero; la red actualiza en segundo plano.

## 10. Versionado visible
- Aplicación: `Delta Mining OPS v3.9.0`.
- Visible en sidebar, encabezado y bienvenida.
- `package.json` actualizado a `3.9.0`.
- Cache PWA versionado para evitar servir bundles obsoletos.

## Validaciones ejecutadas
- `npm run validate`: OK.
- Imports locales: 71 archivos JS/JSX OK.
- Security audit: OK.
- Tests: 11/11 OK.
- Parse JSX completo con TypeScript (`tsc --jsx preserve --noResolve`): OK para todo `src`.
- Apps Script: `node --check` sobre copia `.js`: OK.

## Build Vite
Se intentó instalar dependencias desde npm público, pero el entorno de ejecución agotó el tiempo de conexión antes de descargar Vite. Por eso el `npm run build` final debe ejecutarse en una máquina con las dependencias instaladas. La sintaxis JSX completa sí fue validada con TypeScript y las pruebas locales pasaron.
