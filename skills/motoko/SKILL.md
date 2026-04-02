---
name: motoko
description: "Motoko language pitfalls and modern syntax for the Internet Computer. Covers persistent actor requirements, stable types, mo:core standard library, type system rules, and common compilation errors. Use when writing Motoko canister code, fixing Motoko compiler errors, or generating Motoko actors. Do NOT use for deployment, icp.yaml config, or CLI commands — use icp-cli instead. Do NOT use for upgrade persistence patterns — use stable-memory instead."
license: Apache-2.0
compatibility: "moc >= 1.0.0, mops with core >= 2.0.0"
metadata:
  title: Motoko Language
  category: Architecture
---

# Motoko Language

## What This Is

Motoko is the native programming language for Internet Computer canisters. It has actor-based concurrency, built-in persistence (orthogonal persistence), and a type system designed for safe canister upgrades. This skill covers the syntax and type system pitfalls that cause compilation errors or runtime traps when generating Motoko code.

## Prerequisites

mops.toml at the project root:
```toml
[toolchain]
moc = "1.3.0"

[dependencies]
core = "2.3.1"
```

`moc` must be pinned — the `@dfinity/motoko` recipe resolves the compiler from this field. Without it, `icp build` fails. Install the package manager with `npm i -g ic-mops`.

## Compilation Error Pitfalls

1. **Writing `actor` instead of `persistent actor`.** Since moc 0.15.0, the `persistent` keyword is mandatory on all actors and actor classes. Plain `actor` produces error M0220.
   ```motoko
   // Wrong — error M0220: this actor or actor class should be declared `persistent`
   actor {
     var count : Nat = 0;
   };

   // Correct
   persistent actor {
     var count : Nat = 0;
   };

   // Actor classes also require it
   persistent actor class Counter(init : Nat) {
     var count : Nat = init;
   };
   ```
   **Migrating from Caffeine:** The Caffeine platform used a moc fork with `--default-persistent-actors`, making `persistent` optional and all variables implicitly stable. On standard moc, add `persistent` to every actor and use `transient var` for variables that should reset on upgrade (see pitfall #3).

2. **Putting type declarations before the actor.** Only `import` statements are allowed before `persistent actor`. All type definitions, `let`, and `var` declarations must go inside the actor body. Violation produces error M0141.
   ```motoko
   // Wrong — error M0141: move these declarations into the body of the main actor or actor class
   import Nat "mo:core/Nat";
   type UserId = Nat;
   let MAX = 100;
   persistent actor { };

   // Correct
   import Nat "mo:core/Nat";
   persistent actor {
     type UserId = Nat;
     let MAX = 100;
   };
   ```

3. **Using `stable` keyword in persistent actors.** In `persistent actor`, all `let` and `var` declarations are stable by default. Writing `stable var` is redundant and produces warning M0218. Use `transient var` for data that should reset on upgrade.
   ```motoko
   persistent actor {
     // Wrong — warning M0218: redundant `stable` keyword
     stable var count : Nat = 0;

     // Correct — implicitly stable
     var count : Nat = 0;

     // Correct — resets to 0 on every upgrade
     transient var requestCount : Nat = 0;
   };
   ```
   The old keyword `flexible` was renamed to `transient` in moc 0.13.5. Never use `flexible`.

4. **Using HashMap, Buffer, TrieMap, or RBTree in persistent actors.** These types from the old `base` library contain closures and are NOT stable. Using them in a `persistent actor` produces error M0131. They do not exist in `mo:core` — the modern standard library has stable replacements.
   ```motoko
   // Wrong — these types do not exist in mo:core and are not stable
   import HashMap "mo:base/HashMap";
   import Buffer "mo:base/Buffer";

   // Correct — use mo:core stable collections
   import Map "mo:core/Map";     // key-value map (B-tree, stable)
   import Set "mo:core/Set";     // set (B-tree, stable)
   import List "mo:core/List";   // growable list (stable)
   import Queue "mo:core/Queue"; // FIFO queue (stable)
   ```

5. **Reassigning `let` bindings.** `let` is immutable in Motoko — there is no reassignment. Use `var` for mutable values.
   ```motoko
   // Wrong — cannot assign to immutable let binding
   let count = 0;
   count := 1;

   // Correct
   var count = 0;
   count := 1;

   // Also correct — let is fine for collections (they mutate internally)
   let users = Map.empty<Nat, Text>();
   Map.add(users, Nat.compare, 0, "Alice"); // mutates the map in place
   ```

6. **Using `continue` or `break` without labels (moc < 1.2.0).** Unlabeled `break` and `continue` in loops require moc >= 1.2.0. For older compilers, or when targeting an outer loop, use labeled loops.
   ```motoko
   // Works since moc 1.2.0
   for (x in items.vals()) {
     if (x == 0) continue;
   };

   // Required for moc < 1.2.0, or to target a specific loop
   label outer for (x in items.vals()) {
     label inner for (y in other.vals()) {
       if (y == 0) continue inner;
       if (x == y) break outer;
     };
   };
   ```

7. **Shared function parameter types must be shared.** All parameters and return types of `public` actor functions must be shared types. Closures, mutable records, `Error`, and `async*` are NOT shared types. Error codes: M0031, M0032, M0033.
   ```motoko
   // Wrong — functions are not shared types
   public func register(callback : () -> ()) : async () { };

   // Wrong — mutable records are not shared types
   public func store(data : { var count : Nat }) : async () { };

   // Correct — use immutable records and avoid closures
   public func store(data : { count : Nat }) : async () { };
   ```

8. **Incomplete pattern matches.** Switch expressions must cover all possible values. Missing cases produce error M0145.
   ```motoko
   type Color = { #red; #green; #blue };

   // Wrong — error M0145: pattern does not cover value #blue
   func name(c : Color) : Text {
     switch (c) {
       case (#red) "Red";
       case (#green) "Green";
     }
   };

   // Correct — cover all cases (or use a wildcard)
   func name(c : Color) : Text {
     switch (c) {
       case (#red) "Red";
       case (#green) "Green";
       case (#blue) "Blue";
     }
   };
   ```

9. **Variant tag argument precedence.** Variant constructors with arguments bind tightly. When passing a complex expression, use parentheses to avoid unexpected parsing.
   ```motoko
   type Action = { #transfer : Nat; #none };

   // Potentially confusing — what does this parse as?
   let a = #transfer 1 + 2;   // parsed as (#transfer(1)) + 2 — type error

   // Clear — use parentheses for complex expressions
   let a = #transfer(1 + 2);  // #transfer(3)
   ```

10. **Using `do ? { }` blocks incorrectly.** The `!` operator (null break) only works inside a `do ? { }` block. Using it outside produces error M0064.
    ```motoko
    // Wrong — error M0064: misplaced '!' (no enclosing 'do ? { ... }' expression)
    func getName(map : Map.Map<Nat, Text>, id : Nat) : ?Text {
      let name = Map.get(map, Nat.compare, id)!;
      ?name
    };

    // Correct — wrap in do ? { }
    func getName(map : Map.Map<Nat, Text>, id : Nat) : ?Text {
      do ? {
        let name = Map.get(map, Nat.compare, id)!;
        name
      }
    };
    ```

## mo:core Standard Library

The `core` library (package name `core` on mops) is the modern standard library. It replaces the deprecated `base` library. Minimum moc version: 1.0.0.

### Import pattern

Always import from `mo:core/`, never from `mo:base/`:
```motoko
import Map "mo:core/Map";
import Set "mo:core/Set";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Option "mo:core/Option";
import Result "mo:core/Result";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Debug "mo:core/Debug";
import Runtime "mo:core/Runtime";
```

### Available modules

Array, Base64, Blob, Bool, CertifiedData, Char, Cycles, Debug, Error, Float, Func, Int, Int8, Int16, Int32, Int64, InternetComputer, Iter, List, Map, Nat, Nat8, Nat16, Nat32, Nat64, Option, Order, Principal, PriorityQueue, Queue, Random, Region, Result, Runtime, Set, Stack, Text, Time, Timer, Tuples, Types, VarArray, WeakReference.

### Key collection APIs

**Map** (B-tree, `O(log n)`, stable):
```motoko
import Map "mo:core/Map";
import Nat "mo:core/Nat";

persistent actor {
  let users = Map.empty<Nat, Text>();

  public func addUser(id : Nat, name : Text) : async () {
    Map.add(users, Nat.compare, id, name);
  };

  public query func getUser(id : Nat) : async ?Text {
    Map.get(users, Nat.compare, id)
  };

  public query func userCount() : async Nat {
    Map.size(users)
  };

  public func removeUser(id : Nat) : async () {
    Map.remove(users, Nat.compare, id);
  };
};
```

**Set** (B-tree, `O(log n)`, stable):
```motoko
import Set "mo:core/Set";
import Text "mo:core/Text";

let tags = Set.empty<Text>();
Set.add(tags, Text.compare, "motoko");
Set.contains(tags, Text.compare, "motoko"); // true
```

**List** (growable, stable):
```motoko
import List "mo:core/List";

let items = List.empty<Text>();
List.add(items, "first");
List.add(items, "second");
List.get(items, 0);  // ?"first" — returns ?T, null if out of bounds
List.at(items, 0);   // "first" — returns T, traps if out of bounds
```
Note: `List.get` returns `?T` (safe). `List.at` returns `T` and traps on out-of-bounds. In core < 1.0.0 the names were different (`get` was `getOpt`, `at` was `get`).

### Text.join parameter order

```motoko
import Text "mo:core/Text";

// First parameter is the iterator, second is the separator
let result = Text.join(["a", "b", "c"].vals(), ", "); // "a, b, c"
```

### Type parameters often need explicit annotation

Invariant type parameters cannot always be inferred. When the compiler says "add explicit type instantiation", provide type arguments:
```motoko
import VarArray "mo:core/VarArray";

// May fail type inference
let doubled = VarArray.map(arr, func x = x * 2);

// Fix: add explicit type arguments
let doubled = VarArray.map<Nat, Nat>(arr, func x = x * 2);
```

## Common Patterns

### Actor with Map and query methods

```motoko
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Iter "mo:core/Iter";

persistent actor {

  type Profile = {
    name : Text;
    bio : Text;
    created : Int;
  };

  let profiles = Map.empty<Nat, Profile>();
  var nextId : Nat = 0;

  public func createProfile(name : Text, bio : Text) : async Nat {
    let id = nextId;
    nextId += 1;
    Map.add(profiles, Nat.compare, id, {
      name;
      bio;
      created = Time.now();
    });
    id
  };

  public query func getProfile(id : Nat) : async ?Profile {
    Map.get(profiles, Nat.compare, id)
  };

  public query func listProfiles() : async [(Nat, Profile)] {
    Iter.toArray(Map.entries(profiles))
  };
};
```

### Option handling with switch

```motoko
public query func greetUser(id : Nat) : async Text {
  switch (Map.get(profiles, Nat.compare, id)) {
    case (?profile) { "Hello, " # profile.name # "!" };
    case null { "User not found" };
  }
};
```

### Error handling with try/catch

```motoko
import Error "mo:core/Error";

// try/catch only works with inter-canister calls (async contexts)
public func safeTransfer(to : Principal, amount : Nat) : async Result.Result<(), Text> {
  try {
    await remoteCanister.transfer(to, amount);
    #ok()
  } catch (e) {
    #err(Error.message(e))
  }
};
```

### Reading canister environment variables

```motoko
import Runtime "mo:core/Runtime";

// Injected by icp deploy — available in mo:core >= 2.1.0
// Returns ?Text — null if the variable is not set
let ?backendId = Runtime.envVar("PUBLIC_CANISTER_ID:backend")
  else Debug.trap("PUBLIC_CANISTER_ID:backend not set");
```
