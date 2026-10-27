# Notifications

Web push to a signed-in user while the app is closed. II owns the subscriptions: no push service, no VAPID keys, no device tokens in the app.

Three pieces, all required. Missing any one of them produces silence rather than an error at the point you left out.

1. The frontend asks for consent, through II.
2. The origin names the sending canister at `/.well-known/ii-notification-senders`.
3. The canister sends, through the `identity-notifications` library.

## 1. Consent, in the frontend

Needs `@icp-sdk/auth` 11.1.0 or later. Earlier 11.x has none of these methods.

```javascript
const { granted } = await authClient.requestNotificationConsent();
const { granted } = await authClient.getNotificationConsentStatus();
await authClient.revokeNotificationConsent();
```

| Call | Opens II | Needs a session | Answers |
|---|---|---|---|
| `requestNotificationConsent()` | Yes | No; signs the user in if needed | `{ granted }`, what II recorded |
| `getNotificationConsentStatus()` | No | Yes | `{ granted }`, uncertified query |
| `revokeNotificationConsent()` | No | Yes | nothing; idempotent |

- All three answer a **record**, not a bare boolean. `const granted = await ...requestNotificationConsent()` is wrong and type-checks as an object.
- `granted: false` is the user's refusal, not a failure. Render it; do not throw.
- Asking a second time when consent is already held returns `{ granted: true }` without showing a screen, because the answer is read back from the canister rather than reported from the ceremony.
- `getNotificationConsentStatus` is a query, so the answer is uncertified. Paint a toggle from it; do not gate anything on it.
- Ask from a click. The ceremony renders, so it cannot run under `prompt: 'none'`.

Errors worth branching on:

| Error | Means | Remedy |
|---|---|---|
| `InteractionRequiredError` | Client built with `prompt: 'none'` | Ask again from a click |
| `NotificationsUnsupportedError` | That II deployment does not notify at all | Hide the control; nothing to retry |
| `SessionGoneError` | No live session (status and revoke only) | Sign in again |

## 2. The senders document

Serve from the **derivation origin**, the same origin as `/.well-known/ii-app-metadata`:

```json
{ "senders": ["ryjl3-tyaaa-aaaaa-aaaba-cai"] }
```

- At most **10** canisters. A longer list is rejected whole, never truncated.
- II fetches on demand and caches about an hour fresh, plus about an hour stale. A canister added is not accepted instantly; one removed keeps working for up to two hours.
- Without this document naming the sending canister, every send is refused. This is the most common cause of "nothing arrives and nothing errors".

## 3. Sending

Library: `identity-notifications`, same surface in both languages. Rust is on crates.io, Motoko on Mops (requires moc 2.0.0 or later).

```toml
identity-notifications = "0.1"
```

```rust
use identity_notifications as notifications;
use identity_notifications::{Memories, Notification};

notifications::endpoints!();          // the endpoints II calls back on

#[init]      fn init()         { open_notifications(); }
#[post_upgrade] fn post_upgrade() { open_notifications(); }

fn open_notifications() {
    MEMORIES.with_borrow(|manager| {
        notifications::init(manager, Memories {
            entries: MemoryId::new(10),
            content: MemoryId::new(11),
            metrics: MemoryId::new(12),
        })
    });
}

notifications::send(to, Notification {
    title: "New message".into(),
    body: text,
    url: Some(format!("https://chat.example.com/chats/{from}")),
    key: Some(format!("chat-{from}")),
    ..Default::default()
});
```

```motoko
import Notifications "mo:identity-notifications";

actor {
  include Notifications<system>();

  notifications.send<system>(to, {
    title = "New message";
    body = text;
    url = ?("https://chat.example.com/chats/" # caller.toText());
    key = ?("chat-" # caller.toText());
    urgency = null;
    expiresAt = null;
    funnel = null;
  })
}
```

Configuration is environment variables, not init arguments:

```yaml
canisters:
  - name: backend
    settings:
      environment_variables:
        notification_sender:      "rdmx6-jaaaa-aaaaa-aaadq-cai"   # the II canister
        notification_origin:      "https://your-app.icp0.io"
        notification_capacity_mb: "1024"   # optional
```

`key` names the notification: a second send under the same key **replaces** the first rather than stacking beside it. `dismiss(recipient, key)` takes one back when it no longer needs attention. `metrics()` reports the pipeline hour by hour.

## What the user sees

II composes the shown notification, so the app's name cannot come from the app's own payload:

| Shown | Comes from | Fallback |
|---|---|---|
| Title | `name` from `/.well-known/ii-app-metadata`, then ` · `, then the `title` sent | The origin's **hostname** when there is no metadata document |
| Icon | `logo` from the same document | None; platforms that show no icon show none |
| Body | the `body` sent | |

Publishing app metadata is therefore what brands every notification, not only the sign-in screen. Rules for that document: `references/app-metadata.md`.

## Delivery semantics

These surprise people, and none of them is a bug.

- **A notification is addressed to a principal, not to a browser.** II fans it out to every browser that identity has registered. A user on a laptop and a phone is woken on both.
- **Removing a recipient from the app's own list unsubscribes nothing.** The subscriptions live in II, against the anchor, shared across every consented app. Only the user can remove one, from II.
- **A browser unused for 60 days counts as gone** and is not woken.
- **`NoSuchRecipient`** means every browser of that recipient is past 60 days, or II holds no account for that principal at this origin. A CLI identity that never signed in to the app gets this.
- **iOS needs II added to the Home Screen** for web push. The consent ceremony walks the user through it; the app does nothing.

## Upgrades

Call `init` again from `post_upgrade`. The outbox, the content a channel may still pull, the hourly metrics and the learned batch limit live in the stable memories handed over, so an upgrade neither serialises nor restores any of it. Timers do not survive an upgrade, so that second `init` is what arms a flush for anything still waiting.

Renumbering the three `MemoryId`s on an existing canister abandons the old memories rather than migrating them, which wipes the outbox and the metrics.
