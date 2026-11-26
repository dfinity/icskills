---
name: user-notifications
description: "Notify your app's users from your canister, on their devices and even while the app is closed. Internet Identity delivers each notification (web push): no push service, VAPID keys or device tokens in the app. Covers consent in the frontend (requestNotificationConsent, getNotificationConsentStatus, revokeNotificationConsent), the /.well-known/ii-notification-senders document, sending with the identity-notifications library from Motoko or Rust, delivering through the app's own service worker (subscribeToNotifications, fetchNotificationPayload), which an installed app (PWA) needs and a browser tab may use for its own presentation, and moving off the app's own web push. Use when an app must tell a user something while they are not looking, when adding notifications or a notifications toggle, or when nothing arrives, also in a Home Screen app. Assumes sign-in works: load user-sign-in first. Do NOT use for in-app notification UI, email, or reaching anyone who is not a signed-in user of this app."
license: Apache-2.0
compatibility: "@icp-sdk/auth >= 11.1.0 (11.3.0 for the service worker path), moc >= 2.0.0"
metadata:
  title: User Notifications
  category: Integration
  summary: "Send push notifications to your app's users through Internet Identity."
  keywords: "notifications, push notifications, web push, alerts, notify users, messages, reminders, background notifications, service worker, PWA notifications, home screen app"
---

# User Notifications

## Prerequisite

Load the `user-sign-in` skill first. The sender list below is served from the app's **primary origin**, which that skill elects.

## How it works

Your canister can notify your app's users, on their devices and while the app is closed. The canister addresses a user; Internet Identity holds that user's devices and delivers to them, so there is no push service, no VAPID keys, and no device tokens in the app.

Three pieces, all required. Missing any one of them produces silence rather than an error at the point you left out.

1. The frontend asks the user's consent, through II.
2. The origin names the sending canister at `/.well-known/ii-notification-senders`.
3. The canister sends, through the `identity-notifications` library.

## Which path

A notification reaches the user's device one of two ways. The canister side (pieces 2 and 3) is the same for both.

| App | Delivery | Do this |
|---|---|---|
| PWA-ready app, with a service worker (see the `pwa-ready-app` skill) | The app's own service worker | Pieces 1 to 3, then "Delivering through your own service worker". **Recommended.** It is the only way notifications reach a Safari installed app (iOS Home Screen, macOS Dock). |
| No service worker | Internet Identity's own | Pieces 1 to 3. Nothing else in the app. |
| App with its own push notifications already (its own VAPID keys, push service or subscription table) | Either of the above | "Moving from your own push notifications" first, then one of the rows above. |

The service worker path is not limited to installed apps. In a browser tab it is an option, for an app that wants control over how its notifications look: its own icon, badge, image and actions, and its own click handling.

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

- All three answer a **record**, not a bare boolean. `const granted = await ...requestNotificationConsent()` type-checks and is always truthy.
- `granted: false` is the user's refusal, not a failure. Render it; do not throw.
- Asking a second time when consent is already held returns `{ granted: true }` without showing a screen, because the answer is read back from the canister rather than reported from the ceremony.
- `getNotificationConsentStatus` is a query, so the answer is uncertified. Paint a toggle from it; do not gate anything on it.
- Ask from a click. The ceremony renders, so it cannot run under `prompt: 'none'`.
- Consent is recorded against the identity, and the browser the user answered on is the one registered for delivery. Someone who wants your notifications on a second machine answers again there. The status call reports the consent alone and does not speak for the device in the user's hand.

### Asking with the sign-in

The sign-in button is already a click, so that is the cheapest place to ask. Run both from it and the user signs in and answers in one visit to II rather than two:

```javascript
const [identity, { granted }] = await Promise.all([
  authClient.signIn(),
  authClient.requestNotificationConsent(),
]);
```

Asking at any later moment needs a control of its own.

### A toggle, later

To show the user whether your app may notify them, and let them turn it off:

```javascript
const { granted } = await authClient.getNotificationConsentStatus();
await authClient.revokeNotificationConsent();
```

Revoking is scoped to your app. It drops your origin's consent and whatever you still had queued for that user, and leaves their device subscriptions and every other app's consent alone. So dropping someone from your own recipient table revokes nothing, and revoking is not an unsubscribe.

Errors worth branching on:

| Error | Means | Remedy |
|---|---|---|
| `InteractionRequiredError` | Client built with `prompt: 'none'` | Ask again from a click |
| `NotificationsUnsupportedError` | That II deployment does not notify at all | Hide the control; nothing to retry |
| `SessionGoneError` | No live session (status and revoke only) | Sign in again |

## 2. The senders document

Serve from the **primary origin**, the same origin as `/.well-known/ii-app-metadata`:

```json
{ "senders": ["ryjl3-tyaaa-aaaaa-aaaba-cai"] }
```

- At most **10** canisters, shared by every app derived from that origin. A longer list is rejected whole, never truncated.
- II caches what it reads, so a canister added is not accepted instantly and one removed keeps working for a while afterwards.
- Without this document naming the sending canister, every send is refused. This is the most common cause of "nothing arrives and nothing errors".

## 3. Sending

Library: `identity-notifications`, same `send` in both languages, different wiring. Rust is on crates.io, Motoko on Mops (requires moc 2.0.0 or later).

**Rust** needs `endpoints!()` plus three stable `MemoryId`s handed to `init` (see "Upgrades"). **Motoko** needs neither: the mixin brings the endpoints and keeps its own state. Do not tell a Motoko user to pass memory ids; there are none.

```toml
identity-notifications = "0.1"
```

```rust
use identity_notifications as notifications;
use identity_notifications::{Memories, Notification};

notifications::endpoints!();          // the endpoints II calls back on

#[init]      fn init()         { init_notifications(); }
#[post_upgrade] fn post_upgrade() { init_notifications(); }

fn init_notifications() {
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

## The optional fields

| Field | Default | What it is for |
|---|---|---|
| `url` | none | Where acting on it takes the user. Must be the sending origin or one of its alternative origins; II refuses anything else. |
| `key` | none | What the notification is *about*. A second send under the same key **updates** that notification instead of adding another, and it is what `dismiss(recipient, key)` names. |
| `urgency` | `Normal` | `VeryLow`, `Low`, `Normal`, `High`. Schedules this notification against the origin's other traffic. **Not a rendering hint**, and honoured on channels with no tray. |
| `expiresAt` / `expires_at` | a short window | How long this is still worth sending. Set past the default for anything that matters later; short for anything worthless once the moment passes. |
| `funnel` | none | Which funnel to count it in. A label per notification is an unbounded set of rows: use one per campaign or kind, not per send. |

## Choosing `urgency` and `expiresAt`

Different questions: `urgency` is where this sits against the origin's **other traffic**, `expiresAt` is whether it is still worth showing when it could be. Pick both together.

**Unset is a short default**, so anything still worth delivering later needs an explicit value. It is not a tray lifetime: a delivered notification stays until the user clears it. `expiresAt` bounds how long the notification is still worth sending at all, and the library does not cap a longer value.

| Sending | `urgency` | `expiresAt` | Why |
|---|---|---|---|
| Security alert, new sign-in | `High` | days | Ahead of other traffic, and worth seeing late, so set well past the short default. |
| Direct message | `Normal` | unset | Worth sending now, noise much later. |
| "Your driver is outside" | `High` | minutes | Ahead of everything, worthless once passed. |
| Campaign to the whole user base | `VeryLow` | days | None is urgent and a large send must not push real notifications behind it, but each should still land. Give the campaign a `funnel` and its conversion rate is readable on its own. |
| Digest, nudge, streak reminder | `Low` | hours | Yields to anything else, and yesterday's is pointless. |

A short expiry does not make something urgent, and `High` does not make it last longer. `High` on everything removes the ordering it was reached for.

## `key`

The id is `hash(recipient, key)`, so a key reaches only that recipient's own entry: it cannot touch another user's notification or another app's. What it can do is collide with this app's other pending notification to the same recipient, and the later send wins. Derive `key` from the thing the notification is about, such as the conversation, rather than from whatever a caller passed in.

`metrics()` reports the pipeline hour by hour, and is the only place a notification's fate shows up, since `send` returns nothing.

## What the app does and does not own

- **The app addresses a user, nothing finer.** II holds a queue per browser that identity has registered, so one `send` can surface on a laptop and a phone at once. Where and how a notification reaches them is II's and the user's to manage, and an app that reasons about it is coupling itself to something it cannot see.
- **II composes what is shown.** The user reads your app's name, then the title your canister sent. The name comes from `/.well-known/ii-app-metadata`, and falls back to your origin's hostname where you publish none, so do not put your app's name in `title` yourself: it arrives twice. Publishing that document is what brands the notifications as well as the sign-in screen: see "App metadata on the sign-in screen" in the `user-sign-in` skill.
- **Sending cannot fail the call it is made from.** `send` neither traps nor awaits, so a recipient who cannot be notified costs the endpoint nothing and returns nothing to branch on. What became of a notification is in `metrics()`.
- **iOS: on Internet Identity's own path, II must be added to the Home Screen** for web push, and the consent ceremony walks the user through it. On the service worker path the app's own Home Screen app receives them instead.

## Delivering through your own service worker

Needs `@icp-sdk/auth` 11.3.0 or later and a service worker registered at the app's root (see the `pwa-ready-app` skill). The canister needs the `identity-notifications` release after Rust 0.1.2 and Motoko 0.3.2, and no code change: the service worker fetches each notification's content from your canister as the signed-in user, through the same library endpoints Internet Identity uses, and earlier releases answer those endpoints for Internet Identity alone. Every notification then shows as the generic "New notification" and none counts as received or opened in `metrics()`.

### In the service worker

Build the `AuthClient` with the same options as the page (`identityProvider`, `derivationOrigin`):

```typescript
import { AuthClient } from '@icp-sdk/auth/client';

declare const self: ServiceWorkerGlobalScope;
const authClient = new AuthClient({ derivationOrigin: 'https://your-app.icp0.io' });

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const { title, options } = await authClient.fetchNotificationPayload(event);
    await self.registration.showNotification(title, {
      ...options,
      icon: '/icons/192.png',
      badge: '/icons/badge-96.png',
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.waitUntil((async () => {
    event.notification.close();
    await self.clients.openWindow(event.notification.data?.url ?? self.registration.scope);
    await authClient.markNotificationOpened(event);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(authClient.subscribeToNotifications({ interactive: false }));
});
```

- **Show something for every push.** `fetchNotificationPayload` answers a generic "New notification" where the content cannot be read in time (8 seconds), because the subscription is `userVisibleOnly`: every push must show one. Never return from the `push` handler without calling `showNotification`.
- **Spread `options` first and keep its `tag` and `data`.** `tag` is what replaces an updated notification and closes a dismissed one; `data` is what `markNotificationOpened` and the click target read. Add your own fields after the spread.
- **`title` is shown as your canister sent it.** The system shows your installed app or site as the source, so the rule about not putting your app's name in `title` still holds.
- **`data.url` is set only for a URL on the service worker's own origin.** A notification whose `url` points at another of your origins opens the fallback (`registration.scope` above).

### In the page

Turning notifications on takes two buttons in your app, because each one opens a prompt and a prompt uses up the tap that opened it:

1. A button that calls `requestNotificationConsent()`. It opens Internet Identity, where the user answers whether your app may notify them.
2. Once that answered `granted: true`, a second button that calls `subscribeToNotifications()`. It opens the browser's notification permission prompt for your origin.

```javascript
// First button: opens Internet Identity's consent screen
const { granted } = await authClient.requestNotificationConsent();

// Second button, shown once granted is true: opens the browser's permission prompt
const permission = await authClient.subscribeToNotifications();
```

- `subscribeToNotifications()` answers the browser's permission; nothing is subscribed unless it is `'granted'`. `'denied'` is the user's answer: render it.
- It subscribes under Internet Identity's VAPID key and **replaces any other push subscription** this service worker holds. Remove the app's own push code first.
- Later sign-ins subscribe a fresh endpoint for the new account, and sign-out removes it. A subscription the browser replaces is registered again from the `pushsubscriptionchange` handler. The page calls nothing else.

### Safari installed apps: stop the second copy

On iOS and macOS, an app added to the Home Screen or Dock keeps storage apart from Safari, so Internet Identity sees it and Safari as two browsers of the user and may deliver each notification to both. Linking the installed app to Safari makes it the only one on that device.

Once `subscribeToNotifications()` answered `'granted'`, and wherever the app shows its notification settings, check whether there is something to link, and offer it as a button of its own:

```javascript
if ((await authClient.getSameDeviceLinkStatus()) === 'other-path-may-deliver') {
  // Show a button such as "Only notify me in this app"; it calls:
  await authClient.requestSameDeviceLink();
}
```

`requestSameDeviceLink()` leaves the app for Safari to claim the link with Safari's sign-in, so it must run from a button. Outside a Safari installed app the status is always `'no-other-path'`, so the button never shows.

| Error | Means | Remedy |
|---|---|---|
| `NotificationsUnsupportedError` | No Web Push in this browser, or a same-device link outside a Safari installed app | Hide the control |
| `SessionGoneError` | No live session | Sign in again; in the service worker, nothing to show |
| `"This application lists no frontend at this page's origin"` | The page is served from an origin that is neither the derivation origin nor in its `/.well-known/ii-alternative-origins` | List the origin there (see the `user-sign-in` skill) |
| `"This origin has no service worker registered to receive notifications"` | `subscribeToNotifications` ran before `navigator.serviceWorker.register` | Register first |

### A frontend on another origin

Where the installed app is served from an alternative origin of the app (a frontend that signs in with `derivationOrigin`), notifications for it must be sent for that frontend. Configure the sending canister with the frontend as `notification_origin` and the app's primary origin as `notification_derivation_origin`. The senders document stays on the primary origin, and the frontend must be listed in its `/.well-known/ii-alternative-origins`.

## Moving from your own push notifications

An app that runs its own web push (its own VAPID keys, a push service, a table of browser subscriptions) moves to Internet Identity's:

1. In the frontend, remove the app's own `pushManager.subscribe` call and the code that posts subscriptions to the backend. On the service worker path, `subscribeToNotifications()` replaces the old subscription on each device the next time it runs.
2. In the service worker, replace the `push` handler's decryption or payload parsing with `fetchNotificationPayload`.
3. In the backend, replace each web push send with the library's `send` to the user's principal, and delete the stored subscriptions and VAPID keys. The app no longer addresses devices; see "What the app does and does not own".
4. Users consent again through Internet Identity (piece 1). A browser permission granted to the old system is not consent.

## Upgrades

**Motoko: nothing to do.** There is no post-upgrade call to make and no ids to pass back in.

**Rust: call `init` again from `post_upgrade`.** No timer survives a canister upgrade, so without that second call anything already queued stays queued and is never sent. It is not optional and it is not a no-op on a canister that was running a moment ago.

Pass the same `MemoryId`s every time. Renumbering them on a running canister points the library at empty memories instead of the ones holding the queue, and whatever was waiting is gone.

## Mistakes That Break Your Build

1. **Leaving the senders document out.** Without `/.well-known/ii-notification-senders` naming the sending canister, every send is refused and nothing anywhere reports it. See "2. The senders document".
2. **Putting your app's name in `title`.** II puts it in front of the title you sent, so the user reads it twice. See "What the app does and does not own".
3. **Deriving `key` from whatever a caller passed in.** Two of your own sends under one key collide in that recipient's tray and the later one wins. See "`key`".
4. **Skipping `init` in `post_upgrade`, in Rust.** Anything queued stays queued and is never sent. See "Upgrades".
5. **Expecting a Safari installed app to receive notifications without its own service worker.** Internet Identity's own delivery does not reach it. See "Delivering through your own service worker".
6. **Returning from the `push` handler without showing a notification.** iOS revokes the subscription after a few pushes that showed nothing, and Chrome shows its own "updated in the background" notice instead. Always show what `fetchNotificationPayload` answers.
7. **Keeping the app's own push subscription next to Internet Identity's.** A service worker holds one push subscription, and `subscribeToNotifications` replaces it. See "Moving from your own push notifications".
