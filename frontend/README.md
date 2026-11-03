# InterviewSpar frontend

React 19, React Router 7, Vite 8, and Tailwind 4. Requires Node 22.12+ or 24.
Run `npm ci` then `npm run dev`; the API must run separately on port 8000.
`API_PROXY_TARGET` overrides the development proxy target.

`src/App.jsx` defines the supported public and authenticated pages.
`src/api/auth.js` is their FastAPI client. `src/api.js`, `AuthContext.jsx`, and
several legacy components target the disabled Express prototype and are not
mounted by the current app.

Run `npm test`, `npm run build`, and `npm run lint`. Production hosts must serve
`dist`, route `/api` to FastAPI without stripping the prefix, and use an SPA
fallback for page URLs. Never expose backend secrets through `VITE_*` variables.

See [root setup](../README.md), [architecture](../architecture.md), and
[deployment](../docs/DEPLOYMENT.md) for supported behavior and limitations.
