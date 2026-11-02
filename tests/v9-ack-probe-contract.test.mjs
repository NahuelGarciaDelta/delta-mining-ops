import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../supabase/v9_migration/20261102_v9_sandbox_probe_digest.sql",import.meta.url),"utf8");
const norm=sql.replace(/--[^\n]*/g,"").replace(/\s+/g," ");

test("4O modifica la función existente y mantiene contrato de consulta",()=>{
  assert.match(norm,/CREATE OR REPLACE FUNCTION public\.v9_ingest_probe_v1\s*\(\s*p_dataset text,\s*p_record_ids text\[\]/i);
  assert.match(norm,/RETURNS jsonb/i);
  assert.match(norm,/V9_BAD_PROBE/);
  assert.match(norm,/v_count > 100/);
  assert.match(norm,/ORDER BY record_id/);
});
test("4O expone prueba de hash remoto sin payload bruto",()=>{
  assert.match(norm,/'payload_sha256', payload_sha256/);
  assert.match(norm,/'digest_verified', payload_sha256 = encode\( sha256\(convert_to\(payload::text, 'UTF8'\)\), 'hex' \)/i);
  assert.match(norm,/'delivery_revision', delivery_revision/);
  assert.doesNotMatch(norm,/'payload',\s*payload\b/i);
});
test("4O conserva RLS e impide invocación desde navegador",()=>{
  assert.match(norm,/SECURITY INVOKER/i);
  assert.match(norm,/REVOKE ALL ON FUNCTION public\.v9_ingest_probe_v1\(text,text\[\]\) FROM PUBLIC, anon, authenticated/i);
  assert.match(norm,/GRANT EXECUTE ON FUNCTION public\.v9_ingest_probe_v1\(text,text\[\]\) TO service_role/i);
});
test("4O no opera sobre producción ni genera modificaciones de datos",()=>{
  assert.match(norm,/V9_PROBE_SANDBOX_RECEIVER_REQUIRED/);
  assert.doesNotMatch(norm,/\b(?:INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE|CREATE TRIGGER|CREATE EXTENSION|http_post|net\.http_post)\b/i);
  assert.doesNotMatch(norm,/jwfocqaxlckuxoklwyxs/);
});
