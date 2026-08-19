---
name: cloud-engine-canisters
description: "Rules for canister code that runs on a cloud engine (a CloudEngine subnet, e.g. OpenCloud). Engines are free and their canisters hold 0 cycles: never attach a cycles amount you computed yourself — drop `(with cycles = …)` clauses (reported failure: IC0504) and let the cost API decide, it returns 0 on an engine. Cross-subnet calls must be bounded-wait and cycle-free (`(with timeout = N)` in Motoko, `Call::bounded_wait` in Rust) or they are rejected: 'Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets'. HTTPS outcalls work with the ordinary wrapper and cost nothing, but never route them via the console proxy — no transform applies there, so consensus fails ('Replicas had different responses'). Cycle-bearing cross-subnet targets (XRC, threshold ECDSA/Schnorr, vetKD) go through the engine's proxy canister. Use when writing or debugging engine canister code, or on these errors. Do NOT use for deploying to an engine (deploy-to-cloud-engine) or outcalls on normal subnets."
license: Apache-2.0
compatibility: "A cloud engine (CloudEngine subnet) to run on; Motoko examples need moc >= 0.14.2 (parenthetical `(with cycles = …)` / `(with timeout = …)` call attributes), Rust examples need ic-cdk >= 0.18 (bounded-wait `Call` API)"
metadata:
  title: Cloud Engine Canisters
  category: CloudEngine
---

# Cloud Engine Canisters

## What This Is

A **cloud engine** is a user-owned slice of Internet Computer capacity, administered from a web console (see the `deploy-to-cloud-engine` skill for getting code onto one). Engines run on a dedicated **`CloudEngine` subnet type** with a **free cycles cost schedule**: nothing an engine canister does is metered in cycles — execution, storage, messaging, and HTTPS outcalls all cost zero — and engine canisters hold a **0 cycles balance by design**.

That model comes with protocol-enforced call rules. Code that works on a normal Application subnet can fail on an engine, and the failures look like cycles or consensus problems rather than what they are: code written for the wrong subnet type. The rules:

| Rule | On a cloud engine |
|------|-------------------|
| 1 | **Never attach cycles** to any call — remove `(with cycles = …)` and cycle-attaching wrappers |
| 2 | **Cross-subnet calls must be bounded-wait** — `(with timeout = N)` in Motoko, `Call::bounded_wait` in Rust |
| 3 | **HTTPS outcalls: ordinary code, zero cost** — keep the standard wrapper, transform on your own canister, never through the proxy |
| 4 | **Cycle-bearing cross-subnet targets** (XRC, threshold signing, vetKD) go **through the console proxy canister** |

## Rule 1 — Never attach a cycles amount you computed yourself

Engine canisters hold 0 cycles and there is nothing to pay for: under the engine's free cost schedule every fee an Application-subnet canister would pay (execution, message transmission, HTTPS outcalls, threshold signing, vetKD, storage) is charged as zero.

- **Inter-canister calls you write: no cycles clause at all.** There is nothing to buy — every fee on an engine is charged as zero — so a cycles attachment is never *needed*, independently of whether the protocol tolerates it. Write `await service.method(args)`, never `await (with cycles = 1_000_000) service.method(args)`. Verified on a live engine canister (`Cycles: 0`): **any non-zero amount fails** with

  ```
  Canister <id> is out of cycles, error code Some("IC0504")
  ```

  Do not "fix" this by zeroing the amount. The platform team's guidance is simply **not to mention cycles at all** on an engine call, and a `cycles = 0` left in place is noise that breaks again the moment the amount becomes non-zero (a computed fee, a copied constant). If you see `IC0504` from an engine canister, some call is attaching a non-zero amount.
- **Rust:** the same rule — never call `.with_cycles(…)` on a `Call` builder. (The platform team states the Motoko rule as "just don't mention cycles"; omitting `.with_cycles` is its Rust equivalent.)
- **Management-canister calls keep their standard wrapper.** `Call.httpRequest` (Motoko, `mo:ic`) and `ic_cdk::management_canister::http_request` (Rust) ask the `ic0.cost_*` system API for the fee, and that API is cost-schedule aware: on an engine it returns **0**, so the wrapper attaches nothing and the same source stays portable to an Application subnet. What breaks is substituting a hardcoded or hand-computed fee — never take a number from the `https-outcalls` cost tables and attach it on an engine.
- The one exception: cycles that a **cross-subnet target** charges are placed *inside* `ProxyArgs.cycles` of the console proxy (Rule 4), never attached to a call your canister sends.

## Rule 2 — Cross-subnet calls must be bounded-wait

The protocol rejects any cross-subnet (XNet) request **from or to** a CloudEngine subnet that is unbounded-wait (guaranteed-response) or carries cycles. The caller gets a reject with exactly this text:

```
Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets
```

Verified live from an engine canister: a plain `await` to a canister on another subnet comes back as that exact `#system_fatal` reject, while the same call with `(with timeout = 30)` and no cycles clause succeeds.

Make every cross-subnet call bounded-wait and cycle-free:

```motoko
// Motoko: `timeout : Nat32` is in seconds
let result = await (with timeout = 30) service.method(args);
```

```rust
// Rust, ic-cdk >= 0.18 — bounded_wait defaults to a 300-second timeout (the IC maximum)
let reply: T = Call::bounded_wait(canister_id, "method")
    .with_arg(arg)
    .await?          // Err on reject / SYS_UNKNOWN — handle, do not unwrap
    .candid()?;      // decode the reply
```

- **Same-subnet calls are exempt**: canisters on the same engine may call each other unbounded-wait. Bounded-wait is still the better default — an unbounded-wait call to an unresponsive callee blocks the caller's upgrades indefinitely (see the `multi-canister` skill).
- The restriction applies in **both directions**: a canister on a normal subnet calling *into* an engine canister must also use a bounded-wait, cycle-free call.
- A bounded-wait call can complete with `SYS_UNKNOWN` (outcome unknown). Handle it — the `multi-canister` skill covers the patterns.

## Rule 3 — HTTPS outcalls: ordinary code, zero cost

HTTPS outcalls execute on the engine's own subnet, and the cost API reports them as free there, so the standard wrapper works unchanged — there is no engine-specific outcall code:

```motoko
import IC "mo:ic/Types";
import Call "mo:ic/Call";

// Build `request : IC.HttpRequestArgs` exactly as in the https-outcalls skill,
// with the transform query on THIS canister. Call.httpRequest asks the cost API,
// which returns 0 on an engine, so nothing is attached.
let response = await Call.httpRequest(request);
```

- **Keep the wrapper; never swap in a hardcoded fee** (Rule 1). `ic_cdk::management_canister::http_request` behaves the same way in Rust. This is how outcalls are written in engine apps running today.
- Everything else about outcalls is unchanged — transform function on your own canister, `max_response_bytes`, idempotency. Engines support the **full** outcall feature set per the platform team, replicated or not, so `is_replicated = ?false` is available for non-idempotent or rate-limited APIs — and for bulk workloads, where a replicated call multiplies every request by the replica count. Load the `https-outcalls` skill for those.
- **Never route HTTPS outcalls through the console proxy canister.** The platform team is explicit: all HTTP outcalls should be direct, and the proxy exists only for mainnet services that require cycles. The IC requires the transform function to live on the canister that issues `http_request` — behind the proxy that is the proxy itself, and the proxy exposes no transform method (verified against its live interface, and the team confirms none is planned). Untransformed responses differ across replicas for most real APIs, and the call fails with:

  ```
  SYS_TRANSIENT: No consensus could be reached. Replicas had different responses
  ```

  A proxied outcall also **pays**. The proxy sits on a normal Application subnet, so it is charged the real outcall fee out of the balance you funded, while the same call issued from your engine canister is charged nothing. At migration scale — thousands of calls — that balance drains and every call starts failing with `ProxyError::InsufficientCycles`. That is a symptom of proxying outcalls, not of an under-funded engine.

  Both failures have the same fix: issue the outcall directly from your canister (free, works). Neither is fixed by retries or by topping the proxy up.

## Rule 4 — Cross-subnet cycle-bearing calls via the console proxy

Two separate facts land in the same place. The Rule 2 restriction means an engine canister **cannot** send a cross-subnet message carrying cycles — and, per the platform team, **cloud engines do not provide threshold signing at all**, so those facilities have to be reached on mainnet. Either way the call cannot be made directly:

- **threshold ECDSA / Schnorr** signing (`sign_with_ecdsa`, `sign_with_schnorr`) and their public-key methods, and **vetKD** (`vetkd_derive_key`, `vetkd_public_key`) — not available on an engine; use mainnet's via the proxy,
- the **exchange-rate canister** (XRC) — a mainnet canister that charges cycles,
- any other canister that must be called **with cycles** across a subnet boundary.

This is the proxy's entire purpose: reaching mainnet services that require cycles. It is **not** for HTTPS outcalls (Rule 3).

The workaround is the **console proxy canister**: deployed on a normal Application subnet and funded with cycles. Your engine canister makes a cheap, cycle-less, bounded-wait call to the proxy, which re-issues it locally **with the cycles attached** and relays the raw reply back. Same-subnet or cycle-less calls do **not** need it — and neither do HTTPS outcalls (Rule 3).

### Deploy and fund the proxy (from the console, not the CLI)

1. Open the engine console → **Applications** (App Center) → **Proxy canisters**.
2. **Deploy a proxy**, choose an initial balance (minimum $5), and optionally enable **automatic top-up** to recharge from the saved card when it runs low. You can top up manually or delete the proxy later from the same table.
3. Copy the **proxy canister id** shown in the table — the app calls this id.

The proxy authorizes callers whose principal falls in **the engine's canister-id range**, so every canister deployed to the engine may use it with no extra configuration.

### Call through the proxy from your canister

Instead of calling the target canister directly, call the proxy's `proxy` method with the target id, method name, candid-encoded argument bytes, and the cycles to attach. Its candid interface:

```candid
type ProxyArgs = record { canister_id : principal; method : text; args : blob; cycles : nat };
type ProxySucceed = record { result : blob };
type ProxyError = variant {
  InsufficientCycles : record { available : nat; required : nat };
  CallFailed : record { reason : text };
  UnauthorizedUser;
};
type ProxyResult = variant { Ok : ProxySucceed; Err : ProxyError };
service : {
  proxy : (ProxyArgs) -> (ProxyResult);
  get_allowed_ranges : () -> (vec record { start : principal; end : principal }) query;
};
```

- `args` is the **candid-encoded argument of the _target_ method** (you encode it); `result` is the target's **raw reply bytes** (you decode it).
- `cycles` is what the proxy attaches to the relayed call — size it to what the target charges (e.g. the XRC or signing fee). The platform team confirms the **caller** chooses how much the proxy attaches, and the proxy receives `args` as an **opaque blob**, so it cannot size the amount for you: a constant you pass is exactly what it will require, and the `required` field of `InsufficientCycles` echoes your own number back rather than reporting a proxy-side reservation. Do **not** attach cycles to the outer `proxy` call itself; the engine subnet forbids that and it is unnecessary.
- Handle `ProxyError`: `InsufficientCycles` means the proxy's balance is too low (top it up in the console), `UnauthorizedUser` means the caller is outside the engine's range, `CallFailed` carries the downstream reject reason.

Motoko sketch (Rust is analogous with `candid::encode_one` / `decode_one`):

```motoko
// `proxy` is an actor typed to the candid interface above.
let arg = to_candid (request);                    // encode the TARGET method's argument
let res = await (with timeout = 30) proxy.proxy({
  canister_id = xrcPrincipal;
  method = "get_exchange_rate";
  args = arg;
  cycles = 1_000_000_000;                         // the XRC fee the proxy forwards
});
switch (res) {
  case (#Ok { result }) { let ?reply = from_candid (result) else return; /* … */ };
  case (#Err e) { /* InsufficientCycles | CallFailed | UnauthorizedUser */ };
};
```

### Threshold keys through the proxy (read this before deriving keys)

For the management-canister key methods (`sign_with_ecdsa`, `ecdsa_public_key`, `sign_with_schnorr`, `schnorr_public_key`, `vetkd_derive_key`, `vetkd_public_key`), the proxy **isolates the derivation per calling canister**: it prefixes the caller's (unforgeable) principal into the `derivation_path` (ECDSA/Schnorr) or `context` (vetKD), and forces `canister_id = None` on the `*_public_key` calls. Two consequences:

- Each engine canister behind the proxy gets its **own** key namespace — one canister cannot read or sign with another's key.
- The key/address obtained **through the proxy differs** from what a direct management-canister call would give (the injected prefix changes the derivation). Always fetch the public key and sign **through the same proxy**, consistently, so the address you derive matches the key you can sign for. Do not mix direct and proxied key calls for one identity.

## Common Pitfalls

1. **Attaching a cycles amount to a call you write.** A `(with cycles = N)` clause on an inter-canister call from an engine canister is never needed, and any non-zero `N` fails with `IC0504` / `is out of cycles` (verified live). Remove the clause entirely rather than setting `cycles = 0`: a zero is accepted, so it hides the mistake instead of fixing the habit. Nothing an engine canister does needs cycles: outcall, signing, and messaging fees are all zero under the engine's free cost schedule.
2. **Unbounded-wait cross-subnet calls.** A plain `await service.method(args)` to a canister on another subnet is unbounded-wait and is rejected with "Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets". Use `(with timeout = N)` in Motoko or `Call::bounded_wait` in Rust — and handle `SYS_UNKNOWN`. Same-subnet (engine-local) calls are exempt.
3. **Rewriting outcall code for an engine — or hardcoding its fee.** Outcalls need no engine-specific form: keep `Call.httpRequest` (Motoko) or `ic_cdk::management_canister::http_request` (Rust), because the `ic0.cost_*` API they consult is cost-schedule aware and returns 0 on an engine. The mistake is replacing that call with a hand-computed fee from an Application-subnet cost table, which attaches a non-zero amount against a 0 balance.
4. **Routing HTTPS outcalls through the console proxy.** Two different failures, one cause. Consensus: `SYS_TRANSIENT: No consensus could be reached. Replicas had different responses`, because the transform must live on the calling canister — behind the proxy that is the proxy itself, and it exposes none (nor is one planned). Cost: the proxy is on a normal Application subnet, so it pays the real outcall fee from the balance you funded, and a bulk workload drains it into `ProxyError::InsufficientCycles`. Issue outcalls directly from your canister instead: on an engine they are free and unmetered, so no budget exists to exhaust.
5. **Topping up an engine canister with cycles.** Engine canisters hold 0 cycles by design; you cannot and need not send cycles to them. A "0 cycles" reading from an engine canister is normal, not an emergency — do not add top-up logic or cycles-balance alarms ported from Application-subnet apps.
6. **Calling the XRC / threshold signing / vetKD directly from an engine canister.** Cloud engines do not provide threshold signing at all (platform team), so `sign_with_ecdsa` / `sign_with_schnorr` / vetKD must be reached on mainnet — and a cross-subnet, cycle-bearing call is exactly what a CloudEngine-subnet canister cannot send. Route them through the funded console proxy (Rule 4). Plain same-subnet or cycle-less calls do not need the proxy.
7. **Attaching cycles to the outer `proxy` call.** The engine subnet forbids cycle-bearing cross-subnet messages — that is the whole reason for the proxy. Put the cycles inside `ProxyArgs.cycles` (the proxy attaches them locally); never `with cycles` on the call to `proxy` itself.
8. **Topping up the proxy without first asking what it was relaying.** On `ProxyError::InsufficientCycles`, check the call type before treating it as a funding problem. **An HTTPS outcall does not belong on the proxy at all** (Rule 3, pitfall 4): move it onto your own canister, where it is free, rather than buying budget for work that should cost nothing — raising the balance only delays the same stall. A drained balance is a genuine funding problem only for the proxy's real jobs (XRC, threshold signing, vetKD): top it up, or enable auto top-up, on the console's Proxy canisters page. Deploying and funding the proxy is a console action, not an `icp` command.
9. **Expecting a direct-call key through the proxy.** Threshold-key derivation via the proxy is caller-isolated, so the derived key/address is not the same as a direct management-canister call. Fetch the public key and sign through the proxy consistently; do not mix direct and proxied key calls for the same identity.

## Related Skills

If a referenced skill is not already available, install it the same way this one was installed — `npx skills add dfinity/icskills --skill <name>` — or read it at `https://skills.internetcomputer.org/skills/<name>/`.

- **deploy-to-cloud-engine** — getting the app onto the engine: CLI identity linking, subnet-targeted deploy, console app metadata.
- **https-outcalls** — everything about outcalls that is not engine-specific: transform functions, `max_response_bytes`, idempotency, debugging consensus failures.
- **multi-canister** — inter-canister call design, bounded vs unbounded wait semantics, and `SYS_UNKNOWN` handling.
