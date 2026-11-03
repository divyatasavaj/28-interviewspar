# Legacy Express services

These JavaScript modules belong to the opt-in Express prototype. The default
FastAPI application uses `../app/` instead. The classifier feature extractor is
retained for parity tests; `codeRunner.js` delegates only to the isolated Judge0
adapter and never executes submitted code on the application host.

See [architecture](../../architecture.md) before reactivating any legacy service.
