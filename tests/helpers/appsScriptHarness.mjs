import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

export const backend = fs.readFileSync(new URL("../../AppsScript_Delta_Mining_OPS_FINAL.txt", import.meta.url), "utf8");
export const equipmentHeaders = [
  "Código de Drusila",
  "Codigo nuevo",
  "Familia",
  "Marca",
  "Modelo",
  "Propiedad",
  "Número de serie",
  "HORAS",
  "Proyecto",
  "Costo",
  "Potencia",
  "Año de fabricación",
  "Fecha de ingreso",
  "Combustible",
  "Capacidad tanque",
  "Capacidad carga",
  "Parámetros técnicos",
  "Seguro",
  "Moneda",
  "Observaciones",
  "Código auxiliar"
];
export const cta0530 = [
  "AF479QX",
  "CTA-0530",
  "Camioneta con mochila",
  "TOYOTA",
  "HILUX",
  "FARO",
  "8AJKA3CD8R3125053",
  99879,
  "JOSE MARIA BATIDERO",
  3200,
  150,
  2022,
  "2024-01-15",
  "Diesel",
  80,
  1000,
  "Parámetros de referencia",
  250,
  "USD",
  "Nota de referencia",
  "CTA-OTHER"
];
export const userHeaders = ["Email", "Rol", "Proyecto", "Activo", "Nombre", "Contraseña", "Area"];

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}
export function makeSheet(headers, rows = [], { formulas = {} } = {}) {
  const values = [headers, ...rows].map((row) => [...row]);
  const metadata = values.map((row, r) =>
    row.map((_, c) => ({
      formula: formulas[`${r + 1}:${c + 1}`] || "",
      format: "original-format",
      note: `note-${r}-${c}`,
      validation: { criterion: "original" }
    }))
  );
  const writes = [],
    reads = [];
  const sheet = {
    values,
    metadata,
    writes,
    reads,
    getLastRow: () => values.length,
    getLastColumn: () => values[0].length,
    getRange(r, c, nr = 1, nc = 1) {
      reads.push({ r, c, nr, nc });
      const range = {
        getValues: () =>
          Array.from({ length: nr }, (_, i) =>
            Array.from({ length: nc }, (_, j) => values[r + i - 1]?.[c + j - 1] ?? "")
          ),
        getDisplayValues: () => range.getValues().map((row) => row.map(String)),
        getValue: () => {
          const value = values[r - 1]?.[c - 1] ?? "";
          sheet.onReadValue?.({ r, c, value });
          return value;
        },
        getFormula: () => metadata[r - 1]?.[c - 1]?.formula || "",
        setNumberFormat(format) {
          metadata[r - 1][c - 1].format = format;
          return range;
        },
        setValue(value) {
          if (nr !== 1 || nc !== 1) throw new Error("Forbidden multi-cell setValue");
          writes.push({ r, c, nr, nc, value });
          values[r - 1][c - 1] = value;
          metadata[r - 1][c - 1].formula = "";
          if (sheet.failAfterWrite) {
            sheet.failAfterWrite = false;
            throw new Error("Response lost after write");
          }
          return range;
        },
        setValues() {
          throw new Error("Forbidden complete-row write");
        }
      };
      return range;
    }
  };
  return sheet;
}
export function makeBackend({
  equipmentRows = [cta0530],
  users = [["user@delta.test", "USUARIO", "TODOS", "SI", "Usuario", "", "TALLER CENTRAL"]],
  formulas
} = {}) {
  const equipment = makeSheet(equipmentHeaders, equipmentRows, { formulas });
  const usuarios = makeSheet(userHeaders, users);
  const properties = new Map([["APP_AUTH_TOKEN_SECRET", "test-secret-with-no-production-value"]]);
  const failures = { property: null, flush: false };
  const props = {
    getProperty: (key) => properties.get(key) ?? null,
    setProperty(key, value) {
      if (failures.property?.(key, value)) throw new Error("Properties unavailable");
      properties.set(key, String(value));
    },
    deleteProperty: (key) => properties.delete(key),
    getProperties: () => Object.fromEntries(properties),
    setProperties(object) {
      for (const [key, value] of Object.entries(object)) props.setProperty(key, value);
    }
  };
  let locked = false;
  const lock = {
    tryLock() {
      if (locked) return false;
      locked = true;
      return true;
    },
    waitLock() {
      if (!lock.tryLock()) throw new Error("Nested lock");
    },
    releaseLock() {
      locked = false;
    }
  };
  const sandbox = {
    console,
    Date,
    JSON,
    Math,
    isFinite,
    SpreadsheetApp: {
      openById: (id) => id,
      flush() {
        if (failures.flush) {
          failures.flush = false;
          throw new Error("Flush unavailable");
        }
      }
    },
    PropertiesService: { getScriptProperties: () => props },
    LockService: { getScriptLock: () => lock },
    Utilities: {
      Charset: { UTF_8: "utf8" },
      DigestAlgorithm: { SHA_256: "sha256" },
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (input, secret) => [...crypto.createHmac("sha256", secret).update(input).digest()],
      computeDigest: (_, input) => [...crypto.createHash("sha256").update(input).digest()],
      base64EncodeWebSafe: (input) => Buffer.from(typeof input === "string" ? input : input).toString("base64url"),
      base64DecodeWebSafe: (input) => [...Buffer.from(input, "base64url")],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() })
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({
        text,
        setMimeType() {
          return this;
        }
      })
    }
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(backend, context);
  context.SHEETS_CONFIG = {
    lista_equipos: { id: "equipment", headerRow: 1 },
    usuarios: { id: "usuarios", headerRow: 1 }
  };
  context.findSheetByGidOrName = (id) => (id === "equipment" ? equipment : usuarios);
  function call(name, ...args) {
    if (name === "handleListaHorometros_" && !args[0].actor) {
      const email = usuarios.values[1][0];
      // Meter fixtures model an already authenticated user with a personal password.
      if (!usuarios.values[1][5]) usuarios.values[1][5] = "fixture-personal-password";
      args[0] = { ...args[0], actor: { email, token: context.stockExcelIssueAuthToken_(email) } };
    }
    return JSON.parse(JSON.stringify(context[name](...args)));
  }
  return { context, equipment, usuarios, properties, props, failures, lock, call };
}
export function meterPayload(
  value = 99900,
  expectedValue = 99879,
  operationId = "meter-test-operation-0001",
  identity = { codigoDrusila: "AF479QX", codigoNuevo: "CTA-0530" }
) {
  return { operationId, updates: [{ identity, value, expectedValue }] };
}
export function profilePayload(overrides = {}) {
  return {
    email: "user@delta.test",
    currentPassword: "DELTA.MINING.APP",
    newPassword: "new-safe-password",
    nombre: "Usuario",
    area: "TALLER CENTRAL",
    operationId: "profile-test-operation-0001",
    ...overrides
  };
}
