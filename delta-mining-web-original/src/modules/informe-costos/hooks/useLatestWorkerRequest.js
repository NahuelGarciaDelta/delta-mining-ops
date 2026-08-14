import { useCallback, useRef, useState } from "react";
import { informeCostosCommand } from "../services/informeCostosWorkerClient.js";

/**
 * Ejecuta comandos y descarta respuestas anteriores cuando el usuario cambia
 * filtros varias veces seguidas. Mantiene el último resultado visible.
 */
export function useLatestWorkerRequest() {
  const latestRequest = useRef(0);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (type, payload) => {
    const id = ++latestRequest.current;
    setUpdating(true);
    setError(null);
    try {
      const result = await informeCostosCommand(type, payload);
      if (id !== latestRequest.current) return null;
      return result;
    } catch (err) {
      if (id === latestRequest.current) setError(err);
      throw err;
    } finally {
      if (id === latestRequest.current) setUpdating(false);
    }
  }, []);

  return { run, updating, error };
}
