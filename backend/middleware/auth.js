// STEP — auth middleware. Verifies the Bearer JWT and attaches req.user.
import { verifyToken, findUserById, sanitize, ROLES } from "../services/auth.js";

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: "authentication required" });
  const user = findUserById(payload.id);
  if (!user) return res.status(401).json({ error: "user not found" });
  req.user = sanitize(user);
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "authentication required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `forbidden: requires role ${roles.join(" or ")}` });
    }
    next();
  };
}

export { ROLES };
