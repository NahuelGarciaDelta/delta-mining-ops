import test from "node:test";
import assert from "node:assert/strict";
import { escapeTooltipText, sanitizeTooltipStyle } from "../src/shared/safeTooltipSecurity.js";

test("escapeTooltipText neutraliza HTML y atributos inyectados", () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const escaped = escapeTooltipText(payload);
  assert.equal(escaped.includes("<img"), false);
  assert.equal(escaped.includes("<script"), false);
  assert.match(escaped, /&lt;img/);
});

test("sanitizeTooltipStyle conserva estilos visuales seguros", () => {
  assert.deepEqual(sanitizeTooltipStyle("color:#fff;font-weight:800;margin-top:4px"), {
    color: "#fff",
    fontWeight: "800",
    marginTop: "4px"
  });
});

test("sanitizeTooltipStyle elimina URLs, javascript y propiedades no permitidas", () => {
  const result = sanitizeTooltipStyle("color:red;background-image:url(javascript:alert(1));position:fixed;width:100px");
  assert.equal(result.color, "red");
  assert.equal(result.width, "100px");
  assert.equal("backgroundImage" in result, false);
  assert.equal("position" in result, false);
});
