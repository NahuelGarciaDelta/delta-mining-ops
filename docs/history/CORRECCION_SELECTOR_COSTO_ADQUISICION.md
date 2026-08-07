# Corrección del selector de costo de adquisición

- El selector de Datos Equipos ahora guarda una clave única por opción (interno, marca, modelo, precio e índice).
- Al elegir un equipo individual, la fila utiliza su costo de adquisición real.
- Se recalculan inmediatamente la amortización y el costo horario total.
- Se mantiene compatibilidad con selecciones guardadas anteriormente por interno.
- El selector cerrado continúa mostrando solo el valor en USD.

Validación ejecutada: `npm run validate` sin errores.
El build completo no se ejecutó porque Vite no está instalado en el entorno (`vite: not found`).
