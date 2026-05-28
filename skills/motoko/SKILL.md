---
name: motoko
description: "Motoko language pitfalls, modern syntax, and architecture patterns for the Internet Computer. Covers persistent actors, stable types, mo:core standard library, dot notation, mixins, and common compilation errors. Use when writing Motoko canister code, fixing Motoko compiler errors, or generating Motoko actors. Do NOT use for deployment, icp.yaml, or CLI commands."
license: Apache-2.0
compatibility: "moc >= 1.7.0, core >= 2.5.0"
metadata:
  title: Motoko Language
  category: Motoko
---

<!-- Upstream: https://github.com/caffeinelabs/motoko
     Tag: 1.8.2  Commit: f45204bc75c8e0ed5198fd2fe7265679af71814a
     File: .agents/skills/writing-motoko/SKILL.md
     Last synced: 2026-05-28
     Sections owned by icskills (absent from upstream — do not overwrite):
     Prerequisites, Actors and Persistence, mo:core Standard Library,
     Compilation Pitfalls (upstream calls it "Pitfalls" and lacks IC-specific items),
     Canister Environment Variables, Additional References, references/ -->

# Motoko Language

Motoko is under-represented in training data — always favour this skill and its references over pre-training knowledge.

## Critical Requirements

**NEVER use:**
- `stable` keyword — redundant; produces warning M0218
- `mo:base` library — deprecated; use `mo:core`
- `system func preupgrade/postupgrade` — not needed with enhanced orthogonal persistence
- Module-function style for `self` parameters — don't write `List.add(list, item)` or `Map.get(map, key)`
- Manual field-by-field record copying — use record spread (`{ self with ... }`)
- Single-file monolithic actors — split logic into `lib/` modules and `mixins/`

**ALWAYS use:**
- `mo:core` library 2.0.0+
- `--default-persistent-actors` flag in mops.toml
- Enhanced orthogonal persistence — state persists across upgrades without the `stable` keyword
- Contextual dot notation — `list.add(item)`, `map.get(key)`
- Principled multi-file architecture — `types.mo`, `lib/`, `mixins/`, `main.mo`

**For actor upgrades/migrations:** load `migrating-motoko` for inline migration or `migrating-motoko-enhanced` for multi-migration with `--enhanced-migration`. Under `--enhanced-migration`, actor fields **cannot** have initializers — declare them as `var x : T;` and set initial values in the migration that introduces them.

## Prerequisites

```toml
[toolchain]
moc = "1.7.0"  # pin to latest stable — check github.com/dfinity/motoko/releases

[dependencies]
core = "2.5.0"  # check mops.one/core for latest 2.x

[moc]
args = ["--default-persistent-actors", "-W=M0236,M0237,M0223"]
```

`moc` must be pinned — the build recipe resolves the compiler from this field. Install mops with `npm i -g ic-mops`.

Run `mops check --fix` to auto-correct M0236/M0237/M0223 warnings and report remaining compile errors. See the `mops-cli` skill for the full toolchain workflow.

## Actors and Persistence

With `--default-persistent-actors` in mops.toml (the recommended setup), all actor state persists across upgrades by default:

```motoko
actor {
  let users = Map.empty<Nat, Text>();           // persists across upgrades
  var count : Nat = 0;                          // persists across upgrades
  transient var requestCount : Nat = 0;         // resets to 0 on every upgrade
  transient var timerId : Nat = 0;              // timer must be re-registered after upgrade
  transient let cache = Map.empty<Nat, Text>(); // rebuilt on every upgrade
};
```

Without the flag (dfx, direct `moc` invocation): write `persistent actor { }` — required since moc 0.15.0. Plain `actor` without the flag produces error M0220. The `persistent` keyword is transitional — actors will be persistent by default in a future moc release.

**`transient`** resets a field on every upgrade. Use it for:
- Request counters, rate limiters
- Timer IDs (timers don't survive upgrades and must be re-registered)
- Ephemeral caches, derived lookup tables

**Never write `stable var`** — redundant in persistent actors; produces warning M0218.

## Modern Motoko Features

### Contextual Dot Notation

When a function has a `self` parameter, ALWAYS use dot notation — module-function style triggers warning M0236:

```motoko
// Wrong (M0236)
Map.add(users, Nat.compare, id, name);

// Correct — comparator inferred from key type (M0237)
users.add(id, name);
users.get(id);
caller.toText();
numbers.values().filter(func x = x > 0).map(func x = x * 2).toArray();
```

For custom key types, define a same-named module with `compare` → inferred automatically:
```motoko
type Point = { x : Int; y : Int };
module Point { public func compare(a : Point, b : Point) : Order.Order { ... } };
let points = Map.empty<Point, Text>();
points.add({ x = 1; y = 2 }, "A");  // Point.compare inferred
```

When `.map()` transforms to a different type, provide type parameters (M0098 without):
```motoko
let names = users.map<User, Text>(func(u) { u.name });
```

### Lambda Argument Types

Never annotate lambda argument types — the compiler infers them:
```motoko
pairs.map(func(k, v) { k # ": " # v });          // ✓
pairs.map(func((k, v) : (Text, Text)) : Text {    // ✗ redundant
  k # ": " # v
});
```

### Implicit Parameters

The compiler infers comparison functions automatically. Never pass them explicitly:
```motoko
m.add(1, "hello");                        // ✓
Map.add(m, Nat.compare, 1, "hello");      // ✗
```

### Equality and Comparison

`==` uses compiler-generated structural equality. `equal`/`compare` are used as implicit arguments for `Map`, `Set`, `contains`, etc.

Some modules are dot-callable (have a `self` parameter): `Text`, `Principal`, `Bool`, `Char`, `Blob`.
Others are NOT dot-callable: `Nat`, `Int`, `Float`, sized integers.

```motoko
s1.equal(s2)        // ✓ Text.equal has self
Nat.compare(x, y)   // ✓ Nat.compare has no self
```

### Mixins

Composable actor fragments with state injected as parameters. Mixin parameters are immutable bindings — `var` is NOT valid in parameter syntax:

```motoko
// mixins/Auth.mo
mixin (users : List.List<Types.User>) {
  public shared ({ caller }) func register(name : Text) : async Bool {
    users.add({ id = caller; var name; var isActive = true });
    true
  };
};

// main.mo
import AuthMixin "mixins/Auth";
actor {
  let users = List.empty<Types.User>();
  include AuthMixin(users);
};
```

For scalar mutable state shared between actor and mixin, pass a record with `var` fields. Mutable collections (`List`, `Map`) work directly — their contents are mutable through an immutable binding.

**When to use:** splitting a large actor's public surface into domain files; sharing auth/admin across actors. For stateless utilities, use a plain `lib/` module.

### Record Spread

Use record spread to avoid copying fields one by one:

```motoko
{ self with newField = "" };                                           // ✓
{ id = self.id; text = self.text; completed = self.completed; newField = "" }; // ✗
```

**Caveat**: record spread cannot leave `var` fields un-overridden (M0179). When converting to a different type (e.g. internal → public), you must copy fields explicitly if the source has `var` fields that the target doesn't.

## Module with Self Pattern

Stateless domain logic lives in `lib/` modules. Functions that operate on a value use `self` as the first parameter, enabling dot notation at the call site:

```motoko
// lib/User.mo
module {
  public type User = Types.User;

  public func new(id : Principal, name : Text) : User {
    { id; var name; var isActive = true };
  };

  public func ban(self : User) {
    self.isActive := false;
  };

  public func rename(self : User, newName : Text) {
    self.name := newName;
  };
};

// Usage in main.mo or a mixin:
let user = UserLib.new(caller, "Alice");
user.ban();
user.rename("Bob");
```

Keep lib modules stateless — they receive state through `self` parameters and never hold it directly.

## Architecture Pattern

```
backend/
├── types.mo         # Central schema, public/internal type pairs
├── lib/             # Domain logic (stateless, self pattern)
├── mixins/          # Service layer (state injected via parameters)
├── migrations/      # Enhanced migration files (--enhanced-migration projects)
│   └── <timestamp>_<Name>.mo
└── main.mo          # Composition root (state owner, NO public methods)
```

```motoko
// main.mo
import AuthMixin "mixins/Auth";
actor {
  let users = List.empty<Types.User>();
  var nextId : Nat = 0;
  include AuthMixin(users);
};
```

## Shared Types

Public functions accept/return only **shared types** (serializable over the wire):
- **Shared**: `Nat`, `Int`, `Text`, `Bool`, `Principal`, `Blob`, `Float`, `[T]`, `?T`, immutable records, variants
- **Not shared**: functions, `var` fields, `Map`, `Set`, `List`, `Queue`, `Stack`

Convert internal mutable types to shared types at the API boundary:
```motoko
type UserInternal = { id : Principal; var name : Text; liked : Set.Set<Principal> };
type User = { id : Principal; name : Text; liked : [Principal] };

func toPublic(u : UserInternal) : User {
  { id = u.id; name = u.name; liked = Set.toArray(u.liked) };
};

public query func getUsers() : async [User] {
  users.map<UserInternal, User>(toPublic).toArray()
};
```

## mo:core Standard Library

Always import from `mo:core/`, never `mo:base/` (deprecated):
```motoko
import Map "mo:core/Map";   import Set "mo:core/Set";
import List "mo:core/List"; import Queue "mo:core/Queue";
import Nat "mo:core/Nat";   import Text "mo:core/Text";
import Int "mo:core/Int";   import Iter "mo:core/Iter";
import Option "mo:core/Option"; import Result "mo:core/Result";
import Principal "mo:core/Principal"; import Time "mo:core/Time";
import Debug "mo:core/Debug"; import Runtime "mo:core/Runtime";
```

**Import requirement**: Dot-notation methods only work when the module is imported. `myArray.find(...)` requires `import Array "mo:core/Array"`; iterator chaining requires `import Iter "mo:core/Iter"`; `myBool.toText()` requires `import Bool "mo:core/Bool"`. The error message hints at the missing import (M0072).

Full API signatures: [mops.one/core](https://mops.one/core).

### Collections

| Structure | Use Case         | Key Operations      | Complexity  |
|-----------|------------------|---------------------|-------------|
| Map       | Key-value pairs  | get, add, remove    | O(log n)    |
| List      | Growable array   | add, get, at        | O(1) access |
| Queue     | FIFO processing  | pushBack, popFront  | O(1)        |
| Stack     | LIFO processing  | push, pop           | O(1)        |
| Array     | Fixed collection | index, map, filter  | O(1) access |
| Set       | Unique values    | contains, add       | O(log n)    |

`List.get(n)` returns `?T` (safe, returns null if out of bounds). `List.at(n)` returns `T` and traps on out-of-bounds.

Always declare collection variables with opaque type aliases (`List.List<T>`, `Map.Map<K, V>`) — raw internals lose extension methods (M0072).

### Iteration

Build pipelines with `Iter` and materialize only at the end:
```motoko
self.values().map(toJson).toArray()                // ✓ single allocation
Array.map(List.toArray(self), toJson)              // ✗ two allocations
```

### `contains` vs `find`

- **`contains(element)`** — equality check. Does NOT take a predicate.
- **`find(predicate)`** — predicate search. Returns `?T`.

```motoko
numbers.contains(3);                          // ✓ equality check
users.contains(func(u) { u.isAdmin });        // ✗ M0096 — use find
users.find(func(u) { u.isAdmin }) != null;    // ✓
```

## Option Handling

```motoko
// Trap on unexpected null
let user = switch (users.find(func(u) { u.id == caller })) {
  case (?u) { u };
  case (null) { Runtime.trap("User not found") };
};

// Return ?T when absence is normal
public query func findUserByName(name : Text) : async ?User {
  users.find(func(u) { u.name == name });
};
```

## Security

Every public update function MUST verify the caller via `{caller}` destructuring. Never trust caller-supplied principals for authorization checks.

## Compilation Pitfalls

1. **No `--default-persistent-actors` flag and no `persistent` keyword.** Without the flag in mops.toml, plain `actor` produces M0220. Either add `--default-persistent-actors` to `[moc].args`, or write `persistent actor`.

2. **`stable var` in persistent actors.** `stable var` is redundant and produces warning M0218. Use plain `var` (auto-stable) or `transient var` (resets on upgrade).

3. **Type/let declarations before the actor body.** Only `import` statements may appear before the actor. All `type`, `let`, and `var` must go inside. Produces M0141:
   ```motoko
   // Wrong
   type UserId = Nat;  // ✗ M0141
   actor { };
   // Correct
   actor { type UserId = Nat; };
   ```

4. **Non-stable types.** `HashMap`, `Buffer`, `TrieMap`, `RBTree` from `mo:base` contain closures — not stable. Use `mo:core` replacements: `Map`, `List`, `Set`, `Queue`.

5. **Reassigning `let` bindings.** `let` is immutable. Use `var` for mutable values.

6. **`contains` takes equality, not a predicate.** Passing a predicate to `contains` produces M0096:
   ```motoko
   users.contains(func(u) { u.isAdmin });         // ✗ M0096
   users.find(func(u) { u.isAdmin }) != null;     // ✓
   ```

7. **Mutating a list inside a callback.** Never call `list.add()` inside `filter`/`map` — the iterator is live. Use `mapInPlace` for in-place updates.

8. **Semicolon after function literal in argument position.**
   ```motoko
   list.filter(func(x) { x.active })   // ✓
   list.filter(func(x) { x.active };)  // ✗ unexpected token ';'
   ```

9. **Variant tag argument precedence.** Always parenthesize variant constructor arguments:
   ```motoko
   #transfer 1 + 2   // parsed as (#transfer(1)) + 2 — type error
   #transfer(1 + 2)  // ✓ correct
   ```

10. **`!` outside `do ? { }`.** The null-break operator only works inside a `do ? { }` block (M0064):
    ```motoko
    func getName(m : Map.Map<Nat, Text>, id : Nat) : ?Text {
      do ? { m.get(id)! }
    };
    ```

11. **Incomplete pattern matches.** Switch must cover all cases (M0145). Add missing cases or a wildcard `case _`.

12. **Keywords as identifiers.** Motoko keywords cannot be used as variable or parameter names — produces a parse error. See Reserved Keywords below.

13. **`Text.join` parameter order** — iterator first, separator second:
    ```motoko
    Text.join(["a", "b", "c"].vals(), ", ")  // "a, b, c"
    ```

14. **`List.get` vs `List.at`**: `get(n)` returns `?T` (returns null if out of bounds). `at(n)` returns `T` and traps if out of bounds.

15. **Shared types at API boundaries.** `Map`, `List`, `Set`, `var` fields, and function values cannot cross the canister boundary. Convert to arrays or immutable records before returning from public functions.

16. **Import path conventions.** Paths are relative to the importing file; no `.mo` extension:
    ```motoko
    import Types "types";      // ✓ from main.mo
    import Types "../types";   // ✓ from lib/User.mo
    import Types "types.mo";   // ✗ M0009
    import Map "mo:core/Map";  // ✓ always absolute for packages
    ```

## Reserved Keywords

Reserved by the Motoko grammar — **cannot** be used as identifiers; using one produces a parse error (e.g. `unexpected token 'label'`). Rename to a non-reserved word (`myLabel`, `myFunc`, `kind` instead of `type`, etc.).

```
actor       and         assert      async       await
break       case        catch       class       composite
continue    debug       debug_show  do          else
false       finally     flexible    for         from_candid
func        if          ignore      implicit    import
in          include     label       let         loop
mixin       module      not         null        object
or          persistent  private     public      query
return      shared      stable      switch      system
throw       to_candid   transient   true        try
type        var         weak        while       with
```

`async*`, `await*`, and `await?` are also reserved but contain non-identifier characters, so they can't collide with identifiers.

## Common Compile Error Reference

| Error pattern | Cause | Fix |
|---|---|---|
| `this actor or actor class should be declared persistent` (M0220) | No flag, no `persistent` keyword | Add `--default-persistent-actors` to mops.toml or write `persistent actor` |
| `move these declarations into the body` (M0141) | Type/let before actor | Move inside actor body |
| `redundant stable keyword` (M0218) | `stable var` in persistent actor | Use plain `var` |
| `field put does not exist` | `Map.put` renamed | `.add()` |
| `field append does not exist` | `Array.append` removed | `.concat()` |
| `field delete is deprecated` | `Map.delete` renamed | `.remove()` |
| `Int cannot produce expected type Nat` | Int/Nat mismatch | `Int.abs(intValue)` |
| `syntax error, unexpected token '.'` | Missing parens in variant | `#tag(expr)` |
| `syntax error, unexpected token ','` | Missing parens in for | `for ((key, value) in ...)` |
| `syntax error, unexpected token ';'` in call | Semicolon after func literal | Remove `;` before `)` |
| `shared function has non-shared parameter/return type` | Mutable/function type in API | Return `[T]` not `List<T>`, no `var` fields |
| `send capability required` | Missing `<system>` capability | Add `<system>` |
| `misplaced '!'` (M0064) | `!` outside `do ? { }` | Wrap in `do ? { ... }` |
| `pattern does not cover value` (M0145) | Incomplete switch | Add missing cases or `case _` |
| `field compare does not exist` on Time | No `Time.compare` | Use `Int.compare` |
| `Compatibility error [M0170]` | Incompatible state change on upgrade | Load `migrating-motoko` or `migrating-motoko-enhanced` skill |
| `unbound variable X` | Missing import | `import X "mo:core/X"` |
| `M0098` no best choice for type param | Generic needs explicit types | `list.map<In, Out>(...)` |
| `M0096` on `contains` callback | Predicate passed to contains | `find(pred) != null` |
| `M0009` import file does not exist | Wrong import path | Relative path, no `.mo` extension |
| `M0072` field X does not exist | Missing mo:core import | `import X "mo:core/X"` |
| `unexpected token 'X'` where X is a keyword | Keyword used as identifier | Rename — see Reserved Keywords |

## Quick Reference

**Basic Types:** `Nat` `Int` `Text` `Bool` `Principal` `?T` `[T]` `[var T]` `Blob` `Float` — `Time.now()` returns `Int` (nanoseconds)

**Common Operations:** `debug_show(value)` → Text | `assert condition` | `# "text"` concatenation | `break` / `continue` in loops

## Canister Environment Variables

```motoko
// Available in mo:core >= 2.1.0; injected by icp deploy
let ?backendId = Runtime.envVar("PUBLIC_CANISTER_ID:backend")
  else Debug.trap("PUBLIC_CANISTER_ID:backend not set");
```

## Best Practices

1. Always `mo:core`, never `mo:base`
2. No `stable` keyword — enhanced orthogonal persistence handles state
3. No single-file monolithic actors — split into `types.mo`, `lib/`, `mixins/`, `main.mo`
4. Dot notation for all `self`-parameter functions
5. Never annotate lambda argument types — compiler infers them
6. Never pass implicit comparison arguments explicitly
7. Unwrap with `switch` + `Runtime.trap()` on unexpected null; return `?T` when absence is expected
8. Mixins for the public API surface; plain `lib/` modules for stateless domain logic
9. `public query func` for read-only, `public func` with `async` for state changes
10. Iterator chaining to avoid intermediate collections
11. Record spread `{ self with ... }` instead of copying fields manually

## Additional References

- **API signatures**: [mops.one/core](https://mops.one/core) — live mo:core function signatures (authoritative)
- **Working examples**: [references/examples.md](references/examples.md) — full actors, multi-file architecture, todo app, timers
- **Control flow**: [references/control-flow.md](references/control-flow.md) — switch, for loops, break/continue
- **Type conversions**: [references/type-conversions.md](references/type-conversions.md) — Nat/Int size conversions
