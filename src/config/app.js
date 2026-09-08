// All browser data requests go through the same-origin Vercel proxy.
// Keep the URL absolute in the browser because Desgaste builds it with new URL().
// The endpoint remains exactly the same /api/apps-script proxy.
export const APPS_SCRIPT_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/apps-script`
    : "/api/apps-script";
