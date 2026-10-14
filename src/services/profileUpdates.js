import { newOperationId, requestAppsScript } from "./confirmedWrites.js";
import {
  buildAuthenticatedUser,
  getAuthenticatedUser,
  getAuthenticatedSessionRevision,
  saveAuthenticatedSession
} from "./authSession.js";

const pending = new Map();
export function createProfileOperation(fields) {
  const user = getAuthenticatedUser();
  if (!user?.authCapabilities?.passwordHashProfile)
    throw new Error("El backend debe actualizarse antes de cambiar la contraseña. Luego volvé a iniciar sesión.");
  return {
    ...fields,
    action: "update_user_profile",
    operationId: newOperationId(),
    actor: { email: user?.email || fields.email, token: user?.authToken || "" }
  };
}
export function saveProfileOperation(url, operation) {
  if (pending.has(operation.operationId)) return pending.get(operation.operationId);
  const startedSessionRevision = getAuthenticatedSessionRevision();
  const task = (async () => {
    let result;
    try {
      result = await requestAppsScript(url, operation);
    } catch {
      // Same operation and same payload: backend reconciles the canonical cells before writing.
      try {
        result = await requestAppsScript(url, operation);
      } catch {
        const error = new Error(
          "La respuesta se perdió. El cambio puede haberse guardado. Volvé a verificar con los mismos datos."
        );
        error.code = "PROFILE_CONFIRMATION_PENDING";
        throw error;
      }
    }
    if (!result.ok) {
      const error = new Error(result.error?.message || "No se pudo confirmar el cambio de perfil.");
      error.code = result.error?.code;
      throw error;
    }
    if (!result.user?.email || typeof result.mustChangePassword !== "boolean" || !result.authToken)
      throw new Error("El servidor no confirmó la sesión actualizada. Actualizá el backend antes de continuar.");
    const current = getAuthenticatedUser();
    if (!current || current.email !== operation.email || getAuthenticatedSessionRevision() !== startedSessionRevision) {
      const error = new Error(
        "El perfil se guardó, pero la sesión cambió mientras llegaba la respuesta. Iniciá sesión para verificarlo."
      );
      error.code = "SESSION_CHANGED";
      throw error;
    }
    const user = buildAuthenticatedUser({ ...result, user: { ...current, ...result.user } }, operation.email);
    saveAuthenticatedSession(user, {
      mustChangePassword: result.mustChangePassword,
      normalizeProject: () => sessionStorage.getItem("dm_project") || user.proyecto || "TODO"
    });
    return result;
  })();
  pending.set(operation.operationId, task);
  task.finally(() => pending.delete(operation.operationId)).catch(() => {});
  return task;
}
