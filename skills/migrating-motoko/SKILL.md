---
name: migrating-motoko
description: "Inline actor migration for Motoko canisters using `(with migration = ...)` syntax. Use when upgrading canister state, renaming fields, changing field types, or restructuring actor state without the --enhanced-migration flag. For multi-step migration chains, use migrating-motoko-enhanced instead."
license: Apache-2.0
compatibility: "moc >= 1.2.0"
metadata:
  title: Motoko Inline Migration
  category: Motoko
---

<!-- Upstream: https://github.com/caffeinelabs/motoko
     Tag: 1.7.0  Commit: 1e65e26346b35927869dda044bb76763627c2c57
     File: .agents/skills/migrating-motoko/SKILL.md
     Last synced: 2026-05-04
     Sections owned by icskills (do not overwrite from upstream):
     Additional References (uses icskills skill names: motoko, mops-cli) -->

# Inline Actor Migration

Migrate actor state across canister upgrades using a migration expression attached to the actor. Each upgrade has at most one migration function.

**For multi-step migration with a `migrations/` directory**, load `migrating-motoko-enhanced` instead.

## What This Is

The `(with migration = ...)` syntax lets you transform actor state during an upgrade — rename fields, change types, split or merge values. The migration runs exactly once per upgrade; on fresh install, the actor's initializers run normally.

## When to Use

### Implicit migration (no code needed)

The runtime allows the upgrade if the new program is compatible with the old:

- Adding actor fields
- Removing actor fields
- Changing mutability (`var` ↔ `let`)
- Adding variant constructors
- Widening types (`Nat` → `Int`)

### Explicit migration required

- Renaming fields
- Changing a field's type (e.g. `Bool` → variant, `Int` → `Float`)
- Restructuring state (splitting/merging fields)
- Transforming collection values

## Syntax

Parenthetical expression immediately before the actor:

```motoko
import Migration "migration";

(with migration = Migration.run)
actor {
  var newState : Float = 0.0;
};
```

Or inline:

```motoko
import Int "mo:core/Int";

(with migration = func(old : { var state : Int }) : { var newState : Float } {
  { var newState = old.state.toFloat() }
})
actor {
  var newState : Float = 0.0;
};
```

Or using the shorthand when the imported module exports a `migration` field:

```motoko
import { migration } "migration";

(with migration)
actor { ... };
```

## Migration Function Rules

- Type: `func (old : { ... }) : { ... }` — local, non-generic; both records must use persistable types (no functions or mutable arrays)
- **Domain**: old actor fields (names and types from the previous version)
- **Codomain**: new actor fields (must exist in the new actor with compatible types)
- Runs **only on upgrade** — on fresh install, initializers run normally
- If the migration traps, the upgrade is aborted and the canister stays on the old version

### Field semantics

| Field appears in | Effect |
| ---------------- | ------ |
| Input and output | Field is transformed |
| Output only      | New field produced by migration |
| Input only       | Field consumed (compiler warns about possible data loss) |
| Neither          | Carried through or initialized by declaration |

## Migration Module Pattern

Keep migrations in a separate module. Define old types inline — do not import them from old code paths:

```motoko
// migration.mo
import Types "types";
import Map "mo:core/Map";

module {
  type OldTask = { id : Nat; title : Text; completed : Bool };

  type OldActor = {
    var tasks : Map.Map<Nat, OldTask>;
    var nextId : Nat;
  };

  type NewActor = {
    var tasks : Map.Map<Nat, Types.Task>;
    var nextId : Nat;
  };

  public func run(old : OldActor) : NewActor {
    let tasks = old.tasks.map<Nat, OldTask, Types.Task>(
      func(_, task) {
        {
          id = task.id;
          title = task.title;
          due = 0;
          var status = if (task.completed) #completed else #pending;
        }
      }
    );
    { var tasks; var nextId = old.nextId };
  };
};
```

```motoko
// main.mo
import Map "mo:core/Map";
import Types "types";
import Migration "migration";

(with migration = Migration.run)
actor {
  var tasks = Map.empty<Nat, Types.Task>();
  var nextId : Nat = 0;
};
```

Fields must have initializers — the migration function runs only on **upgrade**. On fresh install the initializers are used.

## Common Patterns

### Add field with default

```motoko
old.users.map<Nat, OldUser, NewUser>(
  func(_, u) { { u with zipCode = "" } }
)
```

### Add optional field

```motoko
{ task with var assignee = null : ?Principal }
```

### Bool to variant

```motoko
var status = if (task.completed) #completed else #pending;
```

### Rename a field

```motoko
func(old : { var state : Int }) : { var value : Int } {
  { var value = old.state }
}
```

### Drop a field

Consume it in the input, omit from output. Compiler warns — ensure the loss is intentional.

## Checklist

- [ ] Decide: implicit (compatible change) or explicit (migration function needed)
- [ ] If explicit: define old types inline in `migration.mo`
- [ ] Migration type: `func (old : RecordIn) : RecordOut` with persistable types
- [ ] Attach with `(with migration = Migration.run)` before the actor
- [ ] Do NOT use `preupgrade`/`postupgrade` for data migration
- [ ] Verify with `mops check --fix` and `mops build`

## Additional References

- Load `motoko` for general Motoko language reference and mo:core APIs
- Load `migrating-motoko-enhanced` for multi-migration with `--enhanced-migration`
- Load `mops-cli` for `mops check`, `mops build`, and toolchain setup
