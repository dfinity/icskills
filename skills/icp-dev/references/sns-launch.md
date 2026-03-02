# SNS DAO Launch

Service Nervous System (SNS) is the DAO framework for decentralizing Internet Computer dapps. Launching an SNS transfers canister control from developers to a community-owned governance system through a decentralization swap.

## Canister IDs

| Canister | Mainnet ID | Purpose |
|----------|-----------|---------|
| NNS Governance | `rrkah-fqaaa-aaaaa-aaaaq-cai` | Votes on SNS creation proposals |
| SNS-W (Wasm Modules) | `qaa6y-5yaaa-aaaaa-aaafa-cai` | Deploys and initializes SNS canisters |
| NNS Root | `r7inp-6aaaa-aaaaa-aaabq-cai` | Must be co-controller of dapp before launch |
| ICP Ledger | `ryjl3-tyaaa-aaaaa-aaaba-cai` | Handles ICP token transfers during swap |

SNS-W deploys these canisters on success:

| Canister | Purpose |
|----------|---------|
| **Governance** | Proposal submission, voting, neuron management |
| **Ledger** | SNS token transfers (ICRC-1 standard) |
| **Root** | Sole controller of all dapp canisters post-launch |
| **Swap** | Runs the decentralization swap (ICP for SNS tokens) |
| **Index** | Transaction indexing for the SNS ledger |
| **Archive** | Historical transaction storage |

## Mistakes That Break Your Build

1. **Setting `min_participants` too high.** If you require 500 participants but only 200 show up, the entire swap fails and all ICP is refunded. Start conservative -- most successful SNS launches use 100-200 minimum participants.

2. **Forgetting to add NNS Root as co-controller before proposing.** The launch process requires NNS Root to take over your canisters. If you submit the proposal without adding it first, the launch will fail at stage 6 when SNS Root tries to become sole controller.

3. **Not testing on SNS testflight first.** Going straight to mainnet means discovering configuration issues after your NNS proposal is live. Always deploy a testflight mock SNS on mainnet first to verify governance and upgrade flows.

4. **Token economics that fail NNS review.** The NNS community votes on your proposal. Unreasonable tokenomics (excessive developer allocation, zero vesting, absurd swap caps) will get rejected. Study successful SNS launches (OpenChat, Hot or Not, Kinic) for parameter ranges the community accepts.

5. **Not defining fallback controllers.** If the swap fails, the dapp needs controllers to return control to. Without `fallback_controller_principals`, your dapp could become uncontrollable.

6. **Setting swap duration too short.** Users across time zones need time to participate. Less than 24 hours is risky -- 3-7 days is standard.

7. **Forgetting restricted proposal types during swap.** Six governance proposal types are blocked while the swap runs: `ManageNervousSystemParameters`, `TransferSnsTreasuryFunds`, `MintSnsTokens`, `UpgradeSnsControlledCanister`, `RegisterDappCanisters`, `DeregisterDappCanisters`.

8. **Developer neurons with zero dissolve delay.** Developers can immediately dump tokens post-launch. Set dissolve delays and vesting periods (12-48 months is typical) to signal long-term commitment.

## Key Patterns

### SNS Configuration (sns_init.yaml)

```yaml
name: MyProject
description: >
  A decentralized application for [purpose].
logo: logo.png
url: https://myproject.com

NnsProposal:
  title: "Proposal to create an SNS for MyProject"
  url: "https://forum.dfinity.org/t/myproject-sns-proposal/XXXXX"
  summary: >
    This proposal creates an SNS DAO to govern MyProject.

fallback_controller_principals:
  - YOUR_PRINCIPAL_ID_HERE

dapp_canisters:
  - BACKEND_CANISTER_ID
  - FRONTEND_CANISTER_ID

Token:
  name: MyToken
  symbol: MYT
  transaction_fee: 0.0001 tokens

Distribution:
  Neurons:
    - principal: DEVELOPER_PRINCIPAL
      stake: 2_000_000 tokens
      memo: 0
      dissolve_delay: 6 months
      vesting_period: 24 months
  InitialBalances:
    treasury: 5_000_000 tokens
    swap: 2_500_000 tokens
  total: 10_000_000 tokens

Swap:
  minimum_participants: 100
  minimum_direct_participation_icp: 50_000 tokens
  maximum_direct_participation_icp: 500_000 tokens
  minimum_participant_icp: 1 token
  maximum_participant_icp: 25_000 tokens
  duration: 7 days
  neurons_fund_participation: true
```

### Motoko

```motoko
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

persistent actor {
  var snsGovernanceId : ?Principal = null;

  public shared ({ caller }) func setSnsGovernance(id : Principal) : async () {
    assert (Principal.isController(caller));
    switch (snsGovernanceId) {
      case (null) { snsGovernanceId := ?id };
      case (?_) { Runtime.trap("SNS governance already set") };
    };
  };

  func requireGovernance(caller : Principal) {
    switch (snsGovernanceId) {
      case (?gov) {
        if (caller != gov) { Runtime.trap("Only SNS governance can call this") };
      };
      case (null) { Runtime.trap("SNS governance not configured") };
    };
  };

  public shared ({ caller }) func updateConfig(newFee : Nat) : async () {
    requireGovernance(caller);
    // ... apply config change
  };
};
```

### Rust

```rust
use candid::Principal;
use ic_cdk::update;
use std::cell::RefCell;

thread_local! {
    // WARNING: RefCell in thread_local! is heap -- wiped on upgrade.
    // Use ic-stable-structures in production.
    static SNS_GOVERNANCE: RefCell<Option<Principal>> = RefCell::new(None);
}

fn require_governance(caller: Principal) {
    SNS_GOVERNANCE.with(|g| {
        match *g.borrow() {
            Some(gov) if gov == caller => (),
            Some(_) => ic_cdk::trap("Only SNS governance can call this"),
            None => ic_cdk::trap("SNS governance not configured"),
        }
    });
}

#[update]
fn set_sns_governance(id: Principal) {
    if !ic_cdk::api::is_controller(&ic_cdk::api::msg_caller()) {
        ic_cdk::trap("Only canister controllers can set governance");
    }
    SNS_GOVERNANCE.with(|g| {
        let mut gov = g.borrow_mut();
        if gov.is_some() {
            ic_cdk::trap("SNS governance already set");
        }
        *gov = Some(id);
    });
}

#[update]
fn update_config(new_fee: u64) {
    require_governance(ic_cdk::api::msg_caller());
    // ... apply config change
}
```
