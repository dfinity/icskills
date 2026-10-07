---
name: buy-cycles
description: "Buy cycles with a credit card for the CLI's own identity through an on-chain cycles gateway (`icp cycles buy`), then continue deploying. Use when a deploy or canister creation fails for lack of cycles, the user has no ICP, no wallet or no exchange account, or asks to pay for cycles by card, Stripe, fiat or USD. Do NOT use for converting ICP you already hold (cycles-management: `icp cycles mint`), for topping up a canister from an existing balance, or for Internet Identity sign-in (agent-web-identity)."
license: Apache-2.0
compatibility: "icp-cli >= 1.5.0 (fallback via `icp canister call`); `icp cycles buy` once released. A human with a browser on any device to pay."
metadata:
  title: Buy Cycles With a Card
  category: Infrastructure
---

# Buy Cycles With a Card

## What This Is

A cycles gateway is a canister that sells cycles from a reserve it already holds and
takes payment by card through Stripe Checkout. The **CLI identity is the buyer**: the
identity that will run `icp deploy` calls the gateway itself, so the cycles land on that
identity's own cycles-ledger account and nothing has to be linked, signed in or
transferred afterwards. The agent's job is to create the order, hand the payment URL to
the human, wait for delivery, and then carry on with the deploy.

The reference gateway is CyclePay. Mainnet backend canister:
`saz2a-riaaa-aaaay-aadha-cai`. It is fully on-chain (no server); the price is derived
from two on-chain rates (XRC and CMC) and the cycle quantity is locked when the order is
created. Card data never touches the canister or the CLI: the buyer pays on Stripe's
hosted page.

## Prerequisites

- `icp` CLI installed (https://cli.internetcomputer.org). Load the `icp-cli` skill for
  general usage and flag rules.
- An `icp` identity for the project. The one that buys must be the one that deploys.
- A human who can open a URL on **some** device (laptop, phone). The agent's machine
  needs no browser.
- Mainnet: `-n ic` for `icp cycles` commands (they take no canister argument). Load
  `cycles-management` for the `-n` vs `-e` rule.

## The Flow

```bash
# 1. Who is buying, and what do they hold now
icp identity principal --identity "$ID"
icp cycles balance -n ic --identity "$ID"

# 2. Buy: quote, confirm with the user, create the order, print the URL, wait
icp cycles buy --usd 10 -n ic --identity "$ID" --json
#    → {"order_id":"…","checkout_url":"https://checkout.stripe.com/c/pay/cs_…", "locked_cycles":"7238461538461", …}
#    Show checkout_url to the user VERBATIM and ask them to pay (test card in a sandbox: 4242 4242 4242 4242).
#    The command keeps polling and ends with {"status":"delivered", …}.

# 3. Continue
icp cycles balance -n ic --identity "$ID"
icp deploy -e ic --identity "$ID"
```

If the wait was interrupted, resume rather than buy again:

```bash
icp cycles buy --resume "$ORDER_ID" -n ic --identity "$ID" --json
```

### Before `icp cycles buy` ships: the same flow with `icp canister call`

Validated against the gateway on 2026-10-07. Use it only when `icp cycles buy` is not in
the installed CLI (`icp cycles --help` lists the subcommands).

```bash
GW=saz2a-riaaa-aaaay-aadha-cai
ME=$(icp identity principal --identity "$ID")
CENTS=1000                                   # $10.00

# Quote. `cycles = null` means the gateway cannot price right now; do not create an order.
icp canister call "$GW" quote_previews "(vec { $CENTS : nat })" -n ic --query

# Create. Destination MUST be the caller's own default account (subaccount = null).
# minCycles pins 95% of the quoted figure so a worse rate is refused, not delivered.
icp canister call "$GW" create_order \
  "(variant { custom = $CENTS : nat },
    variant { cyclesLedgerAccount = record { owner = principal \"$ME\"; subaccount = null } },
    opt ($MIN_CYCLES : nat))" -n ic --identity "$ID"
# The reply carries `id = "<order id>"` and `stripeSessionUrl = opt "https://checkout.stripe.com/…"`.

# Wait: poll until status is delivered / expired / cancelled / needsReview.
icp canister call "$GW" get_order "(\"$ORDER_ID\")" -n ic --query --identity "$ID" \
  | grep -oE 'status = variant \{ [a-zA-Z]+'
```

To extract the URL from the Candid text, take the quoted string after `stripeSessionUrl
= opt` **unchanged**: `grep -oE 'stripeSessionUrl = opt "[^"]+"' | sed -E 's/.*"(.*)"/\1/'`.
See Pitfall 2 before writing any other parsing.

## Common Pitfalls

1. **Cycles go to the buyer's own cycles-ledger account and nowhere else.** The gateway
   refuses any other destination with `destinationNotOwned`, and refuses an all-zero
   subaccount too: pass `subaccount = null`. There is no "send to my canister" option.
   After delivery, fund a canister with `icp canister top-up <canister> --amount <N> -e ic`
   or let `icp deploy -e ic` create canisters from the ledger balance. `icp cycles
   transfer` to a canister principal credits that principal's *ledger* balance, not the
   canister's execution balance (see `cycles-management`).

2. **Never "clean up" the Candid text the URL arrives in.** Candid prints numbers with
   underscore separators (`7_238_461_538_461`), and a regex that strips underscores
   turns `cs_test_a13Zw…` into `cstesta13Zw…`, a dead link the user cannot pay. Prefer
   `--json`; in the fallback, extract the quoted URL string exactly and strip
   underscores only from values that are all digits.

3. **The agent cannot pay, and usually cannot open a browser.** Always print the URL and
   ask the human to open it; they may use another device. Never ask for or type card
   details. Never pass `--yes` without having shown the user the amount and the cycle
   quantity first: `create_order` reserves cycles and opens a 35-minute payable session.

4. **One open order per principal.** A second `create_order` while one is payable is
   refused with `notAdmitted(tooManyOpenOrders)`. Do not loop on it: find the open order
   (it is the one whose status is `created`), resume waiting on it, or `cancel_order` it
   first.

5. **`paid` is not stuck, and `needsReview` is not yours to fix.** `paid` means the card
   was charged and the ledger transfer is being retried by the gateway; never create a
   new order from that state. `needsReview` means the transfer's outcome is unknown and
   a gateway operator has to resolve it: tell the user their card was charged and the
   order id, and stop.

6. **`quoteChanged { quoted; minimum }` is a refusal, not a delivery.** The pinned
   minimum protects the buyer when the rate moves against them between quote and
   creation. Re-quote, show the new figure, get a fresh confirmation, then create again.
   A move in the buyer's favour passes through and they keep the extra cycles.

7. **A gateway in simulation mode sells only to allow-listed principals.** The reply is
   `notAdmitted(buyerNotAllowed)` (or `unboundedGiveaway` when the list is empty). The
   buyer cannot fix this; report it and name the principal so a gateway controller can
   allow-list it. Simulation also scales the delivered quantity by a divisor the gateway
   publishes in `pricing_status`.

8. **Buy and deploy as the same identity.** `icp deploy` spends the *default* identity's
   ledger balance unless `--identity` is passed. A purchase made as one identity and a
   deploy run as another fails with insufficient cycles while the balance sits one
   identity over. Pass `--identity "$ID"` on every command, or check `icp identity
   default` first.

9. **The session expires after 35 minutes**, set by Stripe. An unpaid order ends as
   `expired` and the reserved cycles are released; nothing was charged. Start over with
   a new order rather than reusing the URL.

10. **Delivery is net of the ledger deposit fee.** 100 M cycles of the locked quantity
    is the cycles ledger's own deposit fee, so `icp cycles balance` shows
    `lockedCycles − 100_000_000`. That is not a short delivery.

11. **`-n ic` for `icp cycles …` and `icp canister call <principal>`; `-e ic` for commands
    that take a canister *name*.** Mixing them fails with a "specify an environment"
    error. Load `icp-cli` for the full rule.

## Verify It Works

```bash
icp cycles balance -n ic --identity "$ID"     # equals lockedCycles − 100_000_000 after a first purchase
icp canister call saz2a-riaaa-aaaay-aadha-cai get_order "(\"$ORDER_ID\")" -n ic --query --identity "$ID" \
  | grep -E 'status|paidUsdCents'             # status = variant { delivered }; paidUsdCents = opt (1_000 : nat)
```

The buyer can audit the price: `receipt(orderId)` returns both rate inputs
(`usdPerIcpMicros`, `xdrPermyriadPerIcp`) so the cycle quantity recomputes from canisters
they can query themselves.

## Security Rules for Agents

- Confirm the USD amount and the quoted cycle quantity with the user before
  `create_order`; it reserves cycles and opens a payable session.
- Hand over the checkout URL and stop. Do not attempt to automate the payment page.
- Never collect, store or echo card details; the hosted Stripe page is the only place
  they are entered.
- Treat the order id as a reference, not a secret: it travels in Stripe's
  `client_reference_id`.
- When a purchase ends in `needsReview`, report the order id and the charge to the user
  and do not retry.
