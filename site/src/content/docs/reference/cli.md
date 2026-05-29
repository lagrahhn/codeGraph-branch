---
title: CLI
description: Every CodeGraph command and the flags it accepts.
---

```bash
codegraph                         # Run interactive installer
codegraph install                 # Run installer (explicit)
codegraph uninstall               # Remove CodeGraph from your agents (inverse of install)
codegraph init [path]             # Initialize in a project (--index to also index)
codegraph uninit [path]           # Remove CodeGraph from a project (--force to skip prompt)
codegraph index [path]            # Full index (--force to re-index, --quiet for less output)
codegraph sync [path]             # Incremental update
codegraph status [path]           # Show statistics
codegraph query <search>          # Search symbols (--kind, --limit, --json)
codegraph files [path]            # Show file structure (--format, --filter, --max-depth, --json)
codegraph context <task>          # Build context for AI (--format, --max-nodes)
codegraph callers <symbol>        # Find what calls a function/method (--limit, --json)
codegraph callees <symbol>        # Find what a function/method calls (--limit, --json)
codegraph impact <symbol>         # Analyze what code is affected by changing a symbol (--depth, --json)
codegraph affected [files...]     # Find test files affected by changes
codegraph serve --mcp             # Start MCP server
codegraph branch                  # Show branch status
codegraph branch switch <name>    # Switch to a branch's cached index
codegraph branch prune <name>     # Remove a branch's cached index
```

## Query commands

`query`, `callers`, `callees`, and `impact` all accept `--json` for machine-readable output.

```bash
codegraph query UserService --kind class --limit 10
codegraph callers handleRequest --json
codegraph impact AuthMiddleware --depth 3
```

## affected

Traces import dependencies transitively to find which test files are affected by changed source files. See [Affected Tests in CI](/codegraph/guides/affected-tests/) for options and a CI example.

## branch

Manages per-branch index databases. Each git branch gets its own SQLite database under `.codegraph/branches/`, allowing instant branch switching without re-indexing.

```bash
codegraph branch                  # Show branch status
codegraph branch switch <name>    # Switch to a branch's cached index
codegraph branch prune <name>     # Remove a branch's cached index
codegraph branch prune --all      # Remove all non-active branch indexes
```

**How it works:**

- When you run `codegraph init` or `codegraph open`, CodeGraph automatically detects your current git branch
- If a cached index exists for that branch, it's loaded instantly
- If not, a new index is created (or migrated from the legacy single-database format)
- Branch indexes are stored in `.codegraph/branches/<sanitized-branch-name>/`

**Options:**

| Option | Description |
|--------|-------------|
| `-a, --all` | With `prune`: remove all non-active branches |
| `-y, --yes` | Skip confirmation prompts |
| `-j, --json` | Output as JSON |

**Examples:**

```bash
# Check which branches have cached indexes
codegraph branch

# Switch to main branch's index (creates if not cached)
codegraph branch switch main

# Remove a specific branch's cached index
codegraph branch prune feature-old --yes

# Remove all non-active branch indexes
codegraph branch prune --all --yes
```
