import { fetchSpeechAudioBlob } from "../api/tts"

let currentAudio = null
let currentBlobUrl = null

function cleanTextForSpeech(text) {
  if (!text) return ""
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\bAPI\b/g, "A P I")
    .replace(/\bUI\b/g, "U I")
    .replace(/\bUX\b/g, "U X")
    .replace(/\bSQL\b/gi, "sequel")
    .replace(/\bNoSQL\b/gi, "no sequel")
    .replace(/\be\.g\.,?\b/gi, "for example,")
    .replace(/\bi\.e\.,?\b/gi, "that is,")
    .replace(/\betc\.\b/gi, "and so on")
    .replace(/[;:]\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
}

export function stopAnySpeech() {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
    } catch {}
    currentAudio = null
  }
  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl)
    } catch {}
    currentBlobUrl = null
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel()
    } catch {}
  }
}

function speakWithBrowserFallback(text, { onStart, onEnd, onError }) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.()
    return
  }

  window.speechSynthesis.cancel()
  const cleaned = cleanTextForSpeech(text)
  const utterance = new SpeechSynthesisUtterance(cleaned)

  // Find the highest quality natural voice installed in the browser/OS
  const voices = window.speechSynthesis.getVoices()
  const englishVoices = voices.filter((v) => v.lang.startsWith("en"))

  const preferredVoice =
    englishVoices.find((v) => /natural|enhanced|neural|premium/i.test(v.name)) ||
    englishVoices.find((v) => /ava|samantha|evan|oliver|daniel|serena/i.test(v.name)) ||
    englishVoices.find((v) => /google/i.test(v.name)) ||
    englishVoices[0] ||
    voices[0]

  if (preferredVoice) {
    utterance.voice = preferredVoice
  }

  // Human pace: 0.92 gives natural cadence with micro-breaths
  utterance.rate = 0.92
  utterance.pitch = 1.0
  utterance.volume = 1.0

  utterance.onstart = () => onStart?.()
  utterance.onend = () => {
    setTimeout(() => onEnd?.(), 250)
  }
  utterance.onerror = () => {
    onError?.()
    onEnd?.()
  }

  window.speechSynthesis.speak(utterance)
}

/**
 * Plays speech using neural edge-tts backend, falling back to enhanced browser voices.
 */
export async function playHumanSpeech(text, options = {}) {
  const {
    voice = "en-US-AvaNeural",
    rate = "-3%",
    pitch = "+0Hz",
    onStart,
    onEnd,
    onError,
  } = options

  stopAnySpeech()

  if (!text || !text.trim()) {
    onEnd?.()
    return
  }

  try {
    const cleaned = cleanTextForSpeech(text)
    const blob = await fetchSpeechAudioBlob(cleaned, voice, rate, pitch)
    const blobUrl = URL.createObjectURL(blob)
    currentBlobUrl = blobUrl

    const audio = new Audio(blobUrl)
    currentAudio = audio

    return new Promise((resolve) => {
      let resolved = false
      const finish = () => {
        if (!resolved) {
          resolved = true
          onEnd?.()
          resolve()
        }
      }

      audio.onplay = () => {
        onStart?.()
      }

      audio.onended = () => {
        finish()
      }

      audio.onerror = (e) => {
        console.warn("Neural audio playback error, falling back to browser speech:", e)
        speakWithBrowserFallback(text, {
          onStart,
          onEnd: finish,
          onError: () => {
            onError?.()
            finish()
          },
        })
      }

      audio.play().catch((playErr) => {
        console.warn("Audio play() blocked or failed, using browser fallback:", playErr)
        speakWithBrowserFallback(text, {
          onStart,
          onEnd: finish,
          onError: () => {
            onError?.()
            finish()
          },
        })
      })
    })
  } catch (err) {
    console.warn("Failed to generate neural speech, falling back to browser:", err)
    return new Promise((resolve) => {
      speakWithBrowserFallback(text, {
        onStart,
        onEnd: () => {
          onEnd?.()
          resolve()
        },
        onError: () => {
          onError?.()
          resolve()
        },
      })
    })
  }
}
