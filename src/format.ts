import type { NormalizeResult } from "./normalize.js";

export function formatHuman(result: NormalizeResult): string {
  const { flags, warnings } = result;
  const lines: string[] = [];

  if (flags.length === 0) {
    lines.push("no flags found");
  } else {
    const keyWidth = Math.max(4, ...flags.map((f) => f.key.length));
    lines.push(`${"FLAG".padEnd(keyWidth)}  VALUE`);
    for (const flag of flags) {
      lines.push(`${flag.key.padEnd(keyWidth)}  ${String(flag.value)} (${flag.type})`);
    }
  }

  if (warnings.length > 0) {
    lines.push("");
    lines.push(`${warnings.length} warning(s):`);
    for (const warning of warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  return lines.join("\n");
}

export function formatJson(result: NormalizeResult): string {
  const payload = {
    flags: result.flags.map((f) => ({ key: f.key, value: f.value, type: f.type })),
    warnings: result.warnings,
  };
  return JSON.stringify(payload, null, 2);
}
