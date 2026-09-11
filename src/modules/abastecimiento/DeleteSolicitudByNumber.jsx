import React, { useState } from "react";

export default function DeleteSolicitudByNumber({ deps = {}, onDeleted }) {
  const { APPS_SCRIPT_URL, C = {}, appAlert, appConfirm } = deps;
  const [busy, setBusy] = useState(false);

  const alertUser = (message) => {
    if (typeof appAlert === "function") return appAlert(message);
    window.alert(message);
  };

  const confirmUser = async (message) => {
    if (typeof appConfirm === "function") return appConfirm(message);
    return window.confirm(message);
  };

  const handleDelete = async () => {
    if (busy) return;
    const numero = String(window.prompt("Ingresá el N° de solicitud a eliminar:", "") || "").trim();
    if (!numero) return;

    const confirmed = await confirmUser(
      `¿Eliminar completamente la solicitud N° ${numero}?\n\nSe eliminarán todas las filas de RABA03 que tengan ese N° de solicitud. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        cache: "no-store",
        redirect: "follow",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: new URLSearchParams({
          payload: JSON.stringify({
            action: "delete_raba03_solicitud_numero",
            numeroSolicitud: numero,
          }),
        }).toString(),
      });

      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (_) {
        throw new Error("El servidor no devolvió una respuesta válida.");
      }

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message || `No se pudo eliminar la solicitud ${numero}.`);
      }

      const deletedRows = Number(json.deletedRows || 0);
      if (deletedRows <= 0) {
        await alertUser(`No se encontró ninguna fila con el N° de solicitud ${numero}.`);
        return;
      }

      await alertUser(`Solicitud N° ${numero} eliminada correctamente (${deletedRows} fila${deletedRows === 1 ? "" : "s"}).`);
      if (typeof onDeleted === "function") onDeleted();
    } catch (error) {
      await alertUser(`No se pudo eliminar la solicitud. ${error?.message || error}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 8px 0" }}>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        style={{
          height: 34,
          borderRadius: 9,
          border: `1px solid ${C.red || "#ff3b3b"}88`,
          background: `${C.red || "#ff3b3b"}18`,
          color: C.red || "#ff3b3b",
          padding: "0 12px",
          fontSize: 12,
          fontWeight: 900,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.65 : 1,
        }}
      >
        {busy ? "Eliminando..." : "Eliminar solicitud"}
      </button>
    </div>
  );
}
