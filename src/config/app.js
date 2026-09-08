// All browser data requests go through the same-origin Vercel proxy.
// This avoids PC/browser-specific stalls while following Google Apps Script redirects.
export const APPS_SCRIPT_URL = "/api/apps-script";
