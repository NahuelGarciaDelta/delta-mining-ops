import { useCallback, useEffect, useState } from "react";
import { setAppDialogHandler } from "../services/dialogService.js";

export function useAppDialog() {
  const [appDialog, setAppDialog] = useState(null);

  useEffect(() => {
    setAppDialogHandler((payload) => new Promise((resolve) => {
      setAppDialog({ ...payload, resolve });
    }));
    return () => setAppDialogHandler(null);
  }, []);

  const closeAppDialog = useCallback((answer) => {
    setAppDialog((current) => {
      if (current?.resolve) current.resolve(answer);
      return null;
    });
  }, []);

  return { appDialog, closeAppDialog };
}
