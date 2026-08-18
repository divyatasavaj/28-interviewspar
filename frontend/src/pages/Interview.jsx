import { useEffect, useState, useRef, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { getMe, clearToken, startInterview, submitCalibration, sendInterviewMessage, endInterview, getToken, logIntegrity, logCopyPaste } from "../api/auth"
import FaceDetection from "../components/FaceDetection"
import IntegrityMonitor from "../components/IntegrityMonitor"
import InterviewerAvatar from "../components/InterviewerAvatar"
import InterviewAnalytics from "../components/InterviewAnalytics"
import CodePanel from "../components/CodePanel"
import VoicePanel from "../components/VoicePanel"

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
  const [phase, setPhase] = useState("calibration")
  const [calibrationQuestions, setCalibrationQuestions] = useState([])
  const [calibrationIndex, setCalibrationIndex] = useState(0)
  const [history, setHistory] = useState([])
  const [provider, setProvider] = useState("")
  const [showCode, setShowCode] = useState(false)
  const [showVoice, setShowVoice] = useState(false)

  const [analytics, setAnalytics] = useState({
    faceCount: 0,
    bodyCount: 0,
    handCount: 0,
    faceDetected: false,
    attentionScore: 0,
    confidenceScore: 0,
    fluencyScore: 0,
    integrityFlags: [],
    poseKeypoints: null,
    handLandmarks: null,
  })

  const [fdDebug, setFdDebug] = useState(null)
  const [calibStatus, setCalibStatus] = useState("idle")

  useEffect(() => {
    if (fdDebug) tierRef.current = fdDebug.tier
  }, [fdDebug])

  const [textAnswer, setTextAnswer] = useState("")

  const recognitionRef = useRef(null)
  const listeningResolveRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)
  const videoRef = useRef(null)
  const sessionIdRef = useRef(null)
  const tierRef = useRef(null)
  const prevFaceCountRef = useRef(0)
  const attentionCalibRef = useRef({ status: "pending", samples: [], baseline: null })
  const poseBufferRef = useRef({ yaw: [], pitch: [] })
  const type = searchParams.get("type") || "hr"

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken()
        navigate("/login")
      })
  }, [navigate])

  useEffect(() => {
    if (!user) return
    let isSubscribed = true
    setStatus("loading")
    startInterview(type)
      .then((data) => {
        if (!isSubscribed) return
        setSessionId(data.session_id)
        sessionIdRef.current = data.session_id
        const questions = Array.isArray(data.calibration_questions) ? data.calibration_questions : []
        setCalibrationQuestions(questions)
        setPhase(data.phase || "calibration")
        setCalibrationIndex(0)
        const initialQ = questions.length ? questions[0].question : (data.question || "Tell me about yourself and your background.")
        setQuestion(initialQ)
        setStatus("idle")
      })
      .catch((err) => {
        if (!isSubscribed) return
        setError(err.message)
        setStatus("error")
      })
    return () => { isSubscribed = false }
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
          pose_keypoints: analytics.poseKeypoints,
          hand_landmarks: analytics.handLandmarks,
        }),
      }).catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [videoSessionId, cameraActive, analytics.faceDetected, analytics.faceCount, analytics.poseKeypoints, analytics.handLandmarks])

  const speakQuestion = useCallback((text) => {
    return new Promise((resolve) => {
      if (!text) { setStatus("listening"); resolve(); return }
      const synth = synthRef.current
      if (!synth) { setStatus("listening"); resolve(); return }

      let done = false
      const finish = (nextStatus = "listening") => {
        if (done) return
        done = true
        setStatus(nextStatus)
        setTimeout(() => resolve(), 300)
      }

      const timeout = setTimeout(() => {
        finish("listening")
      }, 2500)

      try {
        synth.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 0.95
        utterance.pitch = 1.0
        utterance.volume = 1
        utterance.onstart = () => {
          setStatus("speaking")
        }
        utterance.onend = () => {
          clearTimeout(timeout)
          finish("listening")
        }
        utterance.onerror = () => {
          clearTimeout(timeout)
          finish("listening")
        }
        synth.speak(utterance)
      } catch {
        clearTimeout(timeout)
        finish("listening")
      }
    })
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
      if (phase === "calibration") {
        await submitCalibration(sessionId, question, answerText)
        setTranscript("")
        setInterimTranscript("")
        const nextIndex = calibrationIndex + 1
        if (nextIndex < calibrationQuestions.length) {
          setCalibrationIndex(nextIndex)
          setQuestion(calibrationQuestions[nextIndex].question)
        } else {
          const seed = [{ role: "user", content: "I have completed the calibration questions. Let's begin the interview." }]
          const res = await sendInterviewMessage(sessionId, seed)
          setHistory([...seed, { role: "assistant", content: res.reply }])
          setProvider(res.provider || "")
          setPhase("interview")
          setQuestion(res.reply)
        }
        return
      }

      const nextHistory = [...history, { role: "user", content: answerText }]
      const res = await sendInterviewMessage(sessionId, nextHistory)
      setHistory([...nextHistory, { role: "assistant", content: res.reply }])
      setProvider(res.provider || "")
      setTranscript("")
      setInterimTranscript("")
      setQuestion(res.reply)
    } catch (err) {
      setError(err.message)
      setStatus("error")
    }
  }, [sessionId, phase, question, calibrationIndex, calibrationQuestions, history])

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
    return () => { cancelled = true; stopListening(); synthRef.current.cancel() }
  }, [question, retryKey])

  const handleFacesDetected = useCallback((faces, poseKeypoints, handLandmarks, bodyCount = 0, handCount = 0, faceMeta = null) => {
    setAnalytics((prev) => {
      const faceDetected = faces.length > 0
      const faceCount = faces.length
      prevFaceCountRef.current = faceCount

      // Collect neutral head-pose samples while attention calibration is running
      if (faceMeta && faceMeta.yaw != null && !attentionCalibRef.current.done) {
        if (attentionCalibRef.current.samples.length < 60) {
          attentionCalibRef.current.samples.push({ yaw: faceMeta.yaw, pitch: faceMeta.pitch })
        }
      }

      let attention = prev.attentionScore
      let lookingDown = false
      let lookingAway = null
      const calibDone = attentionCalibRef.current.done && attentionCalibRef.current.baseline

      if (faceDetected && faceMeta && faceMeta.yaw != null && calibDone) {
        // Rolling smooth of head pose to reduce jitter
        poseBufferRef.current.yaw.push(faceMeta.yaw)
        poseBufferRef.current.pitch.push(faceMeta.pitch)
        if (poseBufferRef.current.yaw.length > 4) {
          poseBufferRef.current.yaw.shift()
          poseBufferRef.current.pitch.shift()
        }
        const avgYaw = poseBufferRef.current.yaw.reduce((a, b) => a + b, 0) / poseBufferRef.current.yaw.length
        const avgPitch = poseBufferRef.current.pitch.reduce((a, b) => a + b, 0) / poseBufferRef.current.pitch.length
        const baseline = attentionCalibRef.current.baseline
        const dyaw = Math.abs(avgYaw - baseline.yaw)
        const dpitch = avgPitch - baseline.pitch

        // Attention % decreases as the head turns (yaw) or tilts up/down (pitch) away from neutral
        const penalty = Math.max(0, dyaw - 8) * 2.2 + Math.max(0, Math.abs(dpitch) - 8) * 2.2
        attention = Math.round(Math.max(0, 100 - penalty))

        lookingDown = dpitch > 10
        lookingAway = dyaw > 14 ? (avgYaw - baseline.yaw > 0 ? "right" : "left") : null

        if (lookingDown && !prev._lookingDown) {
          logIntegrity(sessionIdRef.current, "looking_away", { extra: { direction: "down" } })
          prev.integrityFlags = [...prev.integrityFlags, { type: "looking_away", detail: "Looking down (possible device)", timestamp: Date.now() }]
        }
        if (lookingAway && !prev._lookingAway) {
          logIntegrity(sessionIdRef.current, "looking_away", { extra: { direction: lookingAway } })
          prev.integrityFlags = [...prev.integrityFlags, { type: "looking_away", detail: `Looking ${lookingAway}`, timestamp: Date.now() }]
        }
      } else if (!faceDetected) {
        attention = Math.max(0, prev.attentionScore - 5)
      }
      return { ...prev, faceDetected, faceCount, bodyCount, handCount, attentionScore: attention, _lookingDown: lookingDown, _lookingAway: !!lookingAway, poseKeypoints, handLandmarks }
    })
  }, [])

  useEffect(() => {
    if (!cameraActive || !sessionId || attentionCalibRef.current.done) return
    setCalibStatus("active")
    const t = setTimeout(() => {
      const samples = attentionCalibRef.current.samples
      if (samples.length) {
        attentionCalibRef.current.baseline = {
          yaw: samples.reduce((a, s) => a + s.yaw, 0) / samples.length,
          pitch: samples.reduce((a, s) => a + s.pitch, 0) / samples.length,
        }
      } else {
        attentionCalibRef.current.baseline = { yaw: 0, pitch: 0 }
      }
      attentionCalibRef.current.done = true
      setCalibStatus("done")
    }, 3000)
    return () => clearTimeout(t)
  }, [cameraActive, sessionId])

  useEffect(() => {
    if (!sessionId) return
    function handleCopy() {
      const selected = window.getSelection()?.toString()
      if (selected && selected.length > 20) {
        logCopyPaste(sessionId, { pasted_content_length: selected.length })
        setAnalytics((prev) => ({
          ...prev,
          integrityFlags: [...prev.integrityFlags, { type: "copy_paste", timestamp: Date.now() }],
        }))
      }
    }
    document.addEventListener("copy", handleCopy)
    return () => {
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
    synthRef.current.cancel()
    stopListening()
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
    if (sessionId) {
      endInterview(sessionId).catch(() => {})
    }
    navigate(`/interview-complete?session_id=${sessionId}`)
  }

  if (!user) return null

  return (
    <div className="h-screen w-screen overflow-hidden font-sans bg-black flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row">
        <div className="flex-1 md:flex-none md:w-[35%] relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5 min-h-0">
          <div className="w-full h-full flex items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-md">
              <InterviewerAvatar status={status} interviewType={type} />
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-lg z-20 space-y-2">
            {question && (
              <div className="bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/10 text-center shadow-2xl">
                <p className="text-white/90 text-sm md:text-base font-medium leading-relaxed mb-2">{question}</p>
                <button
                  onClick={() => speakQuestion(question)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-white/10 hover:bg-white/20 text-white/80 px-4 py-1 rounded-full transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {status === "speaking" ? "Speaking..." : "Play / Replay Audio"}
                </button>
              </div>
            )}

            {(status === "idle" || status === "listening" || status === "thinking" || status === "speaking") && (
              <div className="bg-black/80 backdrop-blur-md rounded-xl px-4 py-3 border border-purple-500/20 shadow-xl">
                {status === "thinking" ? (
                  <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm py-1">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Interviewer is evaluating your response...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transcript && (
                      <p className="text-green-300 text-xs bg-green-950/40 p-2 rounded border border-green-500/20">{transcript}</p>
                    )}
                    {interimTranscript && (
                      <p className="text-white/50 text-xs italic">{interimTranscript}</p>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        const val = textAnswer.trim() || transcript.trim()
                        if (!val) return
                        setTextAnswer("")
                        submitAndAdvance(val)
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        placeholder={transcript ? "Voice captured. Press Send or type to edit..." : "Type your answer or speak into microphone..."}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        disabled={!textAnswer.trim() && !transcript.trim()}
                        className="bg-primary hover:bg-violet-700 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
                      >
                        Submit
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>

          {status === "loading" && !question && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
              <div className="text-center">
                <svg className="animate-spin w-8 h-8 text-primary mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-white/60 text-sm">Starting your interview...</p>
              </div>
            </div>
          )}

          {showCode && (
            <div className="absolute inset-0 z-40 bg-gray-950/95 backdrop-blur-sm">
              <div className="absolute top-3 right-3 z-50">
                <button
                  onClick={() => setShowCode(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <CodePanel sessionId={sessionId} />
            </div>
          )}

          {showVoice && (
            <div className="absolute top-4 left-4 z-40 w-80 max-w-full">
              <VoicePanel
                onUseTranscript={(t) => {
                  setShowVoice(false)
                  submitAndAdvance(t)
                }}
              />
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
                sessionId={sessionId}
                active={cameraActive}
                onFacesDetected={handleFacesDetected}
                onDebug={setFdDebug}
              />
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 flex-wrap max-w-[calc(100%-6rem)]">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-white/60 tracking-wider">LIVE</span>
                {analytics.faceDetected && analytics.faceCount > 1 && (
                  <span className="bg-red-500/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Multiple faces detected
                  </span>
                )}
              </div>
              {calibStatus === "active" && (
                <div className="absolute inset-0 z-30 bg-gray-950/70 flex items-center justify-center">
                  <div className="text-center px-6">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin" />
                    <p className="text-sm font-semibold text-white">Calibrating attention…</p>
                    <p className="text-xs text-white/50 mt-1">Look at your screen for a few seconds</p>
                  </div>
                </div>
              )}
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

          <IntegrityMonitor
            sessionId={sessionId}
            active={!!cameraActive}
          />

          <InterviewAnalytics
            faceCount={analytics.faceCount}
            faceDetected={analytics.faceDetected}
            bodyCount={analytics.bodyCount}
            handCount={analytics.handCount}
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
          {phase === "calibration" && (
            <span className="text-white/30 ml-2">
              Calibration {calibrationIndex + 1}/{calibrationQuestions.length}
            </span>
          )}
          {provider && (
            <span className="ml-2 inline-flex items-center gap-1 text-white/40 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {provider}
            </span>
          )}
          {analytics.faceDetected && (
            <span className="text-white/30 ml-2">
              Attention: {analytics.attentionScore}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!STT && (
            <span className="text-[9px] text-yellow-400/70 bg-yellow-400/10 px-2 py-1 rounded">
              Speech recognition not supported. Use Chrome.
            </span>
          )}

          <button
            onClick={() => setShowVoice((v) => !v)}
            className={`font-semibold text-xs px-4 py-2 rounded-full transition-all flex items-center gap-1.5 ${
              showVoice
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
                : "bg-white/10 hover:bg-white/20 text-white/80"
            }`}
          >
            🎙️ Voice Panel
          </button>

          <button
            onClick={() => setShowCode((v) => !v)}
            className={`font-semibold text-xs px-5 py-2 rounded-full transition-all flex items-center gap-2 ${
              showCode
                ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25"
                : "bg-white/10 hover:bg-white/20 text-white/80"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Code
          </button>

          <button
            onClick={handleEndCall}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold text-xs px-5 py-2 rounded-full transition-all shadow-lg shadow-red-500/25 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            End & Report
          </button>
        </div>
      </div>
    </div>
  )
}
