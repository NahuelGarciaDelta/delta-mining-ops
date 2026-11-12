import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const readApi=readFileSync(new URL("../api/v9-sheets-read.js",import.meta.url),"utf8");
const writeApi=readFileSync(new URL("../api/v9-write.js",import.meta.url),"utf8");

test("Sheets reads use a dedicated bridge URL and never require the write credential",()=>{
 assert.match(readApi,/process\.env\.DELTA_V9_GAS_READ_URL/);
 assert.doesNotMatch(readApi,/process\.env\.DELTA_V9_GAS_WRITE_URL/);
 assert.match(writeApi,/process\.env\.DELTA_V9_GAS_WRITE_URL/);
 assert.doesNotMatch(writeApi,/process\.env\.DELTA_V9_GAS_READ_URL/);
});
