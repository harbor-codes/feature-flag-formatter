#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { normalizeFlags } from "./normalize.js";
import { formatHuman, formatJson } from "./format.js";

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function printHelp(): void {
  console.log(`usage: flag-format [file] [--json]

Normalizes messy feature flag definitions into a canonical form:
kebab-case keys, typed values, sorted output, duplicates flagged.

Reads from FILE if given, otherwise from stdin.

  --json    emit machine-readable JSON instead of the human table
  --help    show this message
`);
}

function main(argv: string[]): void {
  const args = argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const asJson = args.includes("--json");
  const filePath = args.find((arg) => !arg.startsWith("-"));

  const input = filePath ? readFileSync(filePath, "utf8") : readStdin();
  const result = normalizeFlags(input);

  console.log(asJson ? formatJson(result) : formatHuman(result));
}

main(process.argv);
