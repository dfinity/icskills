---
name: buy-cycles
description: "Buy cycles with a credit card for the CLI's own identity with `icp cycles buy`, through CyclePay's on-chain gateway, then continue deploying. Use when a mainnet deploy or canister creation fails for lack of cycles, the user has no ICP, no wallet or no exchange account, or asks to pay for cycles by card, Stripe, fiat or USD. Do NOT use for converting ICP you already hold (cycles-management: `icp cycles mint`), for topping up a canister from an existing balance, or for Internet Identity sign-in (agent-web-identity)."
license: Apache-2.0
compatibility: "icp-cli >= 1.7.0 for `icp cycles buy` (`icp --version`), or any icp-cli >= 1.0 for the `icp canister call` fallback. Mainnet only. A human with a browser on any device to pay."
metadata:
  title: Buy Cycles With a Card
  category: Infrastructure
---

# Buy Cycles With a Card

## What This Is

A cycles gateway is a canister that takes an order for cycles, has the buyer pay for it
by card on a hosted Stripe page, and delivers the cycles on-chain. `icp cycles buy` makes
the **CLI identity the buyer**: the identity that will run `icp deploy` creates the order
itself, so the cycles land on that identity's own cycles-ledger account and nothing has
to be linked, signed in or transferred afterwards. The agent's job is to quote, get the
human's yes, create the order, hand the payment link to the human, wait for delivery, and
carry on deploying. The human pays; the agent never does.

The default gateway is [CyclePay](https://www.cyclepay.org), run by the DFINITY
Foundation: backend canister `2bwus-iiaaa-aaaac-bee3a-cai`, **mainnet only**, USD only.
Everything the command quotes with is read from the gateway at run time (`get_card_terms`,
`get_xdr_rate_status`): the per-order range (USD 1 to 200 at the time of writing), the
card fee (2.9 % + 0.30 USD), the cycles-ledger delivery fee (200 M cycles) and the USD
per XDR rate (1 XDR = 1 T cycles). Do not hardcode any of them. Card details never touch
the canister or the CLI.

## Prerequisites

- `icp` CLI **1.7.0 or later** (`icp --version`). If it is older, ask the user, then
  upgrade it the way it was installed: `npm install -g @icp-sdk/icp-cli@latest`,
  `brew upgrade icp-cli`, or `icp-cli-update` for the shell installer (the
  `autoupgrade-icp-cli` skill tells which). Use the fallback below only when upgrading is
  not possible. Load the `icp-cli` skill for general usage and the `-n` / `-e` flag rule.
- A **named** `icp` identity for the project, as `$ID`: the one that runs `icp deploy`.
  `icp identity default` prints the default; on a fresh install it is `anonymous`, which
  the command refuses. If there is no named identity, ask the user to create one
  (`icp identity new <name>`) and keep its seed phrase. Never change the default identity
  on your own, and never print a seed phrase.
- A human who can open a URL on **some** device (laptop, phone). The agent's machine
  needs no browser.

## The Flow

```bash
# 1. Who is buying, and what they hold now
icp identity principal --identity "$ID"
icp cycles balance -n ic --identity "$ID"

# 2. Quote. With no terminal and no --yes, the command prints the quote on stderr,
#    creates nothing and exits 1; </dev/null makes sure it never stops at a prompt.
icp cycles buy --amount 10 -n ic --identity "$ID" </dev/null
#  Identity: dev
#  Buyer:    7k7px-dcypq-wulnh-byzgd-6sib2-udn6c-lfo6e-6oujd-veifp-62woo-5ae
#  Gateway:  2bwus-iiaaa-aaaac-bee3a-cai (CyclePay)
#  Price:    10.00 USD (9.41 USD after a 0.59 USD card fee)
#  Estimate: about 6.936T cycles, at 1.3566 USD per 1T cycles
#  Error: Refusing to create an order without confirmation in a non-interactive context. Use --yes to proceed.
#  → relay Price and Estimate to the user and wait for their yes (Pitfall 3).
#  → stop if the Gateway line is anything else (Pitfall 11).

# 3. Create the order for the amount the user approved, and return at once
icp cycles buy --amount 10 -n ic --identity "$ID" --yes --no-open --no-wait --json
#  stdout, one line, exit 0:
#  {"order_id":"co-12-…","checkout_url":"https://buy.stripe.com/…","amount":{"currency":"USD","value":"10.00"},
#   "net":{"currency":"USD","value":"9.41"},"fee":{"currency":"USD","value":"0.59"},
#   "estimated_cycles":"6936258794043","expires_at":"2026-10-16T18:03:12Z"}
#  → show checkout_url to the user VERBATIM and ask them to pay it once, on any device.

# 4. Wait: poll every 10 to 30 s with ORDER_ID = order_id from line 1; each call returns at once
icp canister call 2bwus-iiaaa-aaaac-bee3a-cai order_status '("'"$ORDER_ID"'")' -n ic --query --identity "$ID" \
  | grep -oE 'status = variant \{ [A-Za-z]+'
#  AwaitingPayment until the user pays; then until Delivered, or an end state in Pitfall 7.

# 5. Continue as the same identity
icp cycles balance -n ic --identity "$ID"
icp deploy -e ic --identity "$ID"
```

`--cycles 5t` instead of `--amount 10` quotes the least amount that lands at least 5 T
cycles. Create the order with `--amount <the Price it quoted>`, so the order is the one
the user approved and a re-run asks for the same amount (Pitfall 6).

Never run step 3 without `--no-wait` in the foreground: the command then polls every 3 s
for up to an hour, and a tool call that returns only when the command exits (or times out
first) never shows the user the link. Drop `--no-wait` only when the command runs in the
background and its stdout is read as it comes: line 1 arrives at once, and a second line
only if the order settles while the command waits (Pitfall 7):

```text
{"order_id":"co-12-…","status":"delivered","cycles_delivered":"6936000000000",
 "paid":{"currency":"USD","value":"10.00"},"refunded":null,"detail":null,"balance":"6936000000000"}
```

Flags that matter to an agent: `--no-open` (never let the CLI try a browser), `--no-wait`
(print line 1 and return; the order needs nothing more from the CLI), `--json` (one object
per line on stdout, never an array; the quote, progress and prompts go to stderr), `-q`
(stdout is the link, then the final status tag; no separate order id), `--yes` (skip the
confirmation; with no terminal nothing is created without it, so pass it only after the
user's yes).
`--gateway <canister-id>` and `ICP_CYCLES_GATEWAY_CANISTER_ID` send the order to another
canister serving the same interface, with its own payment page: never set either unless
the user names that gateway (Pitfall 11).

### Fallback: the same order with `icp canister call`

Only when the installed CLI is older than 1.7.0 and cannot be upgraded. Same canister,
same identity rules, same quote first. The argument and reply shapes are those of
[`cycles_gateway.did`](https://github.com/dfinity/icp-cli/blob/main/crates/icp-cli/src/cyclepay/cycles_gateway.did),
which icp-cli holds against CyclePay's backend interface; this sequence was run against
icp-cli's stand-in gateway and mainnet's public queries on 2026-10-14.

```bash
GW=2bwus-iiaaa-aaaac-bee3a-cai
icp canister call "$GW" get_card_terms '()' -n ic --query        # deliveries_paused, min/max_order_usd_cents, fee_bps, fee_fixed_usd_cents, ledger_delivery_fee_cycles
icp canister call "$GW" get_xdr_rate_status '()' -n ic --query   # xdr_usd_x10000, stale
# Show the user the amount, the fee and the cycles worked out below; go on only on their yes.

# Create: USD cents, destination = the caller's own cycles-ledger account.
icp canister call "$GW" create_order \
  '(record { destination = variant { Ledger }; beneficiary = null; project_id = null;
             amount_usd_cents = 1000 : nat64; confirm_system_canister = null })' \
  -n ic --identity "$ID"
# Ok = record { order_id = "co-…"; payment_url = "https://…"; net_usd_cents; expires_at }
# Err = record { code = "AMOUNT_OUT_OF_RANGE"; message = "…" }   (nothing was created)

# Wait: poll until the status is Delivered, or one of the end states in Pitfall 7.
icp canister call "$GW" order_status '("'"$ORDER_ID"'")' -n ic --query --identity "$ID" \
  | grep -oE 'status = variant \{ [A-Za-z]+'
```

To extract the link from the Candid text, take the quoted string after `payment_url =`
**unchanged**: `grep -oE 'payment_url = "[^"]+"' | sed -E 's/.*"(.*)"/\1/'` (Pitfall 2).
Cycles to expect, before the ledger fee: `net_usd_cents / 100 / (xdr_usd_x10000 / 10000)`
trillion, where `net = amount − (amount × fee_bps / 10000 + fee_fixed_usd_cents)`, rounded
to the cent. Calling `create_order` again for the same amount re-uses the order on the
same terms as the command (Pitfall 6).

## Common Pitfalls

1. **The cycles go to the buyer's own cycles-ledger account, nowhere else.** The CLI has no
   "send to my canister" option. From there, `icp deploy -e ic` creates canisters out of
   the balance and `icp canister top-up <canister> --amount <N> -e ic` funds one.
   `icp cycles transfer` to a canister principal credits that principal's *ledger*
   balance, not the canister's execution balance (see `cycles-management`).

2. **Never "clean up" the Candid text a link arrives in.** Candid prints numbers with
   underscore separators (`6_938_000_000_000`), and a regex that strips underscores
   turns `client_reference_id=o_co-12-…` into a link to the wrong order. Prefer `--json`;
   in the fallback, extract the quoted URL exactly and strip underscores only from values
   that are all digits.

3. **The agent cannot pay, and the user must see the price first.** Run the quote (step 2)
   and pass `--yes` only after the user agrees to that Price; with `--cycles`, they agree
   to the dollar amount it quoted, not to the cycles. Creating an order charges nothing.
   Print the link and ask the human to open it; they may use another device. Never ask
   for or type card details. Tell the user, with the link: pay it **once** (a second
   payment of the same link is charged and then refunded); keep the amount Stripe's page
   shows (the page lets the payer change it within the per-order range, and the cycles
   follow what is paid, not the quote); and the link works until `expires_at`.

4. **Mainnet only: `-n ic`, or `-e ic` inside a project.** CyclePay sells on mainnet only;
   any environment that targets mainnet works. Without either, the command fails before
   it orders, each message ending in ``CyclePay sells cycles on mainnet: use `-n ic` ``:
   in a project it targets the local environment (`the local network for this project is
   not running`); outside one, `No project found and no network specified`; against a
   running local network, `this network is not mainnet`. The deploy that follows takes
   `-e ic` as usual (`icp-cli` Pitfall 2).

5. **Buy and deploy as the same, named identity.** The command refuses the anonymous
   identity, and `icp deploy` spends the *default* identity's balance unless `--identity`
   is passed. A purchase as one identity and a deploy as another fails with insufficient
   cycles while the balance sits one identity over. Pass `--identity "$ID"` everywhere,
   or check `icp identity default` first.

6. **Stopping the command does not stop the order, and re-running it is not a status
   check.** Ctrl-C, SIGTERM or a killed process leaves the order payable until
   `expires_at` (25 hours after it was made); once paid, the cycles land anyway. Follow it
   with `order_status` (step 4) or `icp cycles balance -n ic`. Running the same command
   again gives back the *same* order and link only while the order is unpaid and less than
   an hour old, and only for the same amount: re-run with `--amount <amount.value from
   line 1>`, never `--cycles`, whose price moves with the rate. Once the order is paid, or
   is an hour old (which is when the command's own wait gives up), the same command makes
   a **second** payable order, and a user who pays both links pays for both. The gateway
   also caps orders per identity: 10 unpaid at once (`TOO_MANY_OPEN_ORDERS`), 5 new a
   minute and 50 a day (`RATE_LIMITED`).

7. **Read the end state, and its `detail`, before deciding anything.** Without `--no-wait`,
   a second JSON line comes only when the order settles, and the exit status is 0 only for
   `delivered`; with `--no-wait` it is 0 after line 1. If the wait gives up
   (one hour), is stopped, or loses the gateway, there is no second line: the exit status
   is 1 and stderr says where the order stands (`… stays payable until …`, or `… is still
   paid, delivering.`). A settled order is in one of these states (`order_status` names
   them `Delivered`, `NeedsReview`, `Refunding`, `Refunded`, `RefundOwed`):
   - `delivered`: done; `cycles_delivered` is exact.
   - `needs_review`: charged, and a CyclePay operator settles it by hand. Report the order
     id and the charge to the user and stop.
   - `refunding` / `refunded`: not delivered, the money comes back (`refunded` says how
     much). Tell the user why, from `detail`, before any new order: `DAILY_CAP` (the
     identity or the card passed the daily card limit, Pitfall 9: wait for the next UTC
     day), `OVER_CAP` or `UNDER_MIN` (the amount paid on Stripe's page was out of range),
     `ORDER_EXPIRED` (paid after `expires_at`). A new order is fine once the user agrees.
   - `refund_owed`: not delivered, and an operator refunds it by hand. A `detail` starting
     `REFUND_HELD` means CyclePay held the automatic refund because the same card was
     refunded several times within 24 hours; it is delayed, not kept. Keep the order id.

   `awaiting_payment`, `payment_pending` (a delayed payment method) and `processing`
   (charged, delivery under way) never end the wait: keep polling, never re-order. A
   status newer than the CLI reads as `unknown` (`--json`) or "a state this version of icp
   does not know"; poll `order_status` to read it. If the user says they paid and the
   order is still `AwaitingPayment` a few minutes later, do not create another order:
   CyclePay may have refused the payment on arrival and refunded it (the order then shows
   a refund state with the reason in `detail`, or stays `AwaitingPayment`). For anything
   charged and not delivered, give the user the order id and CyclePay's contact,
   securitybugs@dfinity.org.

8. **The quote is an estimate, already net of the ledger fee.** `estimated_cycles` is what
   lands on the account: the cycles the net buys, less the gateway's
   `ledger_delivery_fee_cycles` (200 M). `cycles_delivered` is the same measure at the
   rate in force when the payment lands, so the two differ only as the rate moved. A
   stale-rate warning on stderr means CyclePay has not refreshed its rate for longer than
   it tolerates; tell the user before they pay. With `--cycles N` the command pays the
   smallest amount, to the cent, that lands at least `N` at the quoted rate.

9. **Most refusals come from the CLI itself, before any order; nothing is created.** It
   checks the published terms first: `amount 250.00 USD is outside the gateway's range of
   1.00 USD to 200.00 USD per order`; `1000T cycles cost more than the gateway maximum of
   200.00 USD per order, which buys about 142.93T cycles; ask for fewer`; `cycles gateway
   … is not taking card orders right now; try again later`; `… is not pricing orders right
   now (it has no exchange rate)`. The
   gateway's own refusals read `CyclePay refused the order: <CODE>: <message>`:
   `RATE_LIMITED` / `TOO_MANY_OPEN_ORDERS` (wait, or pay the open order, Pitfall 6),
   `CARDS_UNAVAILABLE` / `PAUSED` (try later), `AMOUNT_OUT_OF_RANGE` (pick an amount in the
   range). Do not loop on any of them. More than USD 200 takes several orders, and card
   payments are capped at USD 1,000 per UTC day per buying identity and per card: a
   payment past a cap is charged and then refunded, never delivered. Do not split a large
   purchase into many orders in one day; past the cap, wait for the next UTC day.

10. **`failed to read the card terms`** means the canister does not serve the gateway
    interface: a `--gateway` that is not a cycles gateway, or an old CyclePay deployment.
    Check the canister id; do not fall back to guessing a Payment Link.

11. **Check where the order goes before handing over a link.** The quote's Gateway line
    must read `2bwus-iiaaa-aaaac-bee3a-cai (CyclePay)`; the CLI adds `(CyclePay)` only for
    that canister. With `--yes` and `--json` (or `-q`) the gateway is not printed at all,
    so step 2 is the only place to see it. `checkout_url` from CyclePay is on
    `https://buy.stripe.com/`. If either differs, stop and tell the user:
    `ICP_CYCLES_GATEWAY_CANISTER_ID` may be set in the environment
    (`env | grep ICP_CYCLES_GATEWAY`), and any canister serving the interface can hand out
    any https page to pay on.

## Verify It Works

```bash
icp cycles balance -n ic --identity "$ID"   # up by cycles_delivered (about estimated_cycles)
icp canister call 2bwus-iiaaa-aaaac-bee3a-cai order_status '("'"$ORDER_ID"'")' -n ic --query --identity "$ID" \
  | grep -E 'status|cycles_delivered|paid_usd_cents'   # status = variant { Delivered }; cycles_delivered = opt (6_936_000_000_000 : nat64)
```

`order_status` answers only the identity that created the order (`null` for anyone
else, and for an unpaid order after it expired). Purchases also appear under "My
purchases" on www.cyclepay.org when the user signs in there with the same identity:
`icp identity link web cyclepay --app 4w3yu-fyaaa-aaaac-beeoa-cai.icp0.io` makes one
(the first sign-in needs CLI access turned on in the user's II settings; see
`agent-web-identity`), and purchases made with `--identity cyclepay` then show there.

## Security Rules for Agents

- Create orders only for an amount the user named, as the identity they will deploy
  with, and only after they have seen the quote's `Price` and said yes. Relay the
  `amount`, `fee` and `estimated_cycles` the command prints.
- Hand over the payment link; the payment is the user's. Never pay, never open the link
  in a browser or computer-use tool, and never fill in the payment page.
- Never collect, store or echo card details; the hosted Stripe page is the only place
  they are entered.
- One order at a time. Never create orders in a loop, never pass `--yes` again after a
  refusal or a timeout without asking, and never re-run `icp cycles buy` to check on a
  payment (Pitfall 6).
- Never set `--gateway` or `ICP_CYCLES_GATEWAY_CANISTER_ID` unless the user names the
  gateway, and check the Gateway line and the `buy.stripe.com` host (Pitfall 11).
- Treat the order id as a reference, not a secret: it travels in the payment link.
  Hand the link over as text; do not pass it to URL shorteners or QR services.
- When a purchase ends in `needs_review` or `refund_owed`, report the order id and the
  charge to the user and do not retry.
