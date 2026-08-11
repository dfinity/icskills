# Core Library API Reference

Complete API signatures from `mo:core` library.

Use this as a reference when using contextual dot notation.

## Array

- `public func all<T>(self : [T], predicate : T -> Bool) : Bool`
- `public func any<T>(self : [T], predicate : T -> Bool) : Bool`
- `public func binarySearch<T>(self : [T], compare : (implicit : (T, T) -> Order.Order), element : T) : { #found : Nat; #insertionIndex : Nat }`
- `public func compare<T>(self : [T], other : [T], compare : (implicit : (T, T) -> Order.Order)) : Order.Order`
- `public func concat<T>(self : [T], other : [T]) : [T]`
- `public func empty<T>() : [T]`
- `public func enumerate<T>(self : [T]) : Types.Iter<(Nat, T)>`
- `public func equal<T>(self : [T], other : [T], equal : (implicit : (T, T) -> Bool)) : Bool`
- `public func filter<T>(self : [T], f : T -> Bool) : [T]`
- `public func filterMap<T, R>(self : [T], f : T -> ?R) : [R]`
- `public func find<T>(self : [T], predicate : T -> Bool) : ?T`
- `public func findIndex<T>(self : [T], predicate : T -> Bool) : ?Nat`
- `public func flatMap<T, R>(self : [T], k : T -> Types.Iter<R>) : [R]`
- `public func flatten<T>(self : [[T]]) : [T]`
- `public func foldLeft<T, A>(self : [T], base : A, combine : (A, T) -> A) : A`
- `public func foldRight<T, A>(self : [T], base : A, combine : (T, A) -> A) : A`
- `public func forEach<T>(self : [T], f : T -> ())`
- `public func fromIter<T>(iter : Types.Iter<T>) : [T]`
- `public func fromVarArray<T>(varArray : [var T]) : [T]`
- `public func indexOf<T>(self : [T], equal : (implicit : (T, T) -> Bool), element : T) : ?Nat`
- `public func isEmpty<T>(self : [T]) : Bool`
- `public func isSorted<T>(self : [T], compare : (implicit : (T, T) -> Order.Order)) : Bool`
- `public func join<T>(self : Types.Iter<[T]>) : [T]`
- `public func keys<T>(self : [T]) : Types.Iter<Nat>`
- `public func lastIndexOf<T>(self : [T], equal : (implicit : (T, T) -> Bool), element : T) : ?Nat`
- `public func map<T, R>(self : [T], f : T -> R) : [R]`
- `public func mapEntries<T, R>(self : [T], f : (T, Nat) -> R) : [R]`
- `public func nextIndexOf<T>(self : [T], equal : (implicit : (T, T) -> Bool), element : T, fromInclusive : Nat) : ?Nat`
- `public func prevIndexOf<T>(self : [T], equal : (implicit : (T, T) -> Bool), element : T, fromExclusive : Nat) : ?Nat`
- `public func range<T>(self : [T], fromInclusive : Int, toExclusive : Int) : Types.Iter<T>`
- `public func repeat<T>(item : T, size : Nat) : [T]`
- `public func reverse<T>(self : [T]) : [T]`
- `public func singleton<T>(element : T) : [T]`
- `public func size<T>(self : [T]) : Nat`
- `public func sliceToArray<T>(self : [T], fromInclusive : Int, toExclusive : Int) : [T]`
- `public func sliceToVarArray<T>(self : [T], fromInclusive : Int, toExclusive : Int) : [var T]`
- `public func sort<T>(self : [T], compare : (implicit : (T, T) -> Order.Order)) : [T]`
- `public func toText<T>(self : [T], f : (implicit : (toText : T -> Text))) : Text`
- `public func toVarArray<T>(self : [T]) : [var T]`
- `public func values<T>(self : [T]) : Types.Iter<T>`
- `public let tabulate : <T>(size : Nat, generator : Nat -> T) -> [T]`

## Debug

- `public func todo() : None`
- `public let print : (text : Text) -> ()`

## Int

- `public func add(x : Int, y : Int) : Int`
- `public func compare(x : Int, y : Int) : Order.Order`
- `public func div(x : Int, y : Int) : Int`
- `public func equal(x : Int, y : Int) : Bool`
- `public func fromNat(nat : Nat) : Int`
- `public func fromText(text : Text) : ?Int`
- `public func greater(x : Int, y : Int) : Bool`
- `public func greaterOrEqual(x : Int, y : Int) : Bool`
- `public func less(x : Int, y : Int) : Bool`
- `public func lessOrEqual(x : Int, y : Int) : Bool`
- `public func max(x : Int, y : Int) : Int`
- `public func min(x : Int, y : Int) : Int`
- `public func mul(x : Int, y : Int) : Int`
- `public func neg(x : Int) : Int`
- `public func notEqual(x : Int, y : Int) : Bool`
- `public func pow(x : Int, y : Int) : Int`
- `public func range(fromInclusive : Int, toExclusive : Int) : Iter.Iter<Int>`
- `public func rangeBy(fromInclusive : Int, toExclusive : Int, step : Int) : Iter.Iter<Int>`
- `public func rangeByInclusive(from : Int, to : Int, step : Int) : Iter.Iter<Int>`
- `public func rangeInclusive(from : Int, to : Int) : Iter.Iter<Int>`
- `public func rem(x : Int, y : Int) : Int`
- `public func sub(x : Int, y : Int) : Int`
- `public func toInt(self : Text) : ?Int`
- `public func toNat(self : Int) : Nat`
- `public func toText(self : Int) : Text`
- `public let abs : (x : Int) -> Nat`
- `public let fromInt16 : (x : Int16) -> Int`
- `public let fromInt32 : (x : Int32) -> Int`
- `public let fromInt64 : (x : Int64) -> Int`
- `public let fromInt8 : (x : Int8) -> Int`
- `public let toFloat : (self : Int) -> Float`
- `public let toInt16 : (self : Int) -> Int16`
- `public let toInt32 : (self : Int) -> Int32`
- `public let toInt64 : (self : Int) -> Int64`
- `public let toInt8 : (self : Int) -> Int8`
- `public type Int`

## Iter

- `public func all<T>(self : Iter<T>, f : T -> Bool) : Bool`
- `public func any<T>(self : Iter<T>, f : T -> Bool) : Bool`
- `public func concat<T>(self : Iter<T>, other : Iter<T>) : Iter<T>`
- `public func contains<T>(self : Iter<T>, equal : (implicit : (T, T) -> Bool), value : T) : Bool`
- `public func drop<T>(self : Iter<T>, n : Nat) : Iter<T>`
- `public func dropWhile<T>(self : Iter<T>, f : T -> Bool) : Iter<T>`
- `public func empty<T>() : Iter<T>`
- `public func enumerate<T>(self : Iter<T>) : Iter<(Nat, T)>`
- `public func filter<T>(self : Iter<T>, f : T -> Bool) : Iter<T>`
- `public func filterMap<T, R>(self : Iter<T>, f : T -> ?R) : Iter<R>`
- `public func find<T>(self : Iter<T>, f : T -> Bool) : ?T`
- `public func findIndex<T>(self : Iter<T>, predicate : T -> Bool) : ?Nat`
- `public func flatMap<T, R>(self : Iter<T>, f : T -> Iter<R>) : Iter<R>`
- `public func flatten<T>(self : Iter<Iter<T>>) : Iter<T>`
- `public func foldLeft<T, R>(self : Iter<T>, initial : R, combine : (R, T) -> R) : R`
- `public func foldRight<T, R>(self : Iter<T>, initial : R, combine : (T, R) -> R) : R`
- `public func forEach<T>( self : Iter<T>, f : (T) -> () )`
- `public func fromArray<T>(array : [T]) : Iter<T>`
- `public func fromVarArray<T>(array : [var T]) : Iter<T>`
- `public func infinite<T>(item : T) : Iter<T>`
- `public func map<T, R>(self : Iter<T>, f : T -> R) : Iter<R>`
- `public func max<T>(self : Iter<T>, compare : (implicit : (T, T) -> Order.Order)) : ?T`
- `public func min<T>(self : Iter<T>, compare : (implicit : (T, T) -> Order.Order)) : ?T`
- `public func reduce<T>(self : Iter<T>, combine : (T, T) -> T) : ?T`
- `public func repeat<T>(item : T, count : Nat) : Iter<T>`
- `public func reverse<T>(self : Iter<T>) : Iter<T>`
- `public func scanLeft<T, R>(self : Iter<T>, initial : R, combine : (R, T) -> R) : Iter<R>`
- `public func scanRight<T, R>(self : Iter<T>, initial : R, combine : (T, R) -> R) : Iter<R>`
- `public func singleton<T>(value : T) : Iter<T>`
- `public func size<T>(self : Iter<T>) : Nat`
- `public func sort<T>(self : Iter<T>, compare : (implicit : (T, T) -> Order.Order)) : Iter<T>`
- `public func step<T>(self : Iter<T>, n : Nat) : Iter<T>`
- `public func take<T>(self : Iter<T>, n : Nat) : Iter<T>`
- `public func takeWhile<T>(self : Iter<T>, f : T -> Bool) : Iter<T>`
- `public func toArray<T>(self : Iter<T>) : [T]`
- `public func toVarArray<T>(self : Iter<T>) : [var T]`
- `public func unfold<T, S>(initial : S, step : S -> ?(T, S)) : Iter<T>`
- `public func zip3<A, B, C>(self : Iter<A>, other1 : Iter<B>, other2 : Iter<C>) : Iter<(A, B, C)>`
- `public func zip<A, B>(self : Iter<A>, other : Iter<B>) : Iter<(A, B)>`
- `public func zipWith3<A, B, C, R>(self : Iter<A>, other1 : Iter<B>, other2 : Iter<C>, f : (A, B, C) -> R) : Iter<R>`
- `public func zipWith<A, B, R>(self : Iter<A>, other : Iter<B>, f : (A, B) -> R) : Iter<R>`
- `public type Iter<T>`

## List

- `public func add<T>(self : List<T>, element : T)`
- `public func addAll<T>(self : List<T>, iter : Types.Iter<T>)`
- `public func addRepeat<T>(self : List<T>, initValue : T, count : Nat)`
- `public func all<T>(self : List<T>, predicate : T -> Bool) : Bool`
- `public func any<T>(self : List<T>, predicate : T -> Bool) : Bool`
- `public func append<T>(self : List<T>, added : List<T>)`
- `public func at<T>(self : List<T>, index : Nat) : T`
- `public func binarySearch<T>(self : List<T>, compare : (implicit : (T, T) -> Types.Order), element : T) : { #found : Nat; #insertionIndex : Nat }`
- `public func clear<T>(self : List<T>)`
- `public func clone<T>(self : List<T>) : List<T>`
- `public func compare<T>(self : List<T>, other : List<T>, compare : (implicit : (T, T) -> Types.Order)) : Types.Order`
- `public func contains<T>(self : List<T>, equal : (implicit : (T, T) -> Bool), element : T) : Bool`
- `public func deduplicate<T>(self : List<T>, equal : (implicit : (T, T) -> Bool))`
- `public func empty<T>() : List<T>`
- `public func enumerate<T>(self : List<T>) : Types.Iter<(Nat, T)>`
- `public func equal<T>(self : List<T>, other : List<T>, equal : (implicit : (T, T) -> Bool)) : Bool`
- `public func fill<T>(self : List<T>, value : T)`
- `public func filter<T>(self : List<T>, predicate : T -> Bool) : List<T>`
- `public func filterMap<T, R>(self : List<T>, f : T -> ?R) : List<R>`
- `public func find<T>(self : List<T>, predicate : T -> Bool) : ?T`
- `public func findIndex<T>(self : List<T>, predicate : T -> Bool) : ?Nat`
- `public func findLastIndex<T>(self : List<T>, predicate : T -> Bool) : ?Nat`
- `public func first<T>(self : List<T>) : ?T`
- `public func flatMap<T, R>(self : List<T>, k : T -> Types.Iter<R>) : List<R>`
- `public func flatten<T>(self : List<List<T>>) : List<T>`
- `public func foldLeft<A, T>(self : List<T>, base : A, combine : (A, T) -> A) : A`
- `public func foldRight<T, A>(self : List<T>, base : A, combine : (T, A) -> A) : A`
- `public func forEach<T>(self : List<T>, f : T -> ())`
- `public func forEachEntry<T>(self : List<T>, f : (Nat, T) -> ())`
- `public func forEachInRange<T>(self : List<T>, f : T -> (), fromInclusive : Nat, toExclusive : Nat)`
- `public func fromArray<T>(array : [T]) : List<T>`
- `public func fromIter<T>(iter : Types.Iter<T>) : List<T>`
- `public func fromVarArray<T>(array : [var T]) : List<T>`
- `public func indexOf<T>(self : List<T>, equal : (implicit : (T, T) -> Bool), element : T) : ?Nat`
- `public func isEmpty<T>(self : List<T>) : Bool`
- `public func isSorted<T>(self : List<T>, compare : (implicit : (T, T) -> Types.Order)) : Bool`
- `public func join<T>(self : Types.Iter<List<T>>) : List<T>`
- `public func keys<T>(self : List<T>) : Types.Iter<Nat>`
- `public func last<T>(self : List<T>) : ?T`
- `public func lastIndexOf<T>(self : List<T>, equal : (implicit : (T, T) -> Bool), element : T) : ?Nat`
- `public func map<T, R>(self : List<T>, f : T -> R) : List<R>`
- `public func mapEntries<T, R>(self : List<T>, f : (T, Nat) -> R) : List<R>`
- `public func mapInPlace<T>(self : List<T>, f : T -> T)`
- `public func mapResult<T, R, E>(self : List<T>, f : T -> Types.Result<R, E>) : Types.Result<List<R>, E>`
- `public func max<T>(self : List<T>, compare : (implicit : (T, T) -> Types.Order)) : ?T`
- `public func min<T>(self : List<T>, compare : (implicit : (T, T) -> Types.Order)) : ?T`
- `public func nextIndexOf<T>(self : List<T>, equal : (implicit : (T, T) -> Bool), element : T, fromInclusive : Nat) : ?Nat`
- `public func prevIndexOf<T>(self : List<T>, equal : (implicit : (T, T) -> Bool), element : T, fromExclusive : Nat) : ?Nat`
- `public func put<T>(self : List<T>, index : Nat, value : T)`
- `public func range<T>(self : List<T>, fromInclusive : Int, toExclusive : Int) : Types.Iter<T>`
- `public func reader<T>(self : List<T>, start : Nat) : () -> T`
- `public func removeLast<T>(self : List<T>) : ?T`
- `public func repeat<T>(initValue : T, size : Nat) : List<T>`
- `public func reverse<T>(self : List<T>) : List<T>`
- `public func reverseEnumerate<T>(self : List<T>) : Types.Iter<(Nat, T)>`
- `public func reverseForEach<T>(self : List<T>, f : T -> ())`
- `public func reverseForEachEntry<T>(self : List<T>, f : (Nat, T) -> ())`
- `public func reverseInPlace<T>(self : List<T>)`
- `public func reverseValues<T>(self : List<T>) : Types.Iter<T>`
- `public func singleton<T>(element : T) : List<T>`
- `public func size<T>(self : List<T>) : Nat`
- `public func sliceToArray<T>(self : List<T>, fromInclusive : Int, toExclusive : Int) : [T]`
- `public func sliceToVarArray<T>(self : List<T>, fromInclusive : Int, toExclusive : Int) : [var T]`
- `public func sort<T>(self : List<T>, compare : (implicit : (T, T) -> Types.Order)) : List<T>`
- `public func sortInPlace<T>(self : List<T>, compare : (implicit : (T, T) -> Types.Order))`
- `public func tabulate<T>(size : Nat, generator : Nat -> T) : List<T>`
- `public func toArray<T>(self : List<T>) : [T]`
- `public func toList<T>(self : Types.Iter<T>) : List<T>`
- `public func toText<T>(self : List<T>, toText : (implicit : T -> Text)) : Text`
- `public func toVarArray<T>(self : List<T>) : [var T]`
- `public func truncate<T>(self : List<T>, newSize : Nat)`
- `public func values<T>(self : List<T>) : Types.Iter<T>`
- `public type List<T>`

## Map

- `public func add<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K, value : V)`
- `public func all<K, V>(self : Map<K, V>, predicate : (K, V) -> Bool) : Bool`
- `public func any<K, V>(self : Map<K, V>, predicate : (K, V) -> Bool) : Bool`
- `public func clear<K, V>(self : Map<K, V>)`
- `public func clone<K, V>(self : Map<K, V>) : Map<K, V>`
- `public func compare<K, V>(self : Map<K, V>, other : Map<K, V>, compareKey : (implicit : (compare : (K, K) -> Order.Order)), compareValue : (implicit : (compare : (V, V) -> Order.Order))) : Order.Order`
- `public func containsKey<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K) : Bool`
- `public func empty<K, V>() : Map<K, V>`
- `public func entries<K, V>(self : Map<K, V>) : Types.Iter<(K, V)>`
- `public func entriesFrom<K, V>( self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K ) : Types.Iter<(K, V)>`
- `public func equal<K, V>(self : Map<K, V>, other : Map<K, V>, compare : (implicit : (K, K) -> Types.Order), equal : (implicit : (V, V) -> Bool)) : Bool`
- `public func filter<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), criterion : (K, V) -> Bool) : Map<K, V>`
- `public func filterMap<K, V1, V2>(self : Map<K, V1>, compare : (implicit : (K, K) -> Order.Order), project : (K, V1) -> ?V2) : Map<K, V2>`
- `public func foldLeft<K, V, A>( self : Map<K, V>, base : A, combine : (A, K, V) -> A ) : A`
- `public func foldRight<K, V, A>( self : Map<K, V>, base : A, combine : (K, V, A) -> A ) : A`
- `public func forEach<K, V>(self : Map<K, V>, operation : (K, V) -> ())`
- `public func fromArray<K, V>(array : [(K, V)], compare : (implicit : (K, K) -> Order.Order)) : Map<K, V>`
- `public func fromIter<K, V>(iter : Types.Iter<(K, V)>, compare : (implicit : (K, K) -> Order.Order)) : Map<K, V>`
- `public func fromVarArray<K, V>(array : [var (K, V)], compare : (implicit : (K, K) -> Order.Order)) : Map<K, V>`
- `public func get<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K) : ?V`
- `public func isEmpty<K, V>(self : Map<K, V>) : Bool`
- `public func keys<K, V>(self : Map<K, V>) : Types.Iter<K>`
- `public func map<K, V1, V2>(self : Map<K, V1>, project : (K, V1) -> V2) : Map<K, V2>`
- `public func maxEntry<K, V>(self : Map<K, V>) : ?(K, V)`
- `public func minEntry<K, V>(self : Map<K, V>) : ?(K, V)`
- `public func remove<K, V>(self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K)`
- `public func reverseEntries<K, V>(self : Map<K, V>) : Types.Iter<(K, V)>`
- `public func reverseEntriesFrom<K, V>( self : Map<K, V>, compare : (implicit : (K, K) -> Order.Order), key : K ) : Types.Iter<(K, V)>`
- `public func singleton<K, V>(key : K, value : V) : Map<K, V>`
- `public func size<K, V>(self : Map<K, V>) : Nat`
- `public func toArray<K, V>(self : Map<K, V>) : [(K, V)]`
- `public func toMap<K, V>(self : Types.Iter<(K, V)>, compare : (implicit : (K, K) -> Order.Order)) : Map<K, V>`
- `public func toText<K, V>(self : Map<K, V>, keyFormat : (implicit : (toText : K -> Text)), valueFormat : (implicit : (toText : V -> Text))) : Text`
- `public func toVarArray<K, V>(self : Map<K, V>) : [var (K, V)]`
- `public func values<K, V>(self : Map<K, V>) : Types.Iter<V>`
- `public type Map<K, V>`

## Nat

- `public func add(x : Nat, y : Nat) : Nat`
- `public func allValues() : Iter.Iter<Nat>`
- `public func compare(x : Nat, y : Nat) : Order.Order`
- `public func div(x : Nat, y : Nat) : Nat`
- `public func equal(x : Nat, y : Nat) : Bool`
- `public func fromText(text : Text) : ?Nat`
- `public func greater(x : Nat, y : Nat) : Bool`
- `public func greaterOrEqual(x : Nat, y : Nat) : Bool`
- `public func less(x : Nat, y : Nat) : Bool`
- `public func lessOrEqual(x : Nat, y : Nat) : Bool`
- `public func max(x : Nat, y : Nat) : Nat`
- `public func min(x : Nat, y : Nat) : Nat`
- `public func mul(x : Nat, y : Nat) : Nat`
- `public func notEqual(x : Nat, y : Nat) : Bool`
- `public func pow(x : Nat, y : Nat) : Nat`
- `public func range(fromInclusive : Nat, toExclusive : Nat) : Iter.Iter<Nat>`
- `public func rangeBy(fromInclusive : Nat, toExclusive : Nat, step : Int) : Iter.Iter<Nat>`
- `public func rangeByInclusive(from : Nat, to : Nat, step : Int) : Iter.Iter<Nat>`
- `public func rangeInclusive(from : Nat, to : Nat) : Iter.Iter<Nat>`
- `public func rem(x : Nat, y : Nat) : Nat`
- `public func sub(x : Nat, y : Nat) : Nat`
- `public func toInt(self : Nat) : Int`
- `public let bitshiftLeft : (x : Nat, y : Nat32) -> Nat`
- `public let bitshiftRight : (x : Nat, y : Nat32) -> Nat`
- `public let fromNat16 : Nat16 -> Nat`
- `public let fromNat32 : Nat32 -> Nat`
- `public let fromNat64 : Nat64 -> Nat`
- `public let fromNat8 : Nat8 -> Nat`
- `public let toFloat : (self : Nat) -> Float`
- `public let toNat : (self : Text) -> ?Nat`
- `public let toNat16 : (self : Nat) -> Nat16`
- `public let toNat32 : (self : Nat) -> Nat32`
- `public let toNat64 : (self : Nat) -> Nat64`
- `public let toNat8 : (self : Nat) -> Nat8`
- `public let toText : (self : Nat) -> Text`
- `public type Nat`

## Option

- `public func apply<T, R>(self : ?T, f : ?(T -> R)) : ?R`
- `public func chain<T, R>(self : ?T, f : T -> ?R) : ?R`
- `public func compare<T>(self : ?T, other : ?T, compare : (implicit : (T, T) -> Types.Order)) : Types.Order`
- `public func equal<T>(self : ?T, other : ?T, eq : (implicit : (equal : (T, T) -> Bool))) : Bool`
- `public func flatten<T>(self : ??T) : ?T`
- `public func forEach<T>(self : ?T, f : T -> ())`
- `public func get<T>(self : ?T, default : T) : T`
- `public func getMapped<T, R>(self : ?T, f : T -> R, default : R) : R`
- `public func isNull(self : ?Any) : Bool`
- `public func isSome(self : ?Any) : Bool`
- `public func map<T, R>(self : ?T, f : T -> R) : ?R`
- `public func some<T>(self : T) : ?T`
- `public func toText<T>(self : ?T, toText : (implicit : T -> Text)) : Text`
- `public func unwrap<T>(self : ?T) : T`

## Order

- `public func allValues() : Types.Iter<Order>`
- `public func equal(self : Order, other : Order) : Bool`
- `public func isEqual(self : Order) : Bool`
- `public func isGreater(self : Order) : Bool`
- `public func isLess(self : Order) : Bool`
- `public type Order`

## Principal

- `public func anonymous() : Principal`
- `public func compare(self : Principal, other : Principal) : { #less; #equal; #greater }`
- `public func equal(self : Principal, other : Principal) : Bool`
- `public func fromText(t : Text) : Principal`
- `public func greater(self : Principal, other : Principal) : Bool`
- `public func greaterOrEqual(self : Principal, other : Principal) : Bool`
- `public func hash(self : Principal) : Types.Hash`
- `public func isAnonymous(self : Principal) : Bool`
- `public func isCanister(self : Principal) : Bool`
- `public func isController(self : Principal) : Bool`
- `public func isReserved(self : Principal) : Bool`
- `public func isSelfAuthenticating(self : Principal) : Bool`
- `public func less(self : Principal, other : Principal) : Bool`
- `public func lessOrEqual(self : Principal, other : Principal) : Bool`
- `public func notEqual(self : Principal, other : Principal) : Bool`
- `public func toLedgerAccount(self : Principal, subAccount : ?Blob) : Blob`
- `public func toText(self : Principal) : Text`
- `public let fromActor : (a : actor`
- `public let fromBlob : (self : Blob) -> Principal`
- `public let toBlob : (self : Principal) -> Blob`
- `public type Principal`

## Queue

- `public func all<T>(self : Queue<T>, predicate : T -> Bool) : Bool`
- `public func any<T>(self : Queue<T>, predicate : T -> Bool) : Bool`
- `public func clear<T>(self : Queue<T>)`
- `public func clone<T>(self : Queue<T>) : Queue<T>`
- `public func compare<T>(self : Queue<T>, other : Queue<T>, compare : (implicit : (T, T) -> Order.Order)) : Order.Order`
- `public func contains<T>(self : Queue<T>, equal : (implicit : (T, T) -> Bool), element : T) : Bool`
- `public func empty<T>() : Queue<T>`
- `public func equal<T>(self : Queue<T>, other : Queue<T>, equal : (implicit : (T, T) -> Bool)) : Bool`
- `public func filter<T>(self : Queue<T>, criterion : T -> Bool) : Queue<T>`
- `public func filterMap<T, U>(self : Queue<T>, project : T -> ?U) : Queue<U>`
- `public func forEach<T>(self : Queue<T>, operation : T -> ())`
- `public func fromArray<T>(array : [T]) : Queue<T>`
- `public func fromIter<T>(iter : Iter.Iter<T>) : Queue<T>`
- `public func fromVarArray<T>(array : [var T]) : Queue<T>`
- `public func isEmpty<T>(self : Queue<T>) : Bool`
- `public func map<T, U>(self : Queue<T>, project : T -> U) : Queue<U>`
- `public func peekBack<T>(self : Queue<T>) : ?T`
- `public func peekFront<T>(self : Queue<T>) : ?T`
- `public func popBack<T>(self : Queue<T>) : ?T`
- `public func popFront<T>(self : Queue<T>) : ?T`
- `public func pushBack<T>(self : Queue<T>, element : T)`
- `public func pushFront<T>(self : Queue<T>, element : T)`
- `public func reverseValues<T>(self : Queue<T>) : Iter.Iter<T>`
- `public func singleton<T>(element : T) : Queue<T>`
- `public func size<T>(self : Queue<T>) : Nat`
- `public func toArray<T>(self : Queue<T>) : [T]`
- `public func toQueue<T>(self : Iter.Iter<T>) : Queue<T>`
- `public func toText<T>(self : Queue<T>, format : (implicit : (toText : T -> Text))) : Text`
- `public func toVarArray<T>(self : Queue<T>) : [var T]`
- `public func values<T>(self : Queue<T>) : Iter.Iter<T>`
- `public type Queue<T>`

## Runtime

- `public func trap(message : Text)`

## Set

- `public func add<T>(self : Set<T>, compare : (implicit : (T, T) -> Order.Order), element : T)`
- `public func addAll<T>(self : Set<T>, compare : (implicit : (T, T) -> Order.Order), iter : Types.Iter<T>)`
- `public func all<T>(self : Set<T>, predicate : T -> Bool) : Bool`
- `public func any<T>(self : Set<T>, predicate : T -> Bool) : Bool`
- `public func clear<T>(self : Set<T>)`
- `public func clone<T>(self : Set<T>) : Set<T>`
- `public func compare<T>(self : Set<T>, other : Set<T>, compare : (implicit : (T, T) -> Order.Order)) : Order.Order`
- `public func contains<T>(self : Set<T>, compare : (implicit : (T, T) -> Order.Order), element : T) : Bool`
- `public func difference<T>(self : Set<T>, other : Set<T>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func empty<T>() : Set<T>`
- `public func equal<T>(self : Set<T>, other : Set<T>, compare : (implicit : (T, T) -> Types.Order)) : Bool`
- `public func filter<T>(self : Set<T>, compare : (implicit : (T, T) -> Order.Order), criterion : T -> Bool) : Set<T>`
- `public func filterMap<T1, T2>(self : Set<T1>, compare : (implicit : (T2, T2) -> Order.Order), project : T1 -> ?T2) : Set<T2>`
- `public func flatten<T>(self : Set<Set<T>>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func foldLeft<T, A>( self : Set<T>, base : A, combine : (A, T) -> A ) : A`
- `public func foldRight<T, A>( self : Set<T>, base : A, combine : (T, A) -> A ) : A`
- `public func forEach<T>(self : Set<T>, operation : T -> ())`
- `public func fromArray<T>(array : [T], compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func fromIter<T>(iter : Types.Iter<T>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func intersection<T>(self : Set<T>, other : Set<T>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func isEmpty<T>(self : Set<T>) : Bool`
- `public func isSubset<T>(self : Set<T>, other : Set<T>, compare : (implicit : (T, T) -> Order.Order)) : Bool`
- `public func join<T>(setIterator : Types.Iter<Set<T>>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func map<T1, T2>(self : Set<T1>, compare : (implicit : (T2, T2) -> Order.Order), project : T1 -> T2) : Set<T2>`
- `public func max<T>(self : Set<T>) : ?T`
- `public func min<T>(self : Set<T>) : ?T`
- `public func remove<T>(self : Set<T>, compare : (implicit : (T, T) -> Order.Order), element : T) : ()`
- `public func reverseValues<T>(self : Set<T>) : Types.Iter<T>`
- `public func reverseValuesFrom<T>( self : Set<T>, compare : (implicit : (T, T) -> Order.Order), element : T ) : Types.Iter<T>`
- `public func singleton<T>(element : T) : Set<T>`
- `public func size<T>(self : Set<T>) : Nat`
- `public func toArray<T>(self : Set<T>) : [T]`
- `public func toSet<T>(self : Types.Iter<T>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func toText<T>(self : Set<T>, toText : (implicit : T -> Text)) : Text`
- `public func union<T>(self : Set<T>, other : Set<T>, compare : (implicit : (T, T) -> Order.Order)) : Set<T>`
- `public func values<T>(self : Set<T>) : Types.Iter<T>`
- `public func valuesFrom<T>( self : Set<T>, compare : (implicit : (T, T) -> Order.Order), element : T ) : Types.Iter<T>`
- `public type Set<T>`

## Stack

- `public func all<T>(self : Stack<T>, predicate : T -> Bool) : Bool`
- `public func any<T>(self : Stack<T>, predicate : T -> Bool) : Bool`
- `public func clear<T>(self : Stack<T>)`
- `public func clone<T>(self : Stack<T>) : Stack<T>`
- `public func compare<T>(self : Stack<T>, other : Stack<T>, compare : (implicit : (T, T) -> Order.Order)) : Order.Order`
- `public func contains<T>(self : Stack<T>, equal : (implicit : (T, T) -> Bool), element : T) : Bool`
- `public func empty<T>() : Stack<T>`
- `public func equal<T>(self : Stack<T>, other : Stack<T>, equal : (implicit : (T, T) -> Bool)) : Bool`
- `public func filter<T>(self : Stack<T>, predicate : T -> Bool) : Stack<T>`
- `public func filterMap<T, U>(self : Stack<T>, project : T -> ?U) : Stack<U>`
- `public func find<T>(self : Stack<T>, predicate : T -> Bool) : ?T`
- `public func findIndex<T>(self : Stack<T>, predicate : T -> Bool) : ?Nat`
- `public func forEach<T>(self : Stack<T>, operation : T -> ())`
- `public func fromArray<T>(array : [T]) : Stack<T>`
- `public func fromIter<T>(iter : Types.Iter<T>) : Stack<T>`
- `public func fromVarArray<T>(array : [var T]) : Stack<T>`
- `public func get<T>(self : Stack<T>, position : Nat) : ?T`
- `public func isEmpty<T>(self : Stack<T>) : Bool`
- `public func map<T, U>(self : Stack<T>, project : T -> U) : Stack<U>`
- `public func peek<T>(self : Stack<T>) : ?T`
- `public func pop<T>(self : Stack<T>) : ?T`
- `public func push<T>(self : Stack<T>, value : T)`
- `public func reverse<T>(self : Stack<T>)`
- `public func reverseValues<T>(self : Stack<T>) : Iter.Iter<T>`
- `public func singleton<T>(element : T) : Stack<T>`
- `public func size<T>(self : Stack<T>) : Nat`
- `public func tabulate<T>(size : Nat, generator : Nat -> T) : Stack<T>`
- `public func toArray<T>(self : Stack<T>) : [T]`
- `public func toStack<T>(self : Types.Iter<T>) : Stack<T>`
- `public func toText<T>(self : Stack<T>, format : (implicit : (toText : T -> Text))) : Text`
- `public func toVarArray<T>(self : Stack<T>) : [var T]`
- `public func values<T>(self : Stack<T>) : Types.Iter<T>`
- `public type Stack<T>`

## Text

- `public func compare(self : Text, other : Text) : Order.Order`
- `public func compareWith( self : Text, other : Text, compare : (Char, Char) -> Order.Order ) : Order.Order`
- `public func concat(self : Text, other : Text) : Text`
- `public func contains(self : Text, p : Pattern) : Bool`
- `public func endsWith(self : Text, p : Pattern) : Bool`
- `public func equal(self : Text, other : Text) : Bool`
- `public func flatMap(self : Text, f : Char -> Text) : Text`
- `public func foldLeft<A>(self : Text, base : A, combine : (A, Char) -> A) : A`
- `public func fromArray(a : [Char]) : Text`
- `public func fromIter(cs : Iter.Iter<Char>) : Text`
- `public func fromVarArray(a : [var Char]) : Text`
- `public func greater(self : Text, other : Text) : Bool`
- `public func greaterOrEqual(self : Text, other : Text) : Bool`
- `public func isEmpty(self : Text) : Bool`
- `public func join(self : Iter.Iter<Text>, sep : Text) : Text`
- `public func less(self : Text, other : Text) : Bool`
- `public func lessOrEqual(self : Text, other : Text) : Bool`
- `public func map(self : Text, f : Char -> Char) : Text`
- `public func notEqual(self : Text, other : Text) : Bool`
- `public func replace(self : Text, p : Pattern, r : Text) : Text`
- `public func reverse(self : Text) : Text`
- `public func size(self : Text) : Nat`
- `public func split(self : Text, p : Pattern) : Iter.Iter<Text>`
- `public func startsWith(self : Text, p : Pattern) : Bool`
- `public func stripEnd(self : Text, p : Pattern) : ?Text`
- `public func stripStart(self : Text, p : Pattern) : ?Text`
- `public func toArray(self : Text) : [Char]`
- `public func toIter(self : Text) : Iter.Iter<Char>`
- `public func toText(self : Text) : Text`
- `public func toVarArray(self : Text) : [var Char]`
- `public func tokens(self : Text, p : Pattern) : Iter.Iter<Text>`
- `public func trim(self : Text, p : Pattern) : Text`
- `public func trimEnd(self : Text, p : Pattern) : Text`
- `public func trimStart(self : Text, p : Pattern) : Text`
- `public let decodeUtf8 : (self : Blob) -> ?Text`
- `public let encodeUtf8 : (self : Text) -> Blob`
- `public let fromChar : (c : Char) -> Text`
- `public let toLower : (self : Text) -> Text`
- `public let toUpper : (self : Text) -> Text`
- `public type Pattern`
- `public type Text`

## Time

- `public func now() : Time`
- `public func toNanoseconds(duration : Duration) : Nat`
- `public type Duration`
- `public type Time`
- `public type TimerId`
  // No Time.compare -->> use Int.compare to compare times.
