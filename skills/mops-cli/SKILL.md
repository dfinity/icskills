---
name: mops-cli
description: "Manage Motoko projects with the mops CLI — toolchain pinning, dependency management, type-checking, building, and linting. Use when working with mops.toml, mops.lock, running mops commands, adding/removing packages, pinning moc or lintoko versions, checking or building canisters, configuring moc flags, or setting up a new Motoko project."
license: Apache-2.0
compatibility: "mops >= 2.13.0"
metadata:
  title: Mops CLI
  category: Infrastructure
---

<!-- Upstream: https://github.com/caffeinelabs/mops
     Tag: cli-v2.13.2  Commit: 59d4c5f264ec4276bbe03d3df2d81fe3cd0e6352
     File: .agents/skills/mops-cli/SKILL.md
     Last synced: 2026-05-28
     Sections owned by icskills (do not overwrite from upstream):
     What This Is,
     Prerequisites,
     Common Pitfalls,
     Additional References (uses icskills skill names: motoko, migrating-motoko, migrating-motoko-enhanced) -->

# Mops CLI

## What This Is

Mops is the primary package manager and build toolchain for Motoko projects. It handles compiler version pinning, Motoko package dependencies, type-checking, building, linting, and migration management — all configured through `mops.toml`. Install with `npm i -g ic-mops`.

## Prerequisites

- `ic-mops` installed globally: `npm i -g ic-mops`
- `mops.toml` at the project root (created by `mops init -y`)

## Key Principles

1. **No dfx** — always pin `moc` in `[toolchain]`. The `@dfinity/motoko` recipe in icp-cli resolves the compiler from this field. Without a pinned `moc`, `icp build` fails.
2. **No `mo:base`** — it is deprecated. Always use `mo:core` (`import Array "mo:core/Array"`).
3. **All config in `mops.toml`** — canisters, moc flags, toolchain versions, build settings.
4. **Canister-centric workflow** — define all canisters in `[canisters]`; never pass file paths to `mops check`. Exception: library packages (no `[canisters]`) use file paths: `mops check src/**/*.mo`.

## Project Setup

### Minimal `mops.toml`

```toml
[toolchain]
moc = "1.7.0"
lintoko = "0.10.0"

[dependencies]
core = "2.5.0"

[moc]
args = ["--default-persistent-actors", "-W=M0223,M0236,M0237"]

[canisters.backend]
main = "src/backend/main.mo"

[build]
outputDir = "src/backend/dist"
args = ["--release"]
```

### Warning Flags

`-W=M0223,M0236,M0237` enables optional warnings as errors: redundant type instantiation (M0223), suggest contextual dot notation (M0236), suggest redundant explicit arguments (M0237).

### Moc Args Layering

Flags are applied in this order (later overrides earlier):

1. `[moc].args` — global, all commands (check, build, test, etc.)
2. `[build].args` — build only (e.g., `--release`)
3. `[canisters.<name>.migrations]` — auto-injected `--enhanced-migration` (managed by mops)
4. `[canisters.<name>].args` — per-canister
5. CLI `-- <flags>` — one-off overrides

## Core Commands

### `mops install`

```bash
mops install
```

Run after cloning or after manual `mops.toml` edits. Updates `mops.lock`. In CI, uses `--lock check` by default (fails if lockfile is stale).

### `mops add <package>`

```bash
mops add core             # latest version
mops add core@2.5.0       # specific version
mops add --dev test       # dev dependency
```

### `mops check`

Primary correctness command — runs moc check, then check-stable (if configured), then lint (if lintoko is in toolchain).

```bash
mops check                # all canisters
mops check backend        # single canister by name
mops check --fix          # autofix + check + stable + lint
mops check --verbose      # show moc invocations
mops check -- -Werror     # treat warnings as errors
```

**Always use canister names, not file paths.** Per-canister args from `mops.toml` are applied automatically.

### `mops build`

```bash
mops build                # all canisters
mops build backend        # single canister
mops build --verbose      # show compiler commands
mops build -- --ai-errors # pass extra moc flags
```

Produces `.wasm`, `.did`, and `.most` files in `[build].outputDir` (default `.mops/.build`).

**Note:** The integration between icp-cli and mops for generating `.did` files and injecting canister environment variables is still being refined. If your icp-cli build recipe needs a `.did` at a predictable path, generate it once, commit it, and specify `candid` in your recipe configuration.

### `mops toolchain`

```bash
mops toolchain use moc 1.7.0         # pin specific version
mops toolchain use moc latest        # pin latest (non-interactive)
mops toolchain use lintoko 0.10.0    # pin lintoko version
mops toolchain update moc            # update to latest (requires existing entry)
mops toolchain update                # update all tools
mops toolchain bin moc               # print path to binary
```

**Agent note:** `toolchain use <tool>` without a version opens an interactive picker — never use in scripts. Always pass a version or `latest`. `toolchain update` only works when the tool already has a `[toolchain]` entry.

### `mops remove <package>`

```bash
mops remove base
```

### Dependency Management

```bash
mops outdated             # list outdated dependencies
mops update               # update all within caret bound
mops update core          # update specific package
mops update --major       # allow major-version updates
mops sync                 # add missing / remove unused packages
```

### Enhanced migrations

When `[canisters.<name>.migrations]` is configured, `mops check`, `mops build`, and `mops check-stable` automatically inject `--enhanced-migration`. Do not add `--enhanced-migration` to `[canisters.<name>].args` — mops will error.

Create migration files directly in the `chain` directory.

`check-limit` (optional) caps how many recent chain files `mops check` and `mops lint` consider — useful when the chain grows long and re-checking every old migration slows feedback down. `mops build` is unaffected by `check-limit`. When the limit kicks in, mops stages the included files into `.migrations-<canister>/` next to the `chain` directory (auto-`.gitignore`d). `moc` diagnostics may then print paths there — the real file lives in the `chain` directory with the same name.

### `check-stable` configuration

Add to a canister to verify stable variable compatibility against a `.most` snapshot from the deployed version:

```toml
[canisters.backend.check-stable]
path = ".old/src/backend/dist/backend.most"
```

For a new project with no prior deployment, create a trivial `.most` file:

```most
// Version: 1.0.0
actor {
  
};
```

## Other Commands

### `mops test`

Tests live in `test/*.test.mo`:

```bash
mops test                         # run all tests
mops test my-test                 # filter by name
mops test --mode wasi             # use wasmtime (for to_candid/from_candid)
mops test --reporter verbose      # show Debug.print output
mops test --watch                 # re-run on file changes
```

### `mops lint` and `mops format`

```bash
mops lint                 # lint all .mo files
mops lint --fix           # autofix lint issues
mops format               # format all .mo files
mops format --check       # check formatting without modifying
```

## Common Pitfalls

1. **Passing file paths to `mops check` for canister projects.** Always use canister names (`mops check backend`), not file paths (`mops check src/backend/main.mo`). File paths bypass per-canister `args` in `mops.toml` and produce incorrect results.

2. **Using `mops toolchain use <tool>` without a version in scripts.** This opens an interactive version picker and hangs in CI or agent contexts. Always pass an explicit version: `mops toolchain use moc 1.7.0` or `mops toolchain use moc latest`.

3. **Adding `--enhanced-migration` manually when using `[canisters.<name>.migrations]`.** Mops auto-injects this flag. Adding it yourself causes a mops error. Remove it from `[canisters.<name>].args`.

4. **Importing from `mo:base` instead of `mo:core`.** `mo:base` is deprecated. Use `mo:core`: `import Array "mo:core/Array"`, `import Map "mo:core/Map"`, etc.

5. **Not pinning `moc` in `[toolchain]`.** Without a pinned version, the `@dfinity/motoko` icp-cli recipe fails. Always include `moc = "<version>"` in `[toolchain]`.

6. **Using `mops toolchain update` without an existing entry.** `toolchain update` only updates tools that already have a `[toolchain]` entry. For new tools, use `mops toolchain use <tool> <version>` first.

## New Project Setup

```bash
mops init -y
mops toolchain use moc latest        # pin latest moc (non-interactive)
mops toolchain use lintoko latest    # pin latest lintoko
mops add core
```

Then configure `[moc].args`, `[canisters]`, and `[build]` in `mops.toml`. To update tools later: `mops toolchain update moc` or `mops toolchain update` (all tools).

### Warning suppression per canister

Use per-canister `args` (not global) for suppressions:

```toml
[canisters.backend]
main = "src/backend/main.mo"
args = ["-A=M0198"]
```

## Additional References

- Load `motoko` for Motoko language reference and mo:core APIs
- Load `migrating-motoko` for inline migration with `(with migration = ...)`
- Load `migrating-motoko-enhanced` for enhanced multi-step migration with a `migrations/` directory
