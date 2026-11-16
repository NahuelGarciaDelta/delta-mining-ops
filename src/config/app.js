// All browser data requests go through the same-origin Vercel proxy.
// Keep the URL absolute in the browser because Desgaste builds it with new URL().
// The endpoint remains exactly the same /api/apps-script proxy.
export const APPS_SCRIPT_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/apps-script`
    : "/api/apps-script";

// Las escrituras firmadas de horómetros van directo al mismo deployment. Evita
// que un proxy intermedio vuelva a serializar el payload que contiene el token.
export const METER_WRITE_URL="https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec";
