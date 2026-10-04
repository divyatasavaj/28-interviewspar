const API = "http://localhost:8000"

export async function fetchTtsVoices() {
  try {
    const res = await fetch(`${API}/tts/voices`)
    if (res.ok) {
      return await res.json()
    }
  } catch (err) {
    console.warn("Could not fetch remote voices:", err)
  }
  return {
    voices: [
      { id: "en-US-AvaNeural", name: "Ava", gender: "Female", description: "Natural, expressive & conversational" },
      { id: "en-US-AndrewNeural", name: "Andrew", gender: "Male", description: "Warm, professional & confident" },
      { id: "en-US-EmmaNeural", name: "Emma", gender: "Female", description: "Clear & polished tone" },
      { id: "en-US-BrianNeural", name: "Brian", gender: "Male", description: "Calm & articulate" },
    ],
    default: "en-US-AvaNeural",
    default_rate: "-3%",
    default_pitch: "+0Hz",
  }
}

export async function fetchSpeechAudioBlob(text, voice = "en-US-AvaNeural", rate = "-3%", pitch = "+0Hz") {
  const res = await fetch(`${API}/tts/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, rate, pitch }),
  })
  if (!res.ok) {
    throw new Error(`TTS synthesis failed with status ${res.status}`)
  }
  return await res.blob()
}
