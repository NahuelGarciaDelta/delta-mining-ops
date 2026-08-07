import { useCallback, useEffect, useState } from "react";

export function usePwaInstall() {
  const [available, setAvailable] = useState(() => Boolean(window.dmPwaInstallAvailable));

  useEffect(() => {
    const onAvailable = () => setAvailable(true);
    const onUnavailable = () => setAvailable(false);
    window.addEventListener("dm-pwa-install-available", onAvailable);
    window.addEventListener("dm-pwa-install-unavailable", onUnavailable);
    setAvailable(Boolean(window.dmPwaInstallAvailable));
    return () => {
      window.removeEventListener("dm-pwa-install-available", onAvailable);
      window.removeEventListener("dm-pwa-install-unavailable", onUnavailable);
    };
  }, []);

  const install = useCallback(async () => {
    if (typeof window.dmInstallPWA !== "function") return false;
    const installed = await window.dmInstallPWA();
    if (installed) setAvailable(false);
    return Boolean(installed);
  }, []);

  return { pwaInstallAvailable: available, installPwa: install };
}
