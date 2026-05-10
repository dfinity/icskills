# Control Flow

Reference for Motoko control flow patterns.

## Switch Statements

```motoko
// Option unwrapping — trap on unexpected null
let value = switch (map.get(key)) {
  case (?v) { v };
  case (null) { Runtime.trap("Key not found") };
};

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
// Most of the time you can use .foldLeft() or .map() instead.
```

## Break and Continue

Unlabeled `break` and `continue` work in `for`, `while`, and `loop` since moc 1.2.0:

```motoko
for (x in items.vals()) {
  if (x == 0) continue;
  if (x > 100) break;
  process(x);
};
```

Use labeled loops when you need to exit an outer loop from an inner one:

```motoko
label outer for (x in items.vals()) {
  label inner for (y in other.vals()) {
    if (y == 0) continue inner;
    if (x == y) break outer;
  };
};
```

Labeled blocks also work for early exit in non-loop contexts:

```motoko
label search {
  for (item in items.vals()) {
    if (item.id == targetId) {
      result := ?item;
      break search;
    };
  };
};
```
