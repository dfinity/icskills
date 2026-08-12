# Control Flow

Reference for Motoko control flow patterns. Load when you need `??`, switch, or loop syntax.

## Null Coalesce (`??`) — prefer this for `?T`

`e1 ?? e2` unwraps `e1` when it is `?v`, otherwise evaluates `e2` (lazily). Prefer it over a two-arm `switch` that only unwraps or supplies a default.

Requires `moc >= 1.7.0`.

```motoko
// Default when absent
let name = optName ?? "anonymous";

// Trap when null means a bug / invariant break
let value = map.get(key) ?? Runtime.trap("Key not found");

// Nested options — chain instead of nested switches
let start = event.start.dateTime ?? event.start.date ?? "";

// RHS may be a block (parsed as a block, not a record)
let n = opt ?? { let x = 1; x };

// Bare record literal on the RHS needs extra braces or parens
let rec = opt ?? ({ x = 0 });
```

Do **not** use `??` when the `?v` arm transforms the value, runs side effects, or matches variants — keep `switch` for those.

## Switch Statements

Use `switch` for variants, multi-way matches, and option arms that are not plain unwrap/default:

```motoko
// Variant matching
type Status = { #active; #inactive; #pending : Text };
switch (status) {
  case (#active) { "User is active" };
  case (#inactive) { "User is inactive" };
  case (#pending(reason)) { "Pending: " # reason };
};

// Value matching
switch (statusCode) {
  case (200) { "OK" };
  case (404) { "Not Found" };
  case _ { "Unknown" };
};

// Option with a transform or side effect on the Some arm — keep switch
switch (users.get(caller)) {
  case (?u) { u.isAdmin };
  case null { false };
};
```

## For Loops

```motoko
// Iterate Map entries
for ((key, value) in map.entries()) {
  // use key and value
};

// Iterate List
for (item in list.values()) {
  // use item
};

// Iterate Array
for (score in scores.values()) {
  total += score;
};
// Most of the time for Arrays you can use .foldLeft() or .map() instead.

```

## Break and Continue

`break` and `continue` work as in most other languages: `break` leaves the enclosing loop, `continue` skips to its next iteration. Both are available in `for`, `while`, and `loop`:

```motoko
for (item in items.values()) {
  if (item.archived) { continue };
  if (item.id == targetId) {
    result := ?item;
    break;
  };
};

while (true) {
  switch (iter.next()) {
    case (?item) { total += item.score };
    case null { break };
  };
};
```

Alternatively, refactor to a helper function with early `return` when that reads better than a loop with an early exit.
