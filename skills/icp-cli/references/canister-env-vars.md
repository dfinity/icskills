# Reading Canister Environment Variables at Runtime

`icp deploy` injects `PUBLIC_CANISTER_ID:<canister-name>` for every canister in the environment into every canister's settings (SKILL.md § Canister Environment Variables). Reading them from canister code:

## Motoko

Requires motoko-core v2.1.0+. `Runtime.envVar` needs the `<system>` capability and returns `?Text`:

```motoko
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

func bridgePrincipal() : ?Principal {
  switch (Runtime.envVar<system>("PUBLIC_CANISTER_ID:bridge")) {
    case (?id) { ?Principal.fromText(id) };
    case null { null };
  };
};
```

## Rust

```rust
let id = ic_cdk::api::env_var_value("PUBLIC_CANISTER_ID:other_canister");
```

## Read lazily, not at init

Read the variable at call time rather than caching it during canister initialization:

- **First install:** a sibling canister may not exist yet when this canister initializes; the variable is present once the full `icp deploy` completes.
- **Reinstall:** a pointer stored in canister state (e.g. via a setter method) is wiped by `--mode reinstall`, while the automatic variables are re-stamped with the correct IDs on every deploy — lazy reads self-heal.
