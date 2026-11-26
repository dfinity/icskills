---
name: pwa-ready-app
description: "Make an Internet Computer frontend an installable Progressive Web App (PWA) that feels native: manifest, icons, a service worker served from the asset canister, splash screen, edge-to-edge colors and safe areas, an Install button or Add to Home Screen steps, and the desktop title bar. Covers which origin the installed app belongs to, how Safari installed apps (iOS Home Screen, macOS Dock) keep their own storage and sign-in while Chromium installed apps share the browser's, and what installing changes for an app that already sends Internet Identity notifications. Use when an app should be installable, added to the Home Screen or run standalone, when an installed app shows white bars or a white launch screen, or when adding a manifest or service worker to an ICP frontend. Load before user-notifications when building an app that will notify users. Do NOT use for native mobile apps, for hosting the frontend itself (use static-site) or for sending notifications (use user-notifications)."
license: Apache-2.0
compatibility: "@icp-sdk/auth >= 11.2.0, Vite or another bundler for the service worker"
metadata:
  title: PWA-Ready App
  category: Frontend
  summary: "Make an ICP frontend installable: manifest, icons and a service worker."
  keywords: "PWA, progressive web app, installable, install button, add to home screen, manifest, webmanifest, service worker, standalone, iOS home screen, offline, sw.js, window controls overlay, title bar, splash screen, edge to edge, safe area, status bar, navigation bar"
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
  "background_color": "#0f1115",
  "theme_color": "#0f1115",
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

- **Use your app's own colors, not white.** `background_color` and `theme_color` color the splash screen and the system bars; `#0f1115` above stands for your app's background.
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

Add a `fetch` handler only for offline support you want: a cached `index.html` is a stale shell after the next deploy.

## Make it feel native

**Do all of these.** An installed app that skips them looks like a web page in a frame: a white flash at launch, white bars around a dark app, and no way in but the browser menu.

### Splash screen

- **Android** draws it from the manifest: `name`, `background_color` and the 512x512 icon. Set `background_color` to the color of the app's first screen, so launch flows into it without a flash.
- **iOS** shows an `apple-touch-startup-image` that matches the device's screen size exactly, and a blank white screen without one. Generate one image per iPhone and iPad size (portrait and landscape) and link each with its media query:

```html
<link rel="apple-touch-startup-image" href="/splash/1179x2556.png"
  media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
```

### Edge to edge

Draw behind the status and navigation bars, so the system bars show your app instead of a white strip. `viewport-fit=cover` (above) extends the page under them; then give the root your background and keep content clear of the bars with the safe area insets:

```css
html { background: #0f1115; }
.top-bar { padding-top: env(safe-area-inset-top); }
.composer { padding-bottom: env(safe-area-inset-bottom); }
```

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

Safari has no such event, so show steps instead:

- **iOS:** open the menu (⋯), tap **Share**, tap **View More**, tap **Add to Home Screen**.
- **macOS:** **File** → **Add to Dock**.

Hide both once the app runs installed:

```javascript
const isInstalled = !matchMedia('(display-mode: browser)').matches || navigator.standalone === true;
```

### Title bar (desktop Chrome and Edge)

Put the app's own header in the title bar with the Window Controls Overlay API: add `"display_override": ["window-controls-overlay"]` to the manifest and lay out the bar with the `titlebar-area-*` CSS environment variables. It takes effect only in the installed app; in a browser tab nothing changes. Look it up as needed: https://web.dev/articles/window-controls-overlay.

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
