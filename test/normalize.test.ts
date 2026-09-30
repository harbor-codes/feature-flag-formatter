import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeFlags } from "../src/normalize.ts";

function only(input: string) {
  const { flags, warnings } = normalizeFlags(input);
  assert.equal(flags.length, 1);
  assert.deepEqual(warnings, []);
  return flags[0];
}

test("empty input yields nothing", () => {
  assert.deepEqual(normalizeFlags(""), { flags: [], warnings: [] });
  assert.deepEqual(normalizeFlags("\n  \n\t\n"), { flags: [], warnings: [] });
});

test("accepts =, : and whitespace as separators", () => {
  assert.equal(only("a=1").key, "a");
  assert.equal(only("a: yes").value, true);
  assert.equal(only("a\tno").value, false);
  assert.equal(only("  a  =  on  ").value, true);
});

test("splits on the first separator only", () => {
  const flag = only("endpoint=http://host:8080/path");
  assert.equal(flag.value, "http://host:8080/path");
  assert.equal(flag.type, "string");
});

test("converts key casing styles to kebab-case", () => {
  for (const key of ["BetaSearch", "beta_search", "beta-search", "BETA_SEARCH", "betaSearch", "__beta__search__"]) {
    assert.equal(only(`${key}=1`).key, "beta-search", key);
  }
});

test("recognizes every boolean spelling regardless of case", () => {
  for (const word of ["true", "TRUE", "1", "Yes", "y", "ON", "Enabled"]) {
    const flag = only(`f=${word}`);
    assert.equal(flag.value, true, word);
    assert.equal(flag.type, "boolean", word);
  }
  for (const word of ["false", "False", "0", "NO", "n", "off", "DISABLED"]) {
    const flag = only(`f=${word}`);
    assert.equal(flag.value, false, word);
    assert.equal(flag.type, "boolean", word);
  }
});

test("0 and 1 are booleans, other integers are numbers", () => {
  assert.equal(only("f=1").type, "boolean");
  assert.equal(only("f=0").type, "boolean");
  const flag = only("f=2");
  assert.equal(flag.value, 2);
  assert.equal(flag.type, "number");
});

test("parses negative and fractional numbers", () => {
  assert.equal(only("f=-3").value, -3);
  assert.equal(only("f=0.25").value, 0.25);
  assert.equal(only("f=-1.5").value, -1.5);
  assert.equal(only("f=1.0").value, 1);
});

test("leaves malformed numbers as strings", () => {
  for (const text of ["1.", ".5", "1e3", "1,000", "--1", "12abc"]) {
    const flag = only(`f=${text}`);
    assert.equal(flag.type, "string", text);
    assert.equal(flag.value, text, text);
  }
});

test("strips matching surrounding quotes", () => {
  assert.equal(only('f="hello world"').value, "hello world");
  assert.equal(only("f='hello'").value, "hello");
  assert.equal(only("f=\"mismatched'").value, "\"mismatched'");
});

test("quoted words still go through boolean and number detection", () => {
  assert.equal(only('f="yes"').value, true);
  assert.equal(only("f='42'").value, 42);
});

test("keeps the original key and value text", () => {
  const flag = only("Dark_Mode = Yes");
  assert.equal(flag.sourceKey, "Dark_Mode");
  assert.equal(flag.sourceValue, "Yes");
  assert.equal(flag.sourceLine, 1);
});

test("skips full-line comments", () => {
  const { flags, warnings } = normalizeFlags("# note\n// another\na=1\n");
  assert.equal(flags.length, 1);
  assert.deepEqual(warnings, []);
});

test("strips trailing comments preceded by whitespace", () => {
  assert.equal(only("a=on # because").value, true);
  assert.equal(only("a=5 // ticket").value, 5);
});

test("does not treat # or // inside a value as a comment", () => {
  assert.equal(only("color=#fff").value, "#fff");
  assert.equal(only("url=http://example.test").value, "http://example.test");
});

test("handles CRLF line endings", () => {
  const { flags, warnings } = normalizeFlags("a=1\r\nb=no\r\n");
  assert.deepEqual(flags.map((f) => [f.key, f.value]), [["a", true], ["b", false]]);
  assert.deepEqual(warnings, []);
});

test("warns about lines with no value", () => {
  const { flags, warnings } = normalizeFlags("lonely\nempty=\n  : 3\nok=1");
  assert.deepEqual(flags.map((f) => f.key), ["ok"]);
  assert.equal(warnings.length, 3);
  assert.match(warnings[0], /^line 1: could not parse "lonely"/);
  assert.match(warnings[1], /^line 2: could not parse "empty="/);
  assert.match(warnings[2], /^line 3: could not parse ": 3"/);
});

test("warns when a key normalizes to nothing", () => {
  const { flags, warnings } = normalizeFlags("---=1\n__: 2");
  assert.deepEqual(flags, []);
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /^line 1: empty key after normalizing "---"/);
  assert.match(warnings[1], /^line 2: empty key after normalizing "__"/);
});

test("duplicates keep the later value and report the first line", () => {
  const { flags, warnings } = normalizeFlags("A_B=true\nother=1\na-b=false");
  const ab = flags.find((f) => f.key === "a-b");
  assert.equal(ab?.value, false);
  assert.equal(ab?.sourceLine, 3);
  assert.deepEqual(warnings, [
    'line 3: duplicate flag "a-b" (first seen on line 1), keeping the later value',
  ]);
});

test("a third duplicate points at the previous occurrence", () => {
  const { warnings } = normalizeFlags("x=1\nx=2\nx=3");
  assert.equal(warnings.length, 2);
  assert.match(warnings[1], /first seen on line 2/);
});

test("output is sorted by canonical key", () => {
  const { flags } = normalizeFlags("zeta=1\nAlpha=1\nmid_flag=1");
  assert.deepEqual(flags.map((f) => f.key), ["alpha", "mid-flag", "zeta"]);
});
