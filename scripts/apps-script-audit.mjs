import fs from "node:fs";
import crypto from "node:crypto";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parse } from "espree";
import { Linter } from "eslint";

export const GAS_GLOBALS = Object.fromEntries(
  [
    "console",
    "SpreadsheetApp",
    "PropertiesService",
    "CacheService",
    "Utilities",
    "LockService",
    "ContentService",
    "ScriptApp",
    "DriveApp",
    "Session",
    "UrlFetchApp",
    "MimeType",
    "HtmlService",
    "Sheets",
    "Logger",
    "GmailApp",
    "MailApp"
  ].map((name) => [name, "readonly"])
);
export const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
export function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (["range", "loc", "tokens", "comments"].includes(key)) continue;
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}
export function inspectBackend(bytes) {
  const source = bytes.toString("utf8").replace(/\r\n?/g, "\n");
  const ast = parse(source, { ecmaVersion: 2022, sourceType: "script", range: true, loc: true });
  new vm.Script(source); // Compile without executing Google services or reading properties.
  const functions = ast.body
    .filter((node) => node.type === "FunctionDeclaration")
    .map((node) => ({ name: node.id.name, line: node.loc.start.line, sha256: sha256(source.slice(...node.range)) }));
  const duplicates = [
    ...new Set(functions.map((fn) => fn.name).filter((name, index, names) => names.indexOf(name) !== index))
  ];
  const lint = new Linter().verify(source, {
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: GAS_GLOBALS },
    rules: {
      "no-undef": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-func-assign": "error"
    }
  });
  const triggers = [];
  for (const fn of ast.body.filter((node) => node.type === "FunctionDeclaration")) {
    const strings = new Map();
    walk(fn.body, (node) => {
      if (
        node.type === "VariableDeclarator" &&
        node.id.type === "Identifier" &&
        node.init?.type === "Literal" &&
        typeof node.init.value === "string"
      )
        strings.set(node.id.name, node.init.value);
    });
    walk(fn.body, (node) => {
      if (
        node.type !== "CallExpression" ||
        node.callee.type !== "MemberExpression" ||
        node.callee.object.name !== "ScriptApp" ||
        node.callee.property.name !== "newTrigger"
      )
        return;
      const argument = node.arguments[0];
      const target = argument?.type === "Literal" ? argument.value : strings.get(argument?.name);
      triggers.push({
        registeredBy: fn.id.name,
        target: target || null,
        resolved: typeof target === "string" && functions.some((f) => f.name === target),
        line: node.loc.start.line
      });
    });
  }
  const sheetIds = new Set();
  for (const statement of ast.body) {
    if (statement.type !== "VariableDeclaration") continue;
    for (const declaration of statement.declarations) {
      if (declaration.id.name === "SHEETS_CONFIG")
        walk(declaration.init, (node) => {
          if (
            node.type === "Property" &&
            (node.key.name || node.key.value) === "id" &&
            typeof node.value.value === "string"
          )
            sheetIds.add(node.value.value);
        });
      if (
        /_DB_ID_$/.test(declaration.id.name) &&
        declaration.init?.type === "Literal" &&
        typeof declaration.init.value === "string"
      )
        sheetIds.add(declaration.init.value);
    }
  }
  const version = source.match(/var DELTA_BACKEND_VERSION_\s*=\s*"([^"]+)"/)?.[1];
  return {
    source,
    ast,
    sha256: sha256(bytes),
    normalizedSha256: sha256(source),
    bytes: bytes.length,
    lines: source.split("\n").length - (source.endsWith("\n") ? 1 : 0),
    version,
    functions,
    duplicates,
    triggers,
    sheetIds: [...sheetIds],
    lint: lint.map((x) => ({ line: x.line, column: x.column, rule: x.ruleId, message: x.message })),
    syntax: "passed"
  };
}
export function buildBackendAudit(originalBytes, finalBytes) {
  const original = inspectBackend(originalBytes),
    final = inspectBackend(finalBytes);
  const prior = new Map(original.functions.map((fn) => [fn.name, fn]));
  const current = new Map(final.functions.map((fn) => [fn.name, fn]));
  const modified = final.functions
    .filter((fn) => prior.has(fn.name) && prior.get(fn.name).sha256 !== fn.sha256)
    .map((fn) => ({ name: fn.name, originalLine: prior.get(fn.name).line, finalLine: fn.line }));
  const added = final.functions.filter((fn) => !prior.has(fn.name)).map(({ name, line }) => ({ name, line }));
  const removed = original.functions.filter((fn) => !current.has(fn.name)).map((fn) => fn.name);
  const unchanged = original.functions.filter((fn) => current.get(fn.name)?.sha256 === fn.sha256).map((fn) => fn.name);
  return {
    original: {
      sha256: original.sha256,
      normalizedSha256: original.normalizedSha256,
      bytes: original.bytes,
      lines: original.lines,
      version: original.version,
      functionCount: original.functions.length
    },
    final: {
      sha256: final.sha256,
      normalizedSha256: final.normalizedSha256,
      bytes: final.bytes,
      lines: final.lines,
      version: final.version,
      functionCount: final.functions.length
    },
    modified,
    added,
    removed,
    unchanged,
    checks: {
      syntax: final.syntax,
      duplicateFunctions: final.duplicates,
      undefinedReferences: final.lint.filter((x) => x.rule === "no-undef"),
      otherStaticErrors: final.lint.filter((x) => x.rule !== "no-undef"),
      triggerCallbacks: final.triggers,
      allOriginalFunctionsPreserved: removed.length === 0
    },
    scope:
      "Static identifiers and statically named triggers checked; native Apps Script service methods and runtime permissions still require real-copy execution."
  };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const report = buildBackendAudit(
    fs.readFileSync(process.argv[2] || "audit/apps-script-original-v8.txt"),
    fs.readFileSync(process.argv[3] || "AppsScript_Delta_Mining_OPS_FINAL.txt")
  );
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, unchangedCount: report.unchanged.length, unchanged: undefined }, null, 2));
  const { checks } = report;
  if (
    checks.duplicateFunctions.length ||
    checks.undefinedReferences.length ||
    checks.otherStaticErrors.length ||
    !checks.allOriginalFunctionsPreserved ||
    checks.triggerCallbacks.some((x) => !x.resolved)
  )
    process.exitCode = 1;
}
