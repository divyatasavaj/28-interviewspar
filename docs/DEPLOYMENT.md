# Deployment reference

The canonical API and SPA are separate processes. This repository includes
deployment examples; they have not been deployed or container-tested in this repair.

## API

Build from the root with `docker build -t interviewspar-api .`. The Dockerfile
installs declared Python dependencies, copies backend plus shared ML code, and
runs Uvicorn as an unprivileged user. Its build context excludes env files,
personal JSON data, logs, dependencies, and generated classifier pickles.
The image uses the documented heuristic ML fallback unless a trusted trained
artifact is deliberately provisioned with matching metadata.

Supply settings at runtime using your secret manager or `--env-file backend/.env`.
Bind the container port privately, for example `-p 127.0.0.1:8000:8000`.
Inside containers, `127.0.0.1` is the container itself: configure `MONGODB_URL`
with the actual MongoDB service/Atlas address. Required values are documented in
`backend/.env.example`; never bake credentials into an image or frontend bundle.

MongoDB connectivity is required for startup. Use a dedicated database user,
TLS/network restrictions as appropriate, and tested backup/restore procedures.
Startup creates indexes; review existing duplicate emails before deploying a
unique email index to an old database. Historical collections are preserved;
only new engine-version-2 interviews are listed by the current dashboard.

## SPA and ingress

Build the frontend using Node 22.12+ or 24: `npm ci` then `npm run build` inside
`frontend`. Serve `frontend/dist` with a static host that falls back to `index.html`
for client routes. Vite's development proxy is not present in this build.

`deploy/nginx.conf.example` forwards `/api/` without removing the prefix, sets
an upload cap, and supplies a rate-limit zone and SPA fallback. Replace filesystem
and upstream addresses for your topology. Terminate HTTPS at your ingress and
set `CLIENT_ORIGIN` to the public site origin. Trust forwarded headers only from
your ingress; restrict direct backend access. For multiple reverse proxies,
configure their real-IP chain explicitly rather than trusting arbitrary headers.

API application limits are per-process; use shared ingress limits for multiple
workers/replicas. Do not log authorization headers, request bodies, resume text,
or query text from the compatibility TTS endpoint. The container disables access
logs; configure sanitized operational/error monitoring externally.

## Optional services

- Groq: set `GROQ_API_KEY`/`GROQ_MODEL`; only session-opted-in questions/answers
  are sent. Provider failure keeps the local communication rubric and null
  correctness. Validate model availability and output quality separately.
- Judge0: configure a privately operated or trusted isolated service. The adapter
  expects synchronous `/submissions?base64_encoded=true&wait=true` support and
  optional `X-Auth-Token` authentication. Ensure CPU/memory/file/network limits
  are enforced by that service. Shared hosts and unsandboxed runners are unsuitable.
- Speech: Edge TTS is a network integration; browser speech is the fallback.
  Dictation depends on browser permission/support and may use a vendor service.
- Market evidence: operator CLIs support dry-run validation. `MONGODB_DATABASE`
  matches the API; `MONGODB_DB` is a legacy CLI alias. Importing evidence does not
  approve provisional rubrics or publish them into the runtime file catalog.
- Blockchain: a separate Sepolia prototype with issuer-only minting. It is not
  connected to interview completion. Compile/test/audit it before any testnet use;
  no mainnet deployment or wallet operation occurred during this repair.

## Release acceptance still required

Use a dedicated test deployment and synthetic accounts to verify real MongoDB
indexes, concurrent/retried answers, ownership, resume/report deletion, expired
tokens, complete HR/technical flows, mobile/browser behavior, dictation/read-aloud,
PDF print, provider failure handling, and operational limits. Unit tests use
database doubles and cannot establish these deployment guarantees.

Resume deletion removes application records, not historical interview text or
backups. Define retention and account-erasure procedures before admitting real
candidates. No automated hiring, payment, certification, or anti-cheat decisions
are part of the supported application.
