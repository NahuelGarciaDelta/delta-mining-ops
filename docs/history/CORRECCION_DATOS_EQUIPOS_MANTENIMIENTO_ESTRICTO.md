# Corrección Datos Equipos — mantenimiento estricto por unidad

- La vista Licitaciones → Datos Equipos ya no permite que una unidad sin registros RMA15 herede mantenimiento de otra máquina por categoría, modelo o equivalencia general.
- Cada registro RMA15 se relaciona únicamente con los códigos declarados para esa unidad en Lista Maestra (actual, anterior, viejo o Drusila).
- Las equivalencias históricas siguen funcionando cuando el código antiguo está efectivamente asociado a la misma fila de Lista Maestra.
- Si una unidad no tiene ningún registro de mantenimiento dentro del período y filtros seleccionados, se excluye antes de calcular la categoría.
- Una categoría desaparece si, luego de esta validación, no conserva ninguna unidad con mantenimiento real.
- Se mantiene sin cambios el cálculo de combustible, amortización, filtros y exportación.
