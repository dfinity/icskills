# Type Conversions

Reference for Motoko numerical type conversions.

## Nat to Int

```motoko
let natValue = 42;
let intValue = natValue.toInt();
let backToNat = Int.abs(intValue); // only if non-negative
```

## Nat Size Conversions

```motoko
let nat8 : Nat8 = 255;
let nat16 = nat8.toNat16();
let nat32 = nat16.toNat32();
let nat64 = nat32.toNat64();
let backToNat8 = Nat8.fromNat64(nat64); // reverse
```

Conversion chain: `Nat8 → Nat16 → Nat32 → Nat64` (widen) or reverse with `fromNatXX` (narrow).

## Int Size Conversions

```motoko
let int8 : Int8 = -128;
let int16 = int8.toInt16();
let int32 = int16.toInt32();
let int64 = int32.toInt64();
let backToInt8 = Int8.fromInt64(int64); // reverse
```

Conversion chain: `Int8 → Int16 → Int32 → Int64` (widen) or reverse with `fromIntXX` (narrow).

## Common Conversion Patterns

```motoko
// Nat to Text
let text = myNat.toText();

// Int to Text
let text = myInt.toText();

// Text to Nat/Int (returns optional)
let maybeNat = Nat.fromText("42"); // ?Nat
let maybeInt = Int.fromText("-5"); // ?Int

// Nat to Float
let f = myNat.toFloat();

// Int to Float
let f = myInt.toFloat();

// Time is Int — use Int conversions
let timestamp = Time.now(); // Int (nanoseconds)
let milliseconds = timestamp / 1_000_000;
```
