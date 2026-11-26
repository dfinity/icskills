---
name: pwa-ready-app
description: "Make an Internet Computer frontend installable as a Progressive Web App (PWA): the web app manifest, icons, a service worker served from the asset canister, the headers that keep it updatable, and which origin the installed app belongs to. Covers the difference between Safari installed apps (iOS Home Screen, macOS Dock), which keep their own storage and sign-in, and Chromium installed apps, which share the browser's. Also covers what installing changes for an app that already sends Internet Identity notifications. Use when an app should be installable, added to the Home Screen, run standalone or offline-capable, or when adding a manifest or service worker to an ICP frontend. Load before user-notifications when building a new app that will notify users. Do NOT use for native mobile apps, for hosting the frontend itself (use static-site) or for sending notifications (use user-notifications)."
license: Apache-2.0
compatibility: "@icp-sdk/auth >= 11.2.0, esbuild for the service worker bundle"
metadata:
  title: PWA-Ready App
  category: Frontend
  summary: "Make an ICP frontend installable: manifest, icons and a service worker."
  keywords: "PWA, progressive web app, installable, add to home screen, manifest, webmanifest, service worker, standalone, iOS home screen, offline, sw.js"
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
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
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
<meta name="theme-color" content="#ffffff" />
```

- iOS takes the Home Screen icon from `apple-touch-icon` (180x180, no transparency), not the manifest.
- Keep `id` fixed: it is the installed app's identity.
- A maskable icon keeps its content in the central 80%.

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

Bundle it into the root of the deployed `dir`:

```json
{
  "scripts": {
    "build": "vite build && esbuild src/sw.ts --bundle --format=iife --minify --outfile=dist/sw.js"
  }
}
```

Register it once from the page:

```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

Add a `fetch` handler only for offline support you want: a cached `index.html` is a stale shell after the next deploy.

## Install button

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

Safari has no such event, so show steps instead:

- **iOS:** open the menu (⋯), tap **Share**, tap **View More**, tap **Add to Home Screen**.
- **macOS:** **File** → **Add to Dock**.

Hide both once the app runs installed:

```javascript
const isInstalled = !matchMedia('(display-mode: browser)').matches || navigator.standalone === true;
```

## Title bar (desktop Chrome and Edge)

An installed desktop app can draw into the title bar with the Window Controls Overlay API: add `"display_override": ["window-controls-overlay"]` to the manifest and lay out the bar with the `titlebar-area-*` CSS environment variables. Look it up as needed: https://web.dev/articles/window-controls-overlay.

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

The patch is "Delivering through your own service worker" in the `user-notifications` skill (`@icp-sdk/auth` 11.3.0 or later):

- Service worker: `push` shows what `authClient.fetchNotificationPayload(event)` answers, `notificationclick` calls `authClient.markNotificationOpened(event)`, and `pushsubscriptionchange` calls `authClient.subscribeToNotifications({ interactive: false })`.
- Page: consent at sign-in, then a banner whose click handler calls `subscribeToNotifications()`, and a settings toggle.
- Never call `pushManager.subscribe` or make VAPID keys yourself.
