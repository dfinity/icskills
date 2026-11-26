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
| New app, or an app without notifications | Follow this skill. Ship the service worker now even if it does nothing yet: notifications are added to it later without restructuring the frontend. **Recommended.** |
| App that already sends Internet Identity notifications | Follow this skill, then "Installing an app that already notifies" below. Once installed, a Safari installed app receives nothing until the app's own service worker subscribes. |

Hosting is the `static-site` skill (`_headers`, `_redirects`). Sign-in is the `user-sign-in` skill. This skill assumes both work.

## Mistakes That Break Your Build

1. **`/sw.js` answered by the SPA fallback.** With `/*  /index.html  200` in `_redirects`, a missing or misnamed service worker file is served as `index.html`, and registration fails with `The script has an unsupported MIME type ('text/html')`. The file must exist in the deployed `dir` under exactly the path you register.
2. **A cached service worker.** Without `Cache-Control: no-cache` on `/sw.js`, browsers keep checking an old copy and users run the previous version long after a deploy. See "Headers".
3. **Service worker in a subfolder.** A worker controls only its own path and below. `/assets/sw-1a2b.js` controls `/assets/`, not the app. Emit it at the root with a fixed name, never a hashed one.
4. **`import` in a classic service worker.** A service worker that imports `@icp-sdk/auth` must be bundled into one file. Bundle it as an IIFE (see "The service worker") rather than registering it with `type: 'module'`, which not every browser that installs PWAs supports for service workers.
5. **Installing from the wrong origin.** An installed app belongs to the origin it was installed from. Installed from `<id>.icp0.io` it is a different app, with different storage, from the one installed from your custom domain. Link the manifest only on the app's primary origin (see the `user-sign-in` skill), or redirect the others to it.
6. **Expecting the sign-in to carry into an iOS Home Screen app.** Safari installed apps keep storage of their own, so the user signs in again inside the installed app. Chromium installed apps share the browser's storage and stay signed in.

## The manifest

`public/manifest.webmanifest` (Vite copies `public/` into `dist/`):

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

- iOS ignores the manifest's icons for the Home Screen and reads `apple-touch-icon`, a 180x180 PNG without transparency.
- `id` fixes the installed app's identity. Changing `start_url` later without it makes browsers treat it as a different app.
- A maskable icon keeps its content inside the central 80% safe zone; Android crops the rest.

## The service worker

`src/sw.ts`, the smallest one worth shipping:

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

Bundle it after the frontend build, into the root of the deployed `dir`:

```json
{
  "scripts": {
    "build": "vite build && esbuild src/sw.ts --bundle --format=iife --minify --outfile=dist/sw.js"
  }
}
```

Register it from the page, once:

```javascript
if ('serviceWorker' in navigator) {
  await navigator.serviceWorker.register('/sw.js');
}
```

- A service worker needs a secure context. `https://<id>.icp0.io`, a custom domain, and `http://localhost` all qualify; `http://<id>.localhost:8000` in a local network qualifies too.
- Add a `fetch` handler only for offline support you actually want. Caching `index.html` in the worker serves a stale shell after a deploy unless the worker is updated with it.

## Headers

In `dist/_headers` (put it in `public/` so the build copies it), for the certified-assets canister of the `static-site` skill:

```
/sw.js
  Cache-Control: no-cache
  Content-Type: text/javascript

/manifest.webmanifest
  Content-Type: application/manifest+json
```

## Installing an app that already notifies

Users who do not install the app keep receiving notifications exactly as before. What changes is the installed app:

- **Safari installed app (iOS, macOS):** Internet Identity's own delivery does not reach it. Notifications arrive in the installed app only once its own service worker subscribes. Without that, a user who installed the app and opens notifications from it sees nothing from your app.
- **Chromium installed app:** it shares the browser's storage and its registration at Internet Identity, so notifications keep arriving as before. Subscribing its service worker is optional there.

The patch, detailed in "Delivering through your own service worker" in the `user-notifications` skill (`@icp-sdk/auth` 11.3.0 or later):

- In the service worker above: a `push` handler that shows what `authClient.fetchNotificationPayload(event)` answers, a `notificationclick` handler that calls `authClient.markNotificationOpened(event)`, and a `pushsubscriptionchange` handler that calls `authClient.subscribeToNotifications({ interactive: false })`.
- In the page: a button that calls `requestNotificationConsent()`, which opens Internet Identity's consent screen, and once that answered `granted: true`, a second button that calls `subscribeToNotifications()`, which opens the browser's permission prompt.
- Never call `pushManager.subscribe` or generate VAPID keys yourself: `subscribeToNotifications` subscribes under Internet Identity's key.
