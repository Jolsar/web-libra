# web-libra

Read-only web frontend for the Libra Weight Loss app.

## What it does

- Lets the user paste a Libra access token in the browser.
- Stores the token in `localStorage` under `libra.accessToken`.
- Calls `https://api.libra-app.eu` directly from the browser.
- Shows the latest weight and selectable weight history ranges.

No Libra token is stored in GitHub, Cloudflare environment variables, cookies,
server logs, or a backend service.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is written to `dist`.

## Cloudflare Pages

Use these settings:

- Framework preset: `Vite`
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables: none

The `public/_headers` file is copied into the build output by Vite and gives
Cloudflare Pages a restrictive Content Security Policy that only allows API
requests to Libra.

## Privacy

This app is intentionally static. The user's token is only read by frontend
JavaScript and only used as an `Authorization: Bearer` header when calling
Libra's API. If a token is accidentally shared outside the app, rotate it in
Libra.
