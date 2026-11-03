import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";

import healthRoute from "./routes/health.js";
import interviewRoute from "./routes/interview.js";
import resumeRoute from "./routes/resume.js";
import codeRoute from "./routes/code.js";
import collectRoute from "./routes/collect.js";
import classifierRoute from "./routes/classifier.js";
import integrityRoute from "./routes/integrity.js";
import sessionsRoute from "./routes/sessions.js";
import marketplaceRoute from "./routes/marketplace.js";
import authRoute from "./routes/auth.js";
import { authRequired } from "./middleware/auth.js";
import { seedDefaultUsers } from "./services/auth.js";
// future routes (uncomment as steps progress)
// import certificateRoute from "./routes/certificate.js";

if (process.env.ENABLE_LEGACY_SERVER !== "true") {
  console.error("The supported server is FastAPI: python3 -m uvicorn main:app --port 8000. Set ENABLE_LEGACY_SERVER=true only for isolated legacy development.");
  process.exit(1);
}
const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",");

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "5mb" }));

app.use("/api/health", healthRoute);
app.use("/api/auth", authRoute);
app.use("/api", authRequired);
app.use("/api/interview", interviewRoute);
app.use("/api/resume", resumeRoute);
app.use("/api/code", codeRoute);
app.use("/api/collect", collectRoute);
app.use("/api/classifier", classifierRoute);
app.use("/api/integrity", integrityRoute);
app.use("/api/sessions", sessionsRoute);
app.use("/api/marketplace", marketplaceRoute);
// app.use("/api/certificate", certificateRoute);

// Idempotently create demo accounts (admin/student/developer/company) on boot.
if (process.env.ENABLE_DEMO_USERS === "true" && process.env.NODE_ENV !== "production") seedDefaultUsers();

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: CLIENT_ORIGIN } });

// STEP 4 — live code keystroke stream (Monaco -> backend -> interviewer/AI side).
// For MVP we relay to a per-session room; the AI review hook lands in later steps.
// Legacy live relay is disabled until a supported, owned room protocol is configured.
io.use((_socket, next) => next(new Error("Live relay is unavailable; use the supported interview API.")));

httpServer.listen(PORT, () => {
  console.log(`InterviewSpar backend listening on http://localhost:${PORT}`);
});
