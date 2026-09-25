# feature-flag-formatter

Every team I've worked on ends up with feature flags defined in three
different styles at once: an `.env` file using `SCREAMING_SNAKE_CASE`,
a config someone hand-wrote in `camelCase`, and a list pasted into a
Slack thread with `yes`/`no` instead of booleans. None of it agrees,
and scripts that read these flags end up full of one-off string
matching to cope.

This tool takes that mess as input and produces one canonical,
sorted list: kebab-case keys, real booleans/numbers/strings instead
of loose text, duplicates called out instead of silently
overwritten. It reads from a file or stdin and writes either a
human-readable table or JSON, so it works equally well as something
you glance at and something another program consumes.

## Example

Input (`flags.txt`):

```
ENABLE_NEW_CHECKOUT=true
dark-mode: 1
BetaSearch no
rollout_percentage=42
ENABLE_NEW_CHECKOUT=false
```

Human output:

```
$ flag-format flags.txt
FLAG                  VALUE
beta-search           false (boolean)
dark-mode             true (boolean)
enable-new-checkout   false (boolean)
rollout-percentage    42 (number)

1 warning(s):
  - line 5: duplicate flag "enable-new-checkout" (first seen on line 1), keeping the later value
```

JSON output, for piping into other tooling:

```
$ flag-format flags.txt --json
{
  "flags": [
    { "key": "beta-search", "value": false, "type": "boolean" },
    { "key": "dark-mode", "value": true, "type": "boolean" },
    { "key": "enable-new-checkout", "value": false, "type": "boolean" },
    { "key": "rollout-percentage", "value": 42, "type": "number" }
  ],
  "warnings": [
    "line 5: duplicate flag \"enable-new-checkout\" (first seen on line 1), keeping the later value"
  ]
}
```

It also reads stdin, so it drops into a pipeline:

```
$ cat flags.txt | flag-format --json | jq '.flags[].key'
```

## Using it as a library

```ts
import { normalizeFlags } from "./src/normalize.js";
import { formatJson } from "./src/format.js";

const result = normalizeFlags(rawConfigText);
console.log(formatJson(result));
```

`normalizeFlags` never throws on malformed input; unparsable lines
are collected in `result.warnings` instead, so a bad line in a large
config doesn't take down the whole run.

## Recognized value words

- true: `true`, `1`, `yes`, `y`, `on`, `enabled`
- false: `false`, `0`, `no`, `n`, `off`, `disabled`
- anything matching `-?\d+(\.\d+)?` becomes a number
- everything else is kept as a string, with surrounding quotes stripped

## Running it

No dependencies to install. Either compile with `tsc` (needs a
TypeScript install on your machine, e.g. `npm i -g typescript`):

```
tsc
node dist/cli.js flags.txt
```

or, on Node 22.6+, run the source directly:

```
node --experimental-strip-types src/cli.ts flags.txt
```

## Status

Early skeleton. Parsing covers the common `key=value`, `key: value`,
and `key value` shapes; see the roadmap in the project notes for what
is still missing (YAML/JSON input, a `--strict` mode that errors
instead of warns, config file support for custom value words).
