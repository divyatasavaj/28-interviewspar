import { useEffect, useState, useRef, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { getMe, clearToken, startInterview, answerInterview, getToken } from "../api/auth"
import FaceDetection from "../components/FaceDetection"
import InterviewerAvatar from "../components/InterviewerAvatar"
import InterviewAnalytics from "../components/InterviewAnalytics"
import VoiceControls from "../components/VoiceControls"
import { playHumanSpeech, stopAnySpeech } from "../utils/naturalSpeech"

const STT = window.SpeechRecognition || window.webkitSpeechRecognition
const API = "http://localhost:8000"

export default function Interview() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [videoSessionId, setVideoSessionId] = useState(null)
  const [question, setQuestion] = useState("")
  const [transcript, setTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")
  const [cameraError, setCameraError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [muted, setMuted] = useState(false)

  const [analytics, setAnalytics] = useState({
    faceCount: 0,
    faceDetected: false,
    attentionScore: 0,
    confidenceScore: 0,
    fluencyScore: 0,
    integrityFlags: [],
  })

  const [voice, setVoice] = useState(() => localStorage.getItem("interviewer_voice") || "en-US-AvaNeural")
  const [rate, setRate] = useState(() => localStorage.getItem("interviewer_rate") || "-3%")
  const [pitch, setPitch] = useState(() => localStorage.getItem("interviewer_pitch") || "+0Hz")

  const voiceRef = useRef(voice)
  const rateRef = useRef(rate)
  const pitchRef = useRef(pitch)

  useEffect(() => {
    voiceRef.current = voice
    localStorage.setItem("interviewer_voice", voice)
  }, [voice])

  useEffect(() => {
    rateRef.current = rate
    localStorage.setItem("interviewer_rate", rate)
  }, [rate])

  useEffect(() => {
    pitchRef.current = pitch
    localStorage.setItem("interviewer_pitch", pitch)
  }, [pitch])

  const [fdDebug, setFdDebug] = useState(null)

  useEffect(() => {
    if (fdDebug) tierRef.current = fdDebug.tier
  }, [fdDebug])

  const recognitionRef = useRef(null)
  const listeningResolveRef = useRef(null)
  const speakResolveRef = useRef(null)
  const videoRef = useRef(null)
  const sessionIdRef = useRef(null)
  const tierRef = useRef(null)
  const prevFaceCountRef = useRef(0)
  const multiFaceStreakRef = useRef(0)
  const type = searchParams.get("type")

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  useEffect(() => {
    if (!type || !user) return
    startInterview(type)
      .then((data) => {
        setSessionId(data.session_id)
        sessionIdRef.current = data.session_id
        setQuestion(data.question)
      })
      .catch((err) => {
        setError(err.message)
        setStatus("error")
      })
  }, [type, user])

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        })
        if (cancelled) return
        setCameraStream(stream)
        setCameraActive(true)

        const res = await fetch(`${API}/video/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const data = await res.json()
        if (!cancelled) setVideoSessionId(data.video_session_id)
      } catch (e) {
        console.warn("Camera:", e.message)
        setCameraError(e.message || "Camera access denied. Please grant permission.")
      }
    }
    startCam()
    return () => { cancelled = true }
  }, [sessionId, retryKey])

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => {
    if (!videoSessionId || !cameraActive) return
    const interval = setInterval(() => {
      if (!videoRef.current) return
      const canvas = document.createElement("canvas")
      canvas.width = videoRef.current.videoWidth || 320
      canvas.height = videoRef.current.videoHeight || 240
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.drawImage(videoRef.current, 0, 0)
      const dataUrl = canvas.toDataURL("image/jpeg", 0.2)
      fetch(`${API}/video/analyze-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          video_session_id: videoSessionId,
          frame_data: dataUrl,
          face_detected: analytics.faceDetected,
          face_count: analytics.faceCount,
        }),
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [videoSessionId, cameraActive, analytics.faceDetected, analytics.faceCount])

  const speakQuestion = useCallback((text) => {
    return new Promise((resolve) => {
      speakResolveRef.current = resolve
      playHumanSpeech(text, {
        voice: voiceRef.current,
        rate: rateRef.current,
        pitch: pitchRef.current,
        onStart: () => setStatus("speaking"),
        onEnd: () => {
          setStatus("listening")
          speakResolveRef.current = null
          setTimeout(() => resolve(), 300)
        },
        onError: () => {
          speakResolveRef.current = null
          resolve()
        },
      })
    })
  }, [])

  const skipSpeaking = useCallback(() => {
    stopAnySpeech()
    setStatus("listening")
    const r = speakResolveRef.current
    speakResolveRef.current = null
    if (r) r()
  }, [])

  const startListening = useCallback(() => {
    return new Promise((resolve) => {
      if (!STT) { resolve(""); return }
      const recognition = new STT()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"
      recognitionRef.current = recognition
      listeningResolveRef.current = resolve
      let finalText = ""

      recognition.onresult = (event) => {
        let interim = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalText += (finalText ? " " : "") + result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }
        setTranscript(finalText)
        setInterimTranscript(interim)
      }

      recognition.onend = () => {
        setInterimTranscript("")
        const r = listeningResolveRef.current
        listeningResolveRef.current = null
        if (r) r(finalText.trim())
      }

      recognition.onerror = () => {
        const r = listeningResolveRef.current
        listeningResolveRef.current = null
        if (r) r(finalText.trim())
      }
      recognition.start()
    })
  }, [])

  function finishSpeaking() {
    stopListening()
    const r = listeningResolveRef.current
    listeningResolveRef.current = null
    if (r) {
      setInterimTranscript("")
      r(transcript.trim())
    }
  }

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch (e) { /* ignore */ }
      recognitionRef.current = null
    }
  }, [])

  const submitAndAdvance = useCallback(async (answerText) => {
    if (!answerText || !sessionId) return
    setStatus("thinking")
    try {
      const data = await answerInterview(sessionId, answerText)
      if (data.confidence_score != null || data.fluency_score != null) {
        setAnalytics((prev) => ({
          ...prev,
          confidenceScore: data.confidence_score ?? prev.confidenceScore,
          fluencyScore: data.fluency_score ?? prev.fluencyScore,
        }))
      }
      if (data.status === "completed") {
        setStatus("idle")
        navigate(`/interview-complete?session_id=${sessionId}`)
        return
      }
      if (data.question) {
        setTranscript("")
        setInterimTranscript("")
        setQuestion(data.question)
      }
    } catch (err) {
      setError(err.message)
      setStatus("error")
    }
  }, [sessionId, navigate])

  useEffect(() => {
    if (!question || status === "error") return
    let cancelled = false

    async function run() {
      await speakQuestion(question)
      if (cancelled) return
      const text = await startListening()
      if (cancelled) return
      stopListening()
      if (text) {
        await submitAndAdvance(text)
      } else {
        setTranscript("")
        setInterimTranscript("")
        setTimeout(() => { if (!cancelled) setRetryKey((k) => k + 1) }, 800)
      }
    }
    run()
    return () => { cancelled = true; stopListening(); stopAnySpeech() }
  }, [question, retryKey])

  const handleReplayQuestion = useCallback(() => {
    if (!question) return
    stopListening()
    stopAnySpeech()
    setRetryKey((k) => k + 1)
  }, [question, stopListening])

  const handleFacesDetected = useCallback((faces) => {
    const currentTier = tierRef.current

    setAnalytics((prev) => {
      const faceDetected = faces.length > 0
      const faceCount = faces.length
      const prevCount = prevFaceCountRef.current
      const isMulti = faceCount >= 2
      const wasMulti = prevCount >= 2

      // Primary face: largest bounding box when multiple faces are present
      let primaryBox = null
      if (faceDetected) {
        if (faceCount === 1) {
          primaryBox = faces[0].box
        } else {
          let maxArea = 0
          for (const f of faces) {
            const area = f.box.width * f.box.height
            if (area > maxArea) {
              maxArea = area
              primaryBox = f.box
            }
          }
        }
      }

      // Persistence streak for multi-face (avoid single-frame false positives)
      if (isMulti) {
        multiFaceStreakRef.current += 1
      } else {
        multiFaceStreakRef.current = 0
      }

      // Edge-triggered integrity events — Tier 1/2 only, never Tier 3
      const canFireMulti = currentTier === "native" || currentTier === "human"

      if (isMulti && canFireMulti && multiFaceStreakRef.current === 3) {
        logIntegrity("multi_face_detected", { timestamp: new Date().toISOString(), extra: { count: faceCount } })
      }
      if (!isMulti && wasMulti && canFireMulti && prevCount > 0) {
        logIntegrity("single_face_restored", { timestamp: new Date().toISOString(), extra: { previous_count: prevCount } })
      }

      if (!faceDetected && prev.faceDetected) {
        logIntegrity("face_not_detected", { timestamp: new Date().toISOString() })
      }

      prevFaceCountRef.current = faceCount

      // Attention scoring (on primary face only)
      let attention = prev.attentionScore
      let cx = 0.5, cy = 0.5, dx = 0, dy = 0
      if (primaryBox && videoRef.current) {
        const vw = videoRef.current.videoWidth || 640
        const vh = videoRef.current.videoHeight || 480
        cx = (primaryBox.x + primaryBox.width / 2) / vw
        cy = (primaryBox.y + primaryBox.height / 2) / vh
        dx = Math.abs(cx - 0.5)
        dy = Math.abs(cy - 0.5)
        const offCenter = Math.max(dx, dy)
        const lookingDown = cy > 0.68
        const lookingAway = dx > 0.35

        attention = Math.round(Math.max(0, 100 - offCenter * 300))

        if (lookingDown && !prev._lookingDown) {
          logIntegrity("looking_away", { timestamp: new Date().toISOString(), extra: { direction: "down" } })
          prev.integrityFlags = [...prev.integrityFlags, { type: "looking_away", detail: "Looking down (possible device)", timestamp: Date.now() }]
        }
        if (lookingAway && !prev._lookingAway) {
          logIntegrity("looking_away", { timestamp: new Date().toISOString(), extra: { direction: cx < 0.5 ? "left" : "right" } })
          prev.integrityFlags = [...prev.integrityFlags, { type: "looking_away", detail: `Looking ${cx < 0.5 ? "left" : "right"}`, timestamp: Date.now() }]
        }
      } else {
        attention = Math.max(0, prev.attentionScore - 5)
      }
      return { ...prev, faceDetected, faceCount, attentionScore: attention, _lookingDown: faceDetected && cy > 0.68, _lookingAway: faceDetected && dx > 0.35 }
    })
  }, [])

  async function logIntegrity(type, extra = {}) {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      await fetch(`${API}/integrity/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ session_id: sid, type, ...extra }),
      })
    } catch {}
  }

  useEffect(() => {
    if (!sessionId) return
    function handleVisibility() {
      if (document.hidden) {
        logIntegrity("tab_switch", { timestamp: new Date().toISOString() })
        setAnalytics((prev) => ({
          ...prev,
          integrityFlags: [...prev.integrityFlags, { type: "tab_switch", timestamp: Date.now() }],
        }))
      }
    }
    function handleCopy() {
      const selected = window.getSelection()?.toString()
      if (selected && selected.length > 20) {
        logIntegrity("copy_paste", { timestamp: new Date().toISOString(), extra: { length: selected.length } })
        setAnalytics((prev) => ({
          ...prev,
          integrityFlags: [...prev.integrityFlags, { type: "copy_paste", timestamp: Date.now() }],
        }))
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    document.addEventListener("copy", handleCopy)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      document.removeEventListener("copy", handleCopy)
    }
  }, [sessionId])

  function toggleMute() {
    if (cameraStream) {
      const at = cameraStream.getAudioTracks()[0]
      if (at) { at.enabled = muted; setMuted(!muted) }
    }
  }

  function retryCamera() {
    setCameraError("")
    setRetryKey((k) => k + 1)
  }

  function handleEndCall() {
    stopAnySpeech()
    stopListening()
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
    navigate("/dashboard")
  }

  if (!user) return null

  return (
    <div className="h-screen w-screen overflow-hidden font-sans bg-black flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="flex-1 relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5 min-h-0">
          <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-lg">
              <InterviewerAvatar status={status} interviewType={type} />
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-20">
            {status === "speaking" && question && (
              <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-3 border border-white/10 text-center">
                <p className="text-white/90 text-sm leading-relaxed">{question}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={skipSpeaking}
                    className="text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1 rounded-full transition-all flex items-center gap-1"
                  >
                    <span>Skip to answering</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            )}

            {(status === "listening" || status === "thinking") && (
              <div className="bg-black/70 backdrop-blur-md rounded-xl px-4 py-3 border border-green-500/20">
                {status === "thinking" ? (
                  <div className="flex items-center gap-2 text-yellow-400/70 text-sm">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Evaluating your answer...
                  </div>
                ) : (
                  <>
                    {transcript && (
                      <p className="text-white text-sm mb-1">{transcript}</p>
                    )}
                    {interimTranscript && (
                      <p className="text-white/50 text-sm italic">{interimTranscript}</p>
                    )}
                    {!transcript && !interimTranscript && (
                      <div className="flex items-center gap-2 text-white/50 text-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Listening for your answer...
                      </div>
                    )}
                    {transcript && (
                      <button
                        onClick={finishSpeaking}
                        className="mt-2 text-[11px] font-semibold bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-1.5 rounded-full transition-all"
                      >
                        Done speaking
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {status === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
              <div className="text-center">
                <svg className="animate-spin w-8 h-8 text-primary mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-white/60 text-sm">Starting your interview...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 relative bg-gray-950 overflow-hidden flex items-center justify-center">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />
              <FaceDetection
                videoRef={videoRef}
                active={cameraActive}
                onFacesDetected={handleFacesDetected}
                onDebug={setFdDebug}
              />
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-white/60 tracking-wider">LIVE</span>
              </div>
              <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                <button
                  onClick={toggleMute}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    muted ? "bg-red-500/80 text-white" : "bg-black/40 hover:bg-black/60 text-white/70"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {muted ? (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </>
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    )}
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (cameraStream) cameraStream.getVideoTracks().forEach((t) => t.enabled = !t.enabled)
                  }}
                  className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/70 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 17h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center px-4">
              <svg className="w-12 h-12 text-white/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-white/30 text-sm mb-2">
                {cameraError ? "Camera unavailable" : "Camera not available"}
              </p>
              {cameraError && (
                <p className="text-red-400/70 text-[11px] mb-3 max-w-[200px] mx-auto">{cameraError}</p>
              )}
              <button
                onClick={retryCamera}
                className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {analytics.faceDetected && analytics.faceCount > 1 && (
            <div className="absolute top-12 left-3 z-20 bg-red-500/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {analytics.faceCount} faces detected
            </div>
          )}

          <InterviewAnalytics
            faceCount={analytics.faceCount}
            faceDetected={analytics.faceDetected}
            attentionScore={analytics.attentionScore}
            confidenceScore={analytics.confidenceScore}
            fluencyScore={analytics.fluencyScore}
            integrityFlags={analytics.integrityFlags}
            isActive={cameraActive}
            fdDebug={fdDebug}
          />

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-red-500/90 text-white text-sm px-5 py-3 rounded-xl max-w-md text-center">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900/95 backdrop-blur-md border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px] text-gray-500">
          <span className={`w-1.5 h-1.5 rounded-full ${
            status === "listening" ? "bg-green-400 animate-pulse" :
            status === "speaking" ? "bg-blue-400" :
            status === "thinking" ? "bg-yellow-400" : "bg-gray-500"
          }`} />
          {status === "listening" ? "Your turn" :
           status === "speaking" ? "AI speaking" :
           status === "thinking" ? "Evaluating" :
           status === "loading" ? "Starting" : "Ready"}
          {analytics.faceDetected && (
            <span className="text-white/30 ml-2">
              Attention: {analytics.attentionScore}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <VoiceControls
            currentVoice={voice}
            onChangeVoice={setVoice}
            currentRate={rate}
            onChangeRate={setRate}
            currentPitch={pitch}
            onChangePitch={setPitch}
            onReplayQuestion={question ? handleReplayQuestion : null}
            isSpeaking={status === "speaking"}
          />

          {!STT && (
            <span className="text-[9px] text-yellow-400/70 bg-yellow-400/10 px-2 py-1 rounded">
              Speech recognition not supported. Use Chrome.
            </span>
          )}

          <button
            onClick={handleEndCall}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold text-xs px-5 py-2 rounded-full transition-all shadow-lg shadow-red-500/25 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
            End Interview
          </button>
        </div>
      </div>
    </div>
  )
}
