import test from "node:test"
import assert from "node:assert/strict"
import {
  CANONICAL_ROLES,
  FINDING_STATUS_CONFIG,
  RECOMMENDATION_GROUP_CONFIG,
  JD_MIN_CHARS,
  JD_MAX_CHARS,
  validateJobDescription,
  formatScoreDisplay,
  mapRoleToCanonicalId,
  extractErrorMessage,
} from "../src/utils/resumeIntelligence.js"

test("Resume Intelligence - Canonical Roles Specification", (t) => {
  assert.equal(CANONICAL_ROLES.length, 5, "Must define exactly 5 target roles")

  const expectedRoleIds = [
    "software-engineer-sde",
    "frontend-developer",
    "backend-developer",
    "data-analyst",
    "machine-learning-engineer",
  ]

  const actualRoleIds = CANONICAL_ROLES.map((r) => r.id)
  assert.deepEqual(actualRoleIds, expectedRoleIds, "Role IDs must match Phase 1-4 catalog IDs")

  for (const role of CANONICAL_ROLES) {
    assert.ok(role.id, "Role must have an id")
    assert.ok(role.title || role.label, "Role must have a title or label")
    assert.ok(role.description, "Role must have a descriptive summary")
    assert.ok(role.badge, "Role must have a category badge")
  }
})

test("Resume Intelligence - mapRoleToCanonicalId", () => {
  assert.equal(mapRoleToCanonicalId("Frontend Engineer"), "frontend-developer")
  assert.equal(mapRoleToCanonicalId("Senior Backend Developer"), "backend-developer")
  assert.equal(mapRoleToCanonicalId("Junior Data Analyst"), "data-analyst")
  assert.equal(mapRoleToCanonicalId("AI & Machine Learning Specialist"), "machine-learning-engineer")
  assert.equal(mapRoleToCanonicalId("Software Development Engineer"), "software-engineer-sde")
  assert.equal(mapRoleToCanonicalId(""), "software-engineer-sde", "Default fallback to SDE")
  assert.equal(mapRoleToCanonicalId(null), "software-engineer-sde", "Default fallback on null")
  assert.equal(mapRoleToCanonicalId("Unrecognized Custom Role"), "software-engineer-sde")
})

test("Resume Intelligence - Job Description Input Validation", () => {
  // Empty
  const emptyRes = validateJobDescription("")
  assert.equal(emptyRes.valid, false)
  assert.match(emptyRes.error, /cannot be empty/i)

  // Under min characters (< 40)
  const shortText = "We are seeking a React developer."
  assert.ok(shortText.length < JD_MIN_CHARS)
  const shortRes = validateJobDescription(shortText)
  assert.equal(shortRes.valid, false)
  assert.match(shortRes.error, /too short/i)

  // Valid length
  const validText = "We are seeking a Senior Full-Stack Software Engineer with at least 3 years of experience in React, Node.js, and MongoDB."
  assert.ok(validText.length >= JD_MIN_CHARS && validText.length <= JD_MAX_CHARS)
  const validRes = validateJobDescription(validText)
  assert.equal(validRes.valid, true)
  assert.equal(validRes.error, null)
  assert.equal(validRes.length, validText.length)

  // Exceeds max characters (> 20,000)
  const overMaxText = "A".repeat(JD_MAX_CHARS + 50)
  const overMaxRes = validateJobDescription(overMaxText)
  assert.equal(overMaxRes.valid, false)
  assert.match(overMaxRes.error, /exceeds maximum limit/i)
})

test("Resume Intelligence - Score Semantics & Null Handling", () => {
  // CRITICAL REQUIREMENT: Score null / unavailable must NEVER show 0% or empty gauge
  const nullScoreRes = formatScoreDisplay(null, "unavailable")
  assert.equal(nullScoreRes.isAvailable, false, "Must mark score unavailable")
  assert.equal(nullScoreRes.displayValue, null, "displayValue must be null (NEVER '0%')")
  assert.notEqual(nullScoreRes.displayValue, "0%")
  assert.match(nullScoreRes.label, /Score Unavailable/i)
  assert.match(nullScoreRes.description, /provisional/i)

  // Undefined score
  const undefinedRes = formatScoreDisplay(undefined, "unavailable")
  assert.equal(undefinedRes.isAvailable, false)
  assert.equal(undefinedRes.displayValue, null)

  // Valid score from JD Mode
  const validScoreRes = formatScoreDisplay(78.6, "calculated")
  assert.equal(validScoreRes.isAvailable, true)
  assert.equal(validScoreRes.displayValue, "79%")
  assert.equal(validScoreRes.rawNumber, 79)
  assert.equal(validScoreRes.label, "Textual Requirement Coverage")
  // Must NOT claim hiring probability or ATS pass rate
  assert.doesNotMatch(validScoreRes.label, /hiring probability/i)
  assert.doesNotMatch(validScoreRes.label, /ATS pass/i)
})

test("Resume Intelligence - Finding Statuses Coverage", () => {
  const expectedStatuses = [
    "demonstrated",
    "mentioned_only",
    "weak_evidence",
    "not_evidenced",
    "unknown_requirement",
    "not_evaluated",
  ]

  for (const status of expectedStatuses) {
    const config = FINDING_STATUS_CONFIG[status]
    assert.ok(config, `Missing config for status: ${status}`)
    assert.ok(config.label, `Status ${status} must have a label`)
    assert.ok(config.badgeClass, `Status ${status} must have badgeClass`)
    assert.ok(config.dotClass, `Status ${status} must have dotClass`)
  }
})

test("Resume Intelligence - Recommendation Groups Coverage", () => {
  const expectedGroups = ["skill_development", "evidence_improvement", "resume_improvement"]

  for (const group of expectedGroups) {
    const config = RECOMMENDATION_GROUP_CONFIG[group]
    assert.ok(config, `Missing config for group: ${group}`)
    assert.ok(config.title, `Group ${group} must have a title`)
    assert.ok(config.subtitle, `Group ${group} must have a subtitle`)
    assert.ok(config.badgeClass, `Group ${group} must have a badgeClass`)
  }
})

test("Resume Intelligence - API Error Message Formatting", () => {
  assert.match(extractErrorMessage({ status: 401 }), /session has expired/i)
  assert.match(extractErrorMessage({ status: 404 }), /upload a resume/i)
  assert.match(extractErrorMessage({ status: 409 }), /processing or unavailable/i)
  assert.match(extractErrorMessage({ status: 422, response: { data: { detail: "Invalid Role" } } }), /Invalid Role/)
  assert.match(extractErrorMessage("Custom backend failure"), /Custom backend failure/)
  assert.match(extractErrorMessage(null), /unexpected error/i)
})
