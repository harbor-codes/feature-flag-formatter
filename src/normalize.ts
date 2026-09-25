export type FlagValue = boolean | number | string;
export type FlagType = "boolean" | "number" | "string";

export interface NormalizedFlag {
  key: string;
  value: FlagValue;
  type: FlagType;
  sourceLine: number;
  sourceKey: string;
  sourceValue: string;
}

export interface NormalizeResult {
  flags: NormalizedFlag[];
  warnings: string[];
}

const TRUE_WORDS = new Set(["true", "1", "yes", "y", "on", "enabled"]);
const FALSE_WORDS = new Set(["false", "0", "no", "n", "off", "disabled"]);
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

// Handles PascalCase/camelCase, snake_case, kebab-case, and shouting
// SCREAMING_CASE, since all four show up across the config files and
// Slack pastes that feed this tool.
function toKebabCase(input: string): string {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function splitKeyValue(line: string): [string, string] | null {
  const separatorIndex = line.search(/[:=]/);
  if (separatorIndex !== -1) {
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    return key && value ? [key, value] : null;
  }

  // Fall back to "key value" for lines with no explicit separator.
  const spaceIndex = line.search(/\s/);
  if (spaceIndex !== -1) {
    const key = line.slice(0, spaceIndex).trim();
    const value = line.slice(spaceIndex + 1).trim();
    return key && value ? [key, value] : null;
  }

  return null;
}

function normalizeValue(raw: string): { value: FlagValue; type: FlagType } {
  let value = raw.trim();
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  if (quoted && value.length >= 2) {
    value = value.slice(1, -1);
  }

  const lower = value.toLowerCase();
  if (TRUE_WORDS.has(lower)) return { value: true, type: "boolean" };
  if (FALSE_WORDS.has(lower)) return { value: false, type: "boolean" };
  if (NUMBER_PATTERN.test(value)) return { value: Number(value), type: "number" };
  return { value, type: "string" };
}

function stripComment(line: string): string {
  return line.replace(/\s+#.*$/, "").replace(/\s+\/\/.*$/, "").trim();
}

/**
 * Turns a loose block of "flag = value" style lines into a sorted,
 * de-duplicated list of flags with canonical keys and typed values.
 */
export function normalizeFlags(input: string): NormalizeResult {
  const lines = input.split(/\r?\n/);
  const byKey = new Map<string, NormalizedFlag>();
  const warnings: string[] = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      return;
    }

    const uncommented = stripComment(trimmed);
    if (!uncommented) return;

    const parts = splitKeyValue(uncommented);
    if (!parts) {
      warnings.push(`line ${lineNumber}: could not parse "${trimmed}", skipped`);
      return;
    }

    const [sourceKey, sourceValue] = parts;
    const key = toKebabCase(sourceKey);
    if (!key) {
      warnings.push(`line ${lineNumber}: empty key after normalizing "${sourceKey}", skipped`);
      return;
    }

    const { value, type } = normalizeValue(sourceValue);

    const previous = byKey.get(key);
    if (previous) {
      warnings.push(
        `line ${lineNumber}: duplicate flag "${key}" (first seen on line ${previous.sourceLine}), keeping the later value`,
      );
    }

    byKey.set(key, { key, value, type, sourceLine: lineNumber, sourceKey, sourceValue });
  });

  const flags = Array.from(byKey.values()).sort((a, b) => a.key.localeCompare(b.key));
  return { flags, warnings };
}
