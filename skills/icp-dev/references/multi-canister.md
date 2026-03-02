# Multi-Canister Architecture

Splitting an IC application across multiple canisters for scaling, separation of concerns, or independent upgrade cycles. Each canister has its own state, cycle balance, and upgrade path. Canisters communicate via async inter-canister calls.

## Mistakes That Break Your Build

1. **Request and response payloads are limited to 2 MB.** Because any canister call may be required to cross subnet boundaries; and cross-subnet (or XNet) messages (the request and response corresponding to each canister call) are inducted in (packaged into) 4 MB blocks; canister request and response payloads are limited to 2 MB. A call with a request payload above 2 MB will fail synchronously; and a response with a payload above 2 MB will trap. Chunk larger payloads into 1 MB chunks (to allow for any encoding overhead) and deliver them over multiple calls (e.g. chunked uploads or byte range queries).

2. **Update methods that make calls are NOT executed atomically.** When an update method makes a call, the code before the `await` is one atomic message execution (i.e. the ingress message or canister request that invoked the update method); and the code after the `await` is a separate atomic message execution (the response to the call). In particular, if the update method traps after the `await`, any mutations before the `await` have already been persisted; and any mutations after the `await` will be rolled back. Design for eventual consistency or use a saga pattern.

3. **Unbounded wait calls may prevent canister upgrades, indefinitely.** Unbounded wait calls may take arbitrarily long to complete: a malicious or incorrect callee may spin indefinitely without producing a response. Canisters cannot be stopped while awaiting responses to outstanding calls. Bounded wait calls avoid this issue by making sure that calls complete in a bounded time, independent of whether the callee responded or not.

4. **Use idempotent APIs. Or provide a separate endpoint to query the outcome of a non-idempotent call.** If a call to a non-idempotent API times out, there must be another way for the caller to learn the outcome of the call (e.g. by attaching a unique ID to the original call and querying for the outcome of the call with that unique ID). Without a way to learn the outcome, when the caller receives a `SYS_UNKNOWN` response it may be unable to decide whether to continue, retry the call or abort.

5. **Calls across subnet boundaries are slower than calls on the same subnet.** Under light subnet load, a call to a canister on the same subnet may complete and its response may be processed by the caller within a single round. The call latency only depends on how frequently the caller and callee are scheduled (which may be multiple times per round). A cross canister call requires 2-3 rounds either way (request delivery and response delivery), plus scheduler latency.

6. **Calls across subnet boundaries have relatively low bandwidth.** Cross-subnet (or XNet) messages are inducted in (packaged into) 4 MB blocks once per round, along with any ingress messages and other XNet messages. Expect multiple MBs of messages to take multiple rounds to deliver, on top of the XNet latency. (Subnet-local messages are routed within the subnet, so they don't suffer from this bandwidth limitation).

7. **Defensive practice: bind `msg_caller()` before `.await` in Rust.** The current ic-cdk executor preserves caller across `.await` points via protected tasks, but capturing it early guards against future executor changes. **Motoko is safe:** `public shared ({ caller }) func` captures `caller` as an immutable binding at function entry.

    ```rust
    // Recommended (Rust) — capture caller before await:
    #[update]
    async fn do_thing() {
        let original_caller = ic_cdk::api::msg_caller(); // Defensive: capture before await
        let _ = some_canister_call().await;
        let who = original_caller; // Safe
    }
    ```

8. **Not handling rejected calls.** Inter-canister calls can fail (callee trapped, out of cycles, canister stopped). In Motoko use `try/catch`. In Rust, handle the `Result` from `ic_cdk::call`. Unhandled rejections trap your canister.

9. **Deploying canisters in the wrong order.** Canisters with dependencies must be deployed according to their dependencies. Declare `dependencies` in icp.yaml so `icp deploy` orders them correctly.

10. **Forgetting to generate type declarations for each backend canister.** Use language-specific tooling (e.g., `didc` for Candid bindings) to generate declarations for each backend canister individually.

11. **Shared types diverging between canisters.** If canister A expects `{ id: Nat; name: Text }` and canister B sends `{ id: Nat; title: Text }`, the call silently fails or traps. Use a shared types module imported by both canisters.

12. **Canister factory without enough cycles.** Creating a canister requires cycles. The management canister charges for creation and the initial cycle balance. If you do not attach enough cycles, creation fails.

13. **`canister_inspect_message` is not called for inter-canister calls.** It only runs for ingress messages (from external users). Do not rely on it for access control between canisters. Use explicit principal checks instead.

14. **Not setting up `#[init]` and `#[post_upgrade]` in Rust.** Without a `post_upgrade` handler, canister upgrades may behave unexpectedly. Always define both.

## Key Patterns

### Motoko

```motoko
import UserService "canister:user_service";
import Error "mo:core/Error";
import Principal "mo:core/Principal";
import Result "mo:core/Result";

persistent actor {

  // Inter-canister call with caller capture and error handling
  public shared ({ caller }) func createPost(title : Text, body : Text) : async Result.Result<Text, Text> {
    let originalCaller = caller; // Safe in Motoko: immutable binding at entry

    if (Principal.isAnonymous(originalCaller)) {
      return #err("Unauthorized");
    };

    let isValid = try {
      await UserService.isValidUser(originalCaller)
    } catch (e : Error.Error) {
      return #err("User service unavailable: " # Error.message(e));
    };

    if (not isValid) { return #err("Unauthorized") };

    #ok("Post created")
  };
};
```

### Rust

```rust
use candid::Principal;
use ic_cdk::call::Call;
use ic_cdk::update;

#[update]
async fn create_post(title: String, body: String) -> Result<String, String> {
    // Defensive: capture caller before any await
    let original_caller = ic_cdk::api::msg_caller();

    if original_caller == Principal::anonymous() {
        return Err("Unauthorized".to_string());
    }

    let user_service = get_user_service_id(); // Principal stored at init
    let (is_valid,): (bool,) = Call::unbounded_wait(user_service, "is_valid_user")
        .with_arg(original_caller)
        .await
        .map_err(|e| format!("User service call failed: {:?}", e))?
        .candid_tuple()
        .map_err(|e| format!("Failed to decode response: {:?}", e))?;

    if !is_valid {
        return Err("User not registered".to_string());
    }

    Ok("Post created".to_string())
}
```

### icp.yaml — Declaring Dependencies

```yaml
canisters:
  user_service:
    type: motoko
    main: src/user_service/main.mo
  content_service:
    type: motoko
    main: src/content_service/main.mo
    dependencies:
      - user_service
```
