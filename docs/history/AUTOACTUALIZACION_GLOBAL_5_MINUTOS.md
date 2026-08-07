# Autoactualización global cada 5 minutos

- La vista activa vuelve a leer sus fuentes desde Apps Script cada 5 minutos.
- La actualización se ejecuta en segundo plano, sin bloquear la interfaz.
- Mantenimiento Programado vuelve a leer su endpoint propio en el mismo ciclo.
- Si la pestaña está oculta, se evita consumir cuota; al volver, se actualiza si corresponde.
- Al recuperar conexión a Internet, se ejecuta una actualización automática.
