// STEP — auth routes: register / login / me / users (admin).
import { Router } from "express";
import {
  ROLES, createUser, findUserByEmail, verifyPassword, signToken, sanitize, listUsers, updateProfile,
} from "../services/auth.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

// Public registration. Role is chosen by the user (student | developer | company).
// Admin is created only by the system seed. Company/developer get role-appropriate fields.
router.post("/register", (req, res) => {
  const { email, password, name, role, domains, companyName, college, profile } = req.body;
  if (!ROLES.includes(role)) return res.status(400).json({ error: "invalid role" });
  try {
    const user = createUser({ email, password, name, role, domains, companyName, college, profile });
    const token = signToken(user);
    res.json({ token, user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Update the current user's profile (auth required).
router.patch("/me", authRequired, (req, res) => {
  try {
    const updated = updateProfile(req.user.id, req.body);
    res.json({ user: updated });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Login for any role.
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password || "", user.passwordHash)) {
    return res.status(401).json({ error: "invalid email or password" });
  }
  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
});

// Current user (auth required).
router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

// List all users — admin only.
router.get("/users", authRequired, requireRole("admin"), (_req, res) => {
  res.json({ users: listUsers() });
});

export default router;
