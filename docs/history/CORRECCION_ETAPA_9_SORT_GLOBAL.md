# Corrección Etapa 9

Se restauró `useGlobalThreeStateTableSort` en `App.jsx`. Durante la extracción de Oficina Técnica, la función había quedado únicamente dentro de `LicitacionesModule.jsx`, pero `App` seguía invocándola globalmente.

El aviso de `beforeinstallprompt` no bloquea la aplicación. Los errores de WebSocket corresponden al HMR de Vite y suelen resolverse reiniciando `npm run dev`.
