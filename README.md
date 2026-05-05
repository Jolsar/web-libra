# web-libra

Read-only web frontend for the Libra Weight Loss app.

This project is unofficial and is not affiliated with, endorsed by, or
maintained by Libra. The App Store and Google Play badges are official badge
assets stored locally in `public/badges`; do not redraw, recolor, or otherwise
modify them.

## What it does

- Lets the user paste a Libra access token in the browser.
- Can keep the token for the browser session in `sessionStorage` under
  `libra.sessionAccessToken`.
- Can save the token in `localStorage` under `libra.accessToken`.
- Calls `https://api.libra-app.eu` directly from the browser.
- Shows the latest weight and selectable weight history ranges.

The Libra token is only stored in the user's browser after the user chooses to
use or save it. Session tokens use `sessionStorage`, saved tokens use
`localStorage`, and neither option stores the token in GitHub, Cloudflare
environment variables, cookies, server logs, or a backend service. Libra data is
fetched directly from Libra API and processed locally in the browser.

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

This app is intentionally static. There is no backend service for this app. The
user's token is only read by frontend JavaScript and only used as an
`Authorization: Bearer` header when calling Libra's API directly from the
browser. If a token is accidentally shared outside the app, rotate it in Libra.

## License

MIT
