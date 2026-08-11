---
name: cloud-engine-canisters
description: "Rules for canister code that runs on a cloud engine (a CloudEngine subnet, e.g. an OpenCloud engine). Engines are free and their canisters hold 0 cycles: never attach cycles — remove `(with cycles = …)` clauses and cycle-attaching wrappers like mo:ic `Call.httpRequest` (fails with IC0504). Cross-subnet calls must be bounded-wait and cycle-free (`(with timeout = N)` in Motoko, `Call::bounded_wait` in Rust) or they are rejected: 'Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets'. HTTPS outcalls work called directly with no cycles; never via the console proxy — no transform can apply there, so consensus fails ('Replicas had different responses'). Cycle-bearing cross-subnet targets (exchange-rate XRC, threshold ECDSA/Schnorr, vetKD) go through the engine's proxy canister. Use when writing or debugging canister code for a cloud engine app, or on any of these errors. Do NOT use for deploying to an engine (deploy-to-cloud-engine) or outcalls on normal subnets (https-outcalls)."
license: Apache-2.0
compatibility: "A cloud engine (CloudEngine subnet) to run on; Motoko examples need moc >= 1.0.0 (parenthetical `(with …)` call attributes), Rust examples need ic-cdk >= 0.18 (bounded-wait Call API)"
metadata:
  title: Cloud Engine Canisters
  category: Infrastructure
---

# Cloud Engine Canisters

## What This Is

A **cloud engine** is a user-owned slice of Internet Computer capacity, administered from a web console (see the `deploy-to-cloud-engine` skill for getting code onto one). Engines run on a dedicated **`CloudEngine` subnet type** with a **free cycles cost schedule**: nothing an engine canister does is metered in cycles — execution, storage, messaging, and HTTPS outcalls all cost zero — and engine canisters hold a **0 cycles balance by design**.

That model comes with protocol-enforced call rules. Code that works on a normal Application subnet can fail on an engine, and the failures look like cycles or consensus problems rather than what they are: code written for the wrong subnet type. The rules:

| Rule | On a cloud engine |
|------|-------------------|
| 1 | **Never attach cycles** to any call — remove `(with cycles = …)` and cycle-attaching wrappers |
| 2 | **Cross-subnet calls must be bounded-wait** — `(with timeout = N)` in Motoko, `Call::bounded_wait` in Rust |
| 3 | **HTTPS outcalls: call `http_request` directly**, with no cycles, transform on your own canister — never through the proxy |
| 4 | **Cycle-bearing cross-subnet targets** (XRC, threshold signing, vetKD) go **through the console proxy canister** |

## Rule 1 — Never attach cycles

Engine canisters hold 0 cycles and there is nothing to pay for: under the engine's free cost schedule, every fee an Application-subnet canister would pay (execution, message transmission, HTTPS outcalls, threshold signing, storage) evaluates to zero. Attaching cycles is therefore never needed — and it fails, because the balance the attachment would be withdrawn from is 0 (observed as `IC0504` errors from engine canisters).

- **Motoko:** remove the parenthetical clause entirely — write `await service.method(args)`, not `await (with cycles = 1_000_000) service.method(args)`. Do not "fix" a failing call by setting `cycles = 0`: the engine team's guidance is that the clause must go entirely.
- **Rust:** do not use `.with_cycles(…)` on `Call` builders.
- Do not compute fees (e.g. from the fee formulas in the `https-outcalls` skill) and attach them — those formulas describe Application subnets.
- The one exception: cycles that a **cross-subnet target** charges are placed *inside* `ProxyArgs.cycles` of the console proxy (Rule 4), never attached to a call your canister sends.

## Rule 2 — Cross-subnet calls must be bounded-wait

The protocol rejects any cross-subnet (XNet) request **from or to** a CloudEngine subnet that is unbounded-wait (guaranteed-response) or carries cycles. The caller gets a reject with exactly this text:

```
Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets
```

Make every cross-subnet call bounded-wait and cycle-free:

```motoko
// Motoko: `timeout : Nat32` is in seconds
let result = await (with timeout = 30) service.method(args);
```

```rust
// Rust, ic-cdk >= 0.18
let result = Call::bounded_wait(canister_id, "method").with_arg(&arg).await?;
```

- **Same-subnet calls are exempt**: canisters on the same engine may call each other unbounded-wait. Bounded-wait is still the better default — an unbounded-wait call to an unresponsive callee blocks the caller's upgrades indefinitely (see the `multi-canister` skill).
- The restriction applies in **both directions**: a canister on a normal subnet calling *into* an engine canister must also use a bounded-wait, cycle-free call.
- A bounded-wait call can complete with `SYS_UNKNOWN` (outcome unknown). Handle it — the `multi-canister` skill covers the patterns.

## Rule 3 — HTTPS outcalls: call directly, with no cycles

HTTPS outcalls execute on the engine's own subnet and are free there. Call the management canister's `http_request` directly and attach nothing:

```motoko
import IC "ic:aaaaa-aa";

// request : IC.http_request_args — build it exactly as in the https-outcalls skill,
// with the transform query on THIS canister. The only engine difference: call plainly.
let response = await IC.http_request(request);
```

- **Do not use the cycle-attaching wrappers** recommended for normal subnets. mo:ic's `Call.httpRequest(args)` expands to `(with cycles = …) IC.ic.http_request(args)` — on an engine, make the plain call above instead. (In Rust, `ic_cdk::management_canister::http_request` computes the fee via the cost API, which returns zero on an engine; never add explicit cycles on top.)
- Everything else about outcalls is unchanged — transform function on your own canister, `max_response_bytes`, idempotency, `is_replicated = ?false` for non-idempotent or rate-limited APIs. Load the `https-outcalls` skill for those.
- **Never route HTTPS outcalls through the console proxy canister.** The IC requires the transform function to live on the canister that issues `http_request` — behind the proxy that is the proxy itself, and the proxy exposes no transform method (verified against its live interface). Untransformed responses differ across replicas for most real APIs, and the call fails with:

  ```
  SYS_TRANSIENT: No consensus could be reached. Replicas had different responses
  ```

  If you see this error from a proxied outcall, the fix is to issue the outcall directly from your canister (free, works) — not to add retries.

## Rule 4 — Cross-subnet cycle-bearing calls via the console proxy

The IC protocol restriction from Rule 2 means an engine canister **cannot** send a cross-subnet message that carries cycles. So it cannot directly call targets that live on other subnets and charge cycles:

- the **exchange-rate canister** (XRC),
- **threshold ECDSA / Schnorr** signing (`sign_with_ecdsa`, `sign_with_schnorr`) and their public-key methods,
- **vetKD** (`vetkd_derive_key`, `vetkd_public_key`),
- any other canister that must be called **with cycles** across a subnet boundary.

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
- `cycles` is what the proxy attaches to the relayed call — size it to what the target charges (e.g. the XRC or signing fee). Do **not** attach cycles to the outer `proxy` call itself; the engine subnet forbids that and it is unnecessary.
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

1. **Attaching cycles to any call.** `(with cycles = …)` from an engine canister fails — the balance is 0 and stays 0 (observed as `IC0504` errors). Remove the clause entirely; do not keep it with `cycles = 0`. Nothing an engine canister does needs cycles: outcall, signing, and messaging fees are all zero under the engine's free cost schedule.
2. **Unbounded-wait cross-subnet calls.** A plain `await service.method(args)` to a canister on another subnet is unbounded-wait and is rejected with "Unbounded-wait calls and calls with cycles are not allowed to CloudEngine subnets". Use `(with timeout = N)` in Motoko or `Call::bounded_wait` in Rust — and handle `SYS_UNKNOWN`. Same-subnet (engine-local) calls are exempt.
3. **Using cycle-attaching outcall wrappers on an engine.** mo:ic's `Call.httpRequest` attaches computed cycles — exactly what Rule 1 forbids. Call `IC.http_request(request)` directly (`import IC "ic:aaaaa-aa"`), with no parenthetical.
4. **Routing HTTPS outcalls through the console proxy.** Fails for most APIs with `SYS_TRANSIENT: No consensus could be reached. Replicas had different responses` — no transform can be applied because the transform must live on the calling canister, which behind the proxy is the proxy itself, and it exposes none. Issue outcalls directly from your canister: on an engine they are free.
5. **Topping up an engine canister with cycles.** Engine canisters hold 0 cycles by design; you cannot and need not send cycles to them. A "0 cycles" reading from an engine canister is normal, not an emergency — do not add top-up logic or cycles-balance alarms ported from Application-subnet apps.
6. **Calling the XRC / threshold signing / vetKD directly from an engine canister.** These are cross-subnet, cycle-bearing calls, which a CloudEngine-subnet canister cannot make — the call is rejected. Route them through the funded console proxy (Rule 4). Plain same-subnet or cycle-less calls do not need the proxy.
7. **Attaching cycles to the outer `proxy` call.** The engine subnet forbids cycle-bearing cross-subnet messages — that is the whole reason for the proxy. Put the cycles inside `ProxyArgs.cycles` (the proxy attaches them locally); never `with cycles` on the call to `proxy` itself.
8. **Proxy out of cycles, or funded from the CLI.** A `ProxyError::InsufficientCycles` means the proxy's balance is spent — top it up (or enable auto top-up) on the console's Proxy canisters page. Deploying and funding the proxy is a console action, not an `icp` command.
9. **Expecting a direct-call key through the proxy.** Threshold-key derivation via the proxy is caller-isolated, so the derived key/address is not the same as a direct management-canister call. Fetch the public key and sign through the proxy consistently; do not mix direct and proxied key calls for the same identity.

## Related Skills

If a referenced skill is not already available, install it the same way this one was installed — `npx skills add dfinity/icskills --skill <name>` — or read it at `https://skills.internetcomputer.org/skills/<name>/`.

- **deploy-to-cloud-engine** — getting the app onto the engine: CLI identity linking, subnet-targeted deploy, console app metadata.
- **https-outcalls** — everything about outcalls that is not engine-specific: transform functions, `max_response_bytes`, idempotency, debugging consensus failures.
- **multi-canister** — inter-canister call design, bounded vs unbounded wait semantics, and `SYS_UNKNOWN` handling.
