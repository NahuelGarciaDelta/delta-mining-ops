# Riesgos pendientes

1. Suite funcional roja: no es seguro declarar GO hasta clasificar y corregir los grupos de Abastecimiento, Dashboard, Atraso y Stock.
2. Contrato backend no versionado: los tests aún dependen del Apps Script monolítico retirado.
3. Dependencias: `npm ci` reporta 9 vulnerabilidades transitivas (6 high). Requiere actualización planificada y pruebas de regresión, no `npm audit fix --force`.
4. Build sandbox: el workaround de `realpathSync.native` es sólo de diagnóstico/CI; no debe incluirse en producción.
5. Rendimiento end-to-end: faltan series cold/warm con usuario de prueba, datos representativos y DevTools accesible. No hay porcentajes válidos para esas métricas.
