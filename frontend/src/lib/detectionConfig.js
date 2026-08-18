/**
 * Capability probe + tier selection for the detection pipeline.
 */

const HIGH_TIER_FPS = 12
const LOW_TIER_FPS = 6
const AUTO_FPS = 10

export function probeCapability() {
  const cores = navigator.hardwareConcurrency || 4
  const hasWebGL = !!document.createElement("canvas").getContext("webgl2")
  const hasRvfc = typeof HTMLVideoElement !== "undefined" && "requestVideoFrameCallback" in HTMLVideoElement.prototype

  let tier = "low"
  if (cores >= 8 && hasWebGL) tier = "high"
  else if (cores >= 4) tier = "medium"

  return { cores, hasWebGL, hasRvfc, tier }
}

export function getTargetFps(tierOverride) {
  const tier = tierOverride || import.meta.env.VITE_CV_TIER || "auto"
  if (tier === "high") return HIGH_TIER_FPS
  if (tier === "low") return LOW_TIER_FPS
  if (tier === "auto") {
    const cap = probeCapability()
    return cap.tier === "high" ? HIGH_TIER_FPS : cap.tier === "medium" ? AUTO_FPS : LOW_TIER_FPS
  }
  return AUTO_FPS
}

export function getDetectionConfig() {
  const cap = probeCapability()
  const targetFps = getTargetFps()
  const intervalMs = Math.round(1000 / targetFps)

  return {
    ...cap,
    targetFps,
    intervalMs,
    phoneDetection: true,
    modelBasePath: "/models/",
    backend: cap.hasWebGL ? "webgl" : "cpu",
  }
}
