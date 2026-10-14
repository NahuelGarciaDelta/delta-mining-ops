# Changelog

## Sin publicar — 2026-10-14

- Separar la actualización de horómetros de la edición general de equipos; escribir sólo la celda autorizada con control de valor esperado, identidad y concurrencia.
- Confirmar resultados individuales y recuperar operaciones con respuesta perdida sin repetir escrituras confirmadas.
- Unificar login y cambio de contraseña en Apps Script, migrar nuevas contraseñas a hash y mantener coherente el espejo y la sesión.
- Separar los errores de apariencia de los cambios de contraseña confirmados y proteger contra respuestas de sesiones cerradas.
- Corregir la comparación de versiones ausente en resultados históricos cacheados.
- Agregar pruebas de integridad y un recorrido de navegador con backend simulado.
- Preparar una migración manual para retirar el RPC de autenticación independiente de Supabase, sin ejecutarla.

Detalles, evidencia y límites: [auditoría](docs/auditoria-auth-horometros-2026-10-14.md).

- Entregar auditoría AST y huellas del Apps Script completo; conservar el original adjunto para comparación reproducible.
- Preparar integración en copias (editor, HTTP y proxy local mixto) con bloqueo de destinos de producción y sin desplegar.
- Aceptar alias de código equivalentes del adaptador Supabase sin permitir identificadores contradictorios.
