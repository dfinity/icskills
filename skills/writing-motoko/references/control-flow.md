# Control Flow

Reference for Motoko control flow patterns. Load when you need switch statement or loop syntax.

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
// Most of the time for Arrays you can use .foldLeft() or .map() instead.

```

## Labeled Loops

Motoko does not support `break` as a keyword. Use labeled loops for early exit:

```motoko
label search while (true) {
  switch (iter.next()) {
    case (?item) {
      if (item.id == targetId) {
        result := ?item;
        break search;
      };
    };
    case null { break search };
  };
};

```

Alternatively, refactor to a helper function with early `return` instead of using labeled loops.
