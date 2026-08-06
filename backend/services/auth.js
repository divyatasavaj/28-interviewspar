// Role-based authentication for InterviewSpar (STEP — auth layer).
// Lightweight local auth: JWT (jsonwebtoken) + bcrypt (bcryptjs), users persisted in a JSON file.
// NOTE: rules.md prefers Firebase/Clerk; this local implementation is used so the app runs with no
// external credentials. To switch later, replace this service + the middleware with Clerk/Firebase
// and keep the same `role` field shape consumed by the rest of the app.
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const ROLES = ["student", "developer", "company", "admin"];
const JWT_SECRET = process.env.JWT_SECRET || "dev-interspar-secret-change-me";
const USERS_FILE = path.join(process.cwd(), "data", "users.json");

function ensureStore() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
}

function readUsers() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  ensureStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function findUserByEmail(email) {
  const users = readUsers();
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
}

export function findUserById(id) {
  const users = readUsers();
  return users.find((u) => u.id === id) || null;
}

export function sanitize(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

// Register a new user. Admin accounts can only be created by an existing admin (or the seed).
// `profile` carries the extra role-specific info collected at signup (year, goal, industry, …).
export function createUser({ email, password, name, role, domains, companyName, college, profile }) {
  if (!ROLES.includes(role)) throw new Error(`invalid role: ${role}`);
  if (role === "admin") throw new Error("admin accounts are created by the system, not self-registered");
  if (!email || !password) throw new Error("email and password are required");
  if (String(password).length < 4) throw new Error("password must be at least 4 characters");
  if (findUserByEmail(email)) throw new Error("an account with this email already exists");

  const users = readUsers();
  const user = {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    email,
    passwordHash: hashPassword(password),
    name: name || email.split("@")[0],
    role,
    createdAt: new Date().toISOString(),
  };
  if (role === "developer") {
    user.domains = Array.isArray(domains) && domains.length ? domains : ["Software Engineering"];
    user.handle = `I-${user.id.slice(-4).toUpperCase()}`;
  }
  if (role === "company") user.companyName = companyName || name || "Unnamed Company";
  if (role === "student") user.college = college || "";
  // Rich, role-specific profile captured at signup.
  user.profile = { ...(profile || {}) };
  users.push(user);
  writeUsers(users);
  return sanitize(user);
}

// Update the current user's profile (name + role-specific fields). Kept top-level
// legacy fields (companyName / college / domains) in sync for backward compatibility.
export function updateProfile(id, patch = {}) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) throw new Error("user not found");
  const u = users[idx];
  if (patch.name) u.name = patch.name;
  const profile = { ...(u.profile || {}), ...(patch.profile || {}) };
  if (profile.companyName) u.companyName = profile.companyName;
  if (profile.college !== undefined) u.college = profile.college;
  if (Array.isArray(profile.domains)) u.domains = profile.domains;
  if (Array.isArray(profile.handle)) u.handle = profile.handle; // no-op guard
  u.profile = profile;
  users[idx] = u;
  writeUsers(users);
  return sanitize(u);
}

export function listUsers() {
  return readUsers().map(sanitize);
}

// Idempotently seed demo accounts so the app is usable immediately after `npm run dev`.
export function seedDefaultUsers() {
  const users = readUsers();
  const seed = [
    { email: "admin@interviewspar.dev", password: "password", name: "Platform Admin", role: "admin" },
    { email: "student@demo.dev", password: "password", name: "Riya Student", role: "student", college: "Demo College" },
    { email: "developer@demo.dev", password: "password", name: "Aman Dev", role: "developer", domains: ["Software Engineering", "Backend"] },
    { email: "company@demo.dev", password: "password", name: "Acme Corp", role: "company", companyName: "Acme Corp" },
  ];
  let added = 0;
  for (const s of seed) {
    if (!findUserByEmail(s.email)) {
      users.push({
        id: `u-seed-${s.role}`,
        email: s.email,
        passwordHash: hashPassword(s.password),
        name: s.name,
        role: s.role,
        createdAt: new Date().toISOString(),
        ...(s.role === "developer" ? { domains: s.domains, handle: `I-${s.role.toUpperCase()}` } : {}),
        ...(s.role === "company" ? { companyName: s.companyName } : {}),
        ...(s.role === "student" ? { college: s.college } : {}),
      });
      added++;
    }
  }
  if (added) writeUsers(users);
  return added;
}
