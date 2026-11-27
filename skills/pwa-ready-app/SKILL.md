---
name: pwa-ready-app
description: "Make an Internet Computer frontend an installable Progressive Web App (PWA) that feels native: manifest, icons, a service worker served from the asset canister, splash screen, edge-to-edge colors and safe areas, an Install button or Add to Home Screen steps, and the desktop title bar. Covers which origin the installed app belongs to, how Safari installed apps (iOS Home Screen, macOS Dock) keep their own storage and sign-in while Chromium installed apps share the browser's, and what installing changes for an app that already sends Internet Identity notifications. Use when an app should be installable, added to the Home Screen or run standalone, when an installed app shows white bars or a white launch screen, or when adding a manifest or service worker to an ICP frontend. Load before user-notifications when building an app that will notify users. Do NOT use for native mobile apps, for hosting the frontend itself (use static-site) or for sending notifications (use user-notifications)."
license: Apache-2.0
compatibility: "@icp-sdk/auth >= 11.2.0, Vite or another bundler for the service worker"
metadata:
  title: PWA-Ready App
  category: Frontend
  summary: "Make an ICP frontend installable: manifest, icons and a service worker."
  keywords: "PWA, progressive web app, installable, install button, add to home screen, manifest, webmanifest, service worker, standalone, iOS home screen, offline, sw.js, window controls overlay, title bar, splash screen, edge to edge, safe area, status bar, navigation bar, app badge, unread count, shortcuts, screenshots, open fast, cache"
---

# PWA-Ready App

## Which case you are in

| App | Do this |
|---|---|
| No notifications yet. **Recommended.** | Follow this skill. Ship the service worker now, even empty: notifications go into it later. |
| Already sends Internet Identity notifications | Follow this skill, then "Installing an app that already notifies". |

Hosting is the `static-site` skill, sign-in the `user-sign-in` skill.

## Mistakes That Break Your Build

1. **`/sw.js` answered by the SPA fallback.** A missing or misnamed file is served as `index.html` by `/*  /index.html  200`, and registration fails with `The script has an unsupported MIME type ('text/html')`. The file must exist in the deployed `dir` at exactly the registered path.
2. **Service worker in a subfolder, or with a hashed name.** A worker controls only its own path and below. Emit `/sw.js` at the root.
3. **`import` in a service worker.** Bundle it into one IIFE file; `type: 'module'` service workers are not supported everywhere PWAs install.
4. **Installing from more than one origin.** An installed app belongs to the origin it was installed from: `<id>.icp.net` and your custom domain are two apps. Link each frontend's manifest only on the one origin users should install it from.
5. **Expecting the sign-in to carry into an iOS Home Screen app.** Apps installed from Safari keep their own storage, so the user signs in again inside them. Chromium installed apps stay signed in.
6. **Storing something for the Chromium installed app alone.** An app installed from Chrome or Edge shares storage with the site: whatever it stores also shows in a browser tab on that origin, and stays after the app is uninstalled.

## The manifest

`public/manifest.webmanifest`:

```json
{
  "name": "Example App",
  "short_name": "Example",
  "id": "/",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
  "description": "One sentence on what the app does.",
  "screenshots": [
    { "src": "/screenshots/phone.png", "sizes": "1080x2340", "type": "image/png", "form_factor": "narrow" },
    { "src": "/screenshots/desktop.png", "sizes": "2560x1600", "type": "image/png", "form_factor": "wide" }
  ],
  "shortcuts": [
    { "name": "New message", "url": "/new", "icons": [{ "src": "/icons/new-96.png", "sizes": "96x96" }] }
  ],
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

In `index.html`:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icons/180.png" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0f1115" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
```

- **Use your app's own colors, not white.** `#0f1115` above stands for your app's background. With a dark and a light mode, the `theme-color` meta tags and the page's CSS follow the user's scheme, but the manifest takes one value: give it the background of the scheme most users see. It colors the splash screen and, in an app installed from Chrome on Android, the navigation bar, in both schemes.
- **Pick the manifest colors before users install.** An app installed from Chrome on Android keeps them until Chrome updates it on its own schedule; to see a change at once, uninstall and install again.
- iOS takes the Home Screen icon from `apple-touch-icon` (180x180, no transparency), not the manifest.
- Keep `id` fixed: it is the installed app's identity.
- A maskable icon keeps its content in the central 80%.
- `description` and `screenshots` make Chrome's install dialog richer, on Android and desktop. Give each screenshot a `form_factor` of `narrow` (phone) or `wide` (desktop), as PNG or JPEG, 320 to 3840 pixels per side; Chrome uses at most 8.
- `shortcuts` are the app's entry points from its icon: long-press on Android, right-click on the Dock or taskbar on desktop. The chat example's "New message" is one. Keep them to the app's few most common actions.

## The service worker

`src/sw.ts`:

```typescript
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
```

Bundle it with the page's bundler, so it reads the same configuration, such as the `AuthClient` options from a module the page shares. With Vite, a second build in library mode puts it at the root of `dist`:

```typescript
// vite.sw.config.ts, run after the page's build: vite build && vite build -c vite.sw.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/sw.ts', formats: ['iife'], name: 'sw', fileName: () => 'sw.js' },
    outDir: 'dist',
    emptyOutDir: false,
  },
});
```

Register it once from the page:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

### Offline (optional)

Add a `fetch` handler when the app should launch without a network. Fetch `index.html` from the network first, so a deploy is never hidden behind a stale shell, cache the hashed assets, and leave canister calls alone:

```typescript
const CACHE = 'app-shell';

async function keep(request: Request | string, response: Response) {
  if (response.ok) await (await caches.open(CACHE)).put(request, response);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return; // canister calls go to the network

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => { event.waitUntil(keep('/index.html', response.clone())); return response; })
        .catch(async () => (await caches.match('/index.html')) ?? Response.error()),
    );
  } else if (url.pathname.startsWith('/assets/')) { // Vite's hashed file names
    event.respondWith(
      caches.match(request).then((cached) => cached ??
        fetch(request).then((response) => { event.waitUntil(keep(request, response.clone())); return response; })),
    );
  }
});
```

An app whose users write while offline queues those writes and sends them when the network returns: on the `online` event, or with the Background Sync API in Chromium.

## Make it feel native

**Do all of these.** An installed app that skips them looks like a web page in a frame: a white flash at launch, white bars around a dark app, and no way in but the browser menu.

### Open fast: show the last data first

Canister calls are the slow part of starting an ICP app. Draw what the user saw last from a local cache, then refresh from the canister. For a chat app, that is the last open conversation:

```javascript
const principal = (await authClient.getIdentity()).getPrincipal().toText();
const cacheKey = `last-view:${principal}`;

const cached = localStorage.getItem(cacheKey);
if (cached) render(JSON.parse(cached));

const fresh = await actor.get_conversation(conversationId);
render(fresh);
localStorage.setItem(cacheKey, JSON.stringify(fresh));

// In the sign-out handler:
localStorage.removeItem(cacheKey);
```

Key the cache by principal and clear it on sign-out, or the next user of a shared browser sees the previous user's data at launch. Keep secrets out of it.

### Splash screen

- **Android** draws it from the manifest: `name`, `background_color` and the 512x512 icon. Set `background_color` to the color of the app's first screen, so launch flows into it without a flash.
- **iOS** shows an `apple-touch-startup-image` that matches the device's screen size exactly, and a blank white screen without one. Generate one per iPhone and iPad screen size, portrait and landscape: the app's background with its icon centered. Take the sizes from Apple's current device list (https://developer.apple.com/design/human-interface-guidelines/layout#Specifications), not from memory, since new devices add sizes. Link each with its media query:

```html
<link rel="apple-touch-startup-image" href="/splash/1179x2556.png"
  media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
```

Save them as palette PNGs: a flat background with an icon stays a few kilobytes each, which matters for a canister that embeds its assets in its wasm.

### Edge to edge

Draw behind the system bars, so they show your app instead of a white strip. `viewport-fit=cover` (above) extends the page under them; then give the root your background and keep content clear of the bars with the safe area insets:

```css
html { background: #ffffff; }
@media (prefers-color-scheme: dark) { html { background: #0f1115; } }
.top-bar { padding-top: env(safe-area-inset-top); }
.composer { padding-bottom: env(safe-area-inset-bottom); }
```

This covers iOS, browser tabs and the status bar. In an app installed from Chrome on Android, the page does not draw under the navigation bar: it shows the manifest's `theme_color`, which is why that color must not be white for a dark app.

### Install button

Chrome and Edge let the app offer its own Install button:

```javascript
let installPrompt;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event; // now show your Install button
});

// In the Install button's click handler:
await installPrompt.prompt();
```

Chrome fires `beforeinstallprompt` only once it considers the app installable, so no button in a fresh or automated profile is expected.

Safari has no such event, so show steps instead:

- **iOS:** open the menu (⋯), tap **Share**, tap **View More**, tap **Add to Home Screen**.
- **macOS:** **File** → **Add to Dock**.

Tell them apart from the user agent; iPadOS reports itself as a Mac with touch:

```javascript
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isMacSafari = !isIOS && /Macintosh/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) && !/Chrome|Edg|Firefox/.test(navigator.userAgent);
```

Hide both once the app runs installed:

```javascript
const isInstalled = !matchMedia('(display-mode: browser)').matches || navigator.standalone === true;
```

### Title bar (desktop Chrome and Edge)

Put the app's own header in the title bar with the Window Controls Overlay API: add `"display_override": ["window-controls-overlay"]` to the manifest and lay out the bar with the `titlebar-area-*` CSS environment variables. It takes effect only in the installed app; in a browser tab nothing changes. Keep the header clear of the window controls, which sit left on macOS and right on Windows, and make it draggable except its buttons:

```css
header {
  padding-inline-start: env(titlebar-area-x, 0);
  padding-inline-end: calc(100vw - env(titlebar-area-x, 0) - env(titlebar-area-width, 100vw));
  app-region: drag;
}
header button { app-region: no-drag; }
```

A header split into panes pads its first pane at the start and its last at the end.

- **Match the window controls.** They take the `theme-color`, so it must be the color of the pane behind them. When a wide layout puts a different pane there, such as a side rail, add `theme-color` meta tags with a width media query for that layout.
- **Follow the controls' side.** Where the layout depends on whether the controls sit left or right, read `navigator.windowControlsOverlay.getTitlebarAreaRect()` and listen for its `geometrychange` event, which also fires when the user turns the overlay off.

Look it up as needed: https://web.dev/articles/window-controls-overlay.

### Sign-in from the installed desktop app

In an installed desktop app, Internet Identity opens as a browser tab behind the app's window. Open it as a popup centered on the app instead, only when the app runs installed:

```javascript
const width = 600;
const height = 820;
const windowOpenerFeatures = isInstalled
  ? `popup,width=${width},height=${height},` +
    `left=${Math.round(screenX + (outerWidth - width) / 2)},top=${Math.round(screenY + (outerHeight - height) / 2)}`
  : undefined;
```

Pass it as the `AuthClient`'s `windowOpenerFeatures` option. `isInstalled` is defined under "Install button".

### App badge

Show unread counts on the installed app's icon, the counterpart of notifications for when the app is in view:

```javascript
navigator.setAppBadge?.(unreadCount);
navigator.clearAppBadge?.();
```

In Safari, and on macOS in Chrome, the badge needs the app's own notification permission: without it the call succeeds and no badge appears.

## Headers

`public/_headers`, for the `static-site` canister. A canister serving its own assets sets these content types in its own code:

```
/sw.js
  Content-Type: text/javascript

/manifest.webmanifest
  Content-Type: application/manifest+json
```

## Installing an app that already notifies

Users who do not install the app keep receiving notifications as before. In the installed app:

- **Installed from Safari (iOS, macOS):** nothing arrives until its own service worker subscribes.
- **Installed from Chromium:** notifications keep arriving; subscribing is optional.
- **Installed from Chrome on macOS:** notifications mostly show as Google Chrome's, with Chrome's icon. Where Chrome shows them under the app, macOS asks the user to allow the app's notifications on its first one. Only notifications shown by the app's own service worker can show under the app; Internet Identity's stay Chrome's.

The patch is "Delivering through your own service worker" in the `user-notifications` skill (`@icp-sdk/auth` 11.3.0 or later):

- Service worker: `push` shows what `authClient.fetchNotificationPayload(event)` answers, `notificationclick` calls `authClient.markNotificationOpened(event)`, and `pushsubscriptionchange` calls `authClient.subscribeToNotifications({ interactive: false })`.
- Page: consent at sign-in, then a banner whose click handler calls `subscribeToNotifications()`, and a settings toggle.
- Never call `pushManager.subscribe` or make VAPID keys yourself.
