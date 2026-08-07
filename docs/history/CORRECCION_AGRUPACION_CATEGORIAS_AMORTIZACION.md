# Corrección de agrupación por categoría en Amortización

La tabla Amortización ahora usa la categoría configurada en “Categorías por modelo” como única clave de agrupación.

- Modelos distintos asignados a la misma categoría quedan dentro del mismo bloque de “Promedio por tipo”.
- El ordenamiento de columnas se aplica dentro de cada categoría y ya no fragmenta el bloque azul.
- Las categorías personalizadas que no existen en la configuración original también se mantienen contiguas.
- La comparación normaliza mayúsculas, tildes y espacios.

Ejemplo corregido: una PC200 asignada a `EXCAVADORA PC210` se agrupa junto con todas las PC210 y participa del mismo promedio.
