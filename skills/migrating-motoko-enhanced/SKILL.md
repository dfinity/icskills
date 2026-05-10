---
name: migrating-motoko-enhanced
description: "Enhanced multi-step migration for Motoko actors using a migrations/ directory and --enhanced-migration flag. Use when upgrading canister state across multiple deployments, writing migration files, changing actor field types, or managing a migration chain. For a single one-shot migration, use migrating-motoko instead."
license: Apache-2.0
compatibility: "moc >= 1.2.0"
metadata:
  title: Motoko Enhanced Migration
  category: Motoko
---

<!-- Upstream: https://github.com/caffeinelabs/motoko
     Tag: 1.7.0  Commit: 1e65e26346b35927869dda044bb76763627c2c57
     File: .agents/skills/migrating-motoko-enhanced/SKILL.md
     Last synced: 2026-05-04
     Sections owned by icskills (do not overwrite from upstream):
     mops.toml Setup (removed redundant --enhanced-migration from [canisters.backend].args — upstream had a bug),
     Additional References (uses icskills skill names: motoko, migrating-motoko, mops-cli) -->

# Enhanced Multi-Migration

Manage canister state evolution through a chain of migration modules. Each migration captures one logical change (add, rename, drop, transform a field) and the compiler verifies the entire chain is consistent.

## What This Is

The `--enhanced-migration` flag enables a `migrations/` directory where each file is one upgrade step. The compiler type-checks the full chain on every `mops check`, ensuring state transformations are coherent. Use `mops migrate new` / `mops migrate freeze` to manage the chain — see the `mops-cli` skill for those commands.

## When to Use

- Adding, removing, or renaming persistent actor fields across multiple deployments
- Changing a field's type
- Restructuring state with a verifiable audit trail
- Project already uses mops with `[canisters.<name>.migrations]` configured

## Critical Rules

- **Never use** `stable` keyword, `preupgrade`/`postupgrade`, or inline `(with migration = ...)`
- Actor variables are declared **without initializers** — values come from the migration chain
- The actor body must be **static** (no top-level side effects except `<system>` calls like timers)
- Each migration file exports `public func migration({...}) : {...}`
- Files are applied in **lexicographic order** — use timestamp prefixes

## mops.toml Setup

```toml
[toolchain]
moc = "1.7.0"

[dependencies]
core = "2.3.1"

[moc]
args = ["--default-persistent-actors", "-W=M0223,M0236,M0237"]

[canisters.backend]
main = "src/backend/main.mo"

[canisters.backend.migrations]
chain = "src/backend/migrations"
next = "src/backend/next-migration"
check-limit = 1
build-limit = 100
```

Do NOT add `--enhanced-migration` to `[moc].args` — it must be per-canister. When `[canisters.<name>.migrations]` is configured, mops injects `--enhanced-migration` automatically; do not duplicate it in `[canisters.<name>].args`.

## Directory Layout

```
backend/
├── main.mo
├── types.mo
├── lib/
├── mixins/
└── migrations/
    ├── 20250101_000000_Init.mo
    ├── 20250315_120000_AddProfile.mo
    └── 20250601_090000_RenameField.mo
```

## Actor Syntax

With enhanced migration, actor variables have **no initializers** — values come from the chain:

```motoko
actor {
  var name : Text;       // value comes from migration chain
  var balance : Nat;     // likewise
  let frozen : Bool;     // let bindings can also be uninitialized
};
```

## Migration Module Structure

Each migration module takes a record of input fields and returns a record of output fields:

```motoko
// migrations/20250101_000000_Init.mo
module {
  public func migration(_ : {}) : { name : Text; balance : Nat } {
    { name = ""; balance = 0 }
  }
}
```

## Input / Output Field Semantics

| Field appears in | Effect |
| ---------------- | ------ |
| Input and output | Field is transformed (old value read, new value produced) |
| Output only      | New field added to state |
| Input only       | Field consumed and removed from state |
| Neither          | Field carried through unchanged |

Example: given state `{a : Nat; b : Text; c : Bool}` and migration:

```motoko
module {
  public func migration(old : { a : Nat; b : Text }) : { a : Int; d : Float } {
    { a = old.a; d = 1.0 }
  }
}
```

- `a`: transformed `Nat → Int`
- `b`: consumed (removed)
- `c`: carried through unchanged
- `d`: newly introduced
- Result state: `{a : Int; c : Bool; d : Float}`

## Common Patterns

### Initialize state (first migration, always required)

```motoko
// migrations/20250101_000000_Init.mo
module {
  public func migration(_ : {}) : { count : Nat; header : Text } {
    { count = 0; header = "default" }
  }
}
```

### Add a field

```motoko
// migrations/20250201_000000_AddEmail.mo
module {
  public func migration(_ : {}) : { email : Text } {
    { email = "" }
  }
}
```

### Add an optional field

```motoko
module {
  public func migration(_ : {}) : { assignee : ?Principal } {
    { assignee = null }
  }
}
```

### Change a field's type

```motoko
module {
  public func migration(old : { count : Nat }) : { count : Int } {
    { count = old.count }
  }
}
```

### Rename a field

```motoko
module {
  public func migration(old : { header : Text }) : { title : Text } {
    { title = old.header }
  }
}
```

### Remove a field

```motoko
module {
  public func migration(_ : { email : Text }) : {} {
    {}
  }
}
```

### Transform data (split a field)

```motoko
import Text "mo:core/Text";

module {
  public func migration(old : { name : Text }) : { firstName : Text; lastName : Text } {
    let parts = old.name.split(#char ' ');
    let first = switch (parts.next()) { case (?f) f; case (null) "" };
    let last = switch (parts.next()) { case (?l) l; case (null) "" };
    { firstName = first; lastName = last }
  }
}
```

### Bool to variant

```motoko
module {
  public func migration(old : { var completed : Bool }) : { var status : { #pending; #completed } } {
    { var status = if (old.completed) { #completed } else { #pending } }
  }
}
```

### Map over a collection

```motoko
import Map "mo:core/Map";

module {
  type OldTask = { id : Nat; title : Text; var completed : Bool };
  type NewTask = { id : Nat; title : Text; var status : { #pending; #completed } };

  public func migration(old : { var tasks : Map.Map<Nat, OldTask> })
    : { var tasks : Map.Map<Nat, NewTask> } {
    let tasks = old.tasks.map<Nat, OldTask, NewTask>(
      func(_, task) {
        { id = task.id; title = task.title;
          var status = if (task.completed) { #completed } else { #pending } }
      }
    );
    { var tasks }
  }
}
```

## How Migrations Compose

The compiler verifies each migration's input is compatible with the state produced by all preceding migrations.

| Migration     | Input            | Output                           | Effect                      |
| ------------- | ---------------- | -------------------------------- | --------------------------- |
| `Init`        | `{}`             | `{name : Text; balance : Nat}`   | Initializes both fields     |
| `AddProfile`  | `{}`             | `{profile : Text}`               | Adds a new field            |
| `RenameField` | `{name : Text}`  | `{displayName : Text}`           | Renames name → displayName  |

After the full chain: `{displayName : Text; balance : Nat; profile : Text}`. The actor must declare fields compatible with this final state.

## Runtime Behavior

- **Fresh deploy**: all migrations run in order
- **Upgrade**: only not-yet-applied migrations run
- **Fast-forward**: safe to skip intermediate deployments — all unapplied migrations run sequentially
- If a migration traps, the upgrade is aborted and the canister stays on the old version

## Workflow with mops

```bash
mops migrate new AddEmail         # create next migration file
# edit the new migration file
mops check --fix                  # verify chain consistency
mops build                        # compile
# deploy
mops migrate freeze               # move to permanent chain after successful deploy
```

See the `mops-cli` skill for full `mops migrate` command reference.

## Restrictions

- Cannot combine `--enhanced-migration` with inline `(with migration = ...)`
- Actor variables must not have initializers
- Actor body must be static (no top-level side effects except `<system>` calls)
- Final migration chain output must match the actor's declared fields

## Checklist

- [ ] `migrations/` directory exists next to actor source
- [ ] First migration initializes all fields (empty input `{}`)
- [ ] Files named with timestamp prefixes for correct ordering
- [ ] Each file exports `public func migration({...}) : {...}`
- [ ] Actor variables declared **without** initializers
- [ ] `[canisters.<name>.migrations]` configured in `mops.toml` (mops injects `--enhanced-migration`)
- [ ] Run `mops check --fix` to verify chain consistency
- [ ] Run `mops build` to compile

## Additional References

- Load `motoko` for general Motoko language reference and mo:core APIs
- Load `migrating-motoko` for inline migration without `--enhanced-migration`
- Load `mops-cli` for `mops migrate new`, `mops migrate freeze`, and toolchain setup
