import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQaVerdict } from "../src/services/qaVerdict.ts";

test("approve verdict is accepted", () => {
  const verdict = parseQaVerdict('checking...\nVERDICT_JSON: {"verdict":"approve","reasons":[]}');
  assert.deepEqual(verdict, { approved: true, reasons: [] });
});

test("reject verdict carries its reasons", () => {
  const verdict = parseQaVerdict('{"verdict":"reject","reasons":["GET /todos returns 500","no .env.example"]}');
  assert.equal(verdict.approved, false);
  assert.deepEqual(verdict.reasons, ["GET /todos returns 500", "no .env.example"]);
});

test("terminal color codes around the verdict are ignored", () => {
  const verdict = parseQaVerdict('\x1b[32m{"verdict":"approve","reasons":[]}\x1b[0m');
  assert.equal(verdict.approved, true);
});

test("reasons containing braces still parse", () => {
  const verdict = parseQaVerdict('{"verdict":"reject","reasons":["expected {id} in body, got none"]}');
  assert.equal(verdict.approved, false);
  assert.deepEqual(verdict.reasons, ["expected {id} in body, got none"]);
});

test("prompt placeholder echoed in the log cannot approve", () => {
  const verdict = parseQaVerdict('VERDICT_JSON: {"verdict": <approve or reject>, "reasons": [<strings>]}');
  assert.equal(verdict.approved, false);
  assert.match(verdict.reasons[0], /no valid verdict/);
});

test("the last real verdict wins over an earlier echo", () => {
  const log = 'VERDICT_JSON: {"verdict": <approve or reject>}\n...\n{"verdict":"reject","reasons":["x"]}';
  assert.deepEqual(parseQaVerdict(log), { approved: false, reasons: ["x"] });
});

test("missing or invalid verdict counts as reject", () => {
  assert.equal(parseQaVerdict("agent crashed").approved, false);
  assert.equal(parseQaVerdict('{"verdict":"approve","reasons":[oops]}').approved, false);
});
