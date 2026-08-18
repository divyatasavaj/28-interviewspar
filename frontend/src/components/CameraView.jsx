import { useEffect, useRef, useState, useCallback } from "react"
import { getToken } from "../api/auth"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export default function CameraView({ interviewSessionId, stream, faceDetected = true }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [videoSessionId, setVideoSessionId] = useState(null)
  const [muted, setMuted] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const startCamera = useCallback(async (sid) => {
    if (stream) {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
      return
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: true,
      })
      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraActive(true)

      const res = await fetch(`${API}/video/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ session_id: sid || interviewSessionId }),
      })
      const data = await res.json()
      setVideoSessionId(data.video_session_id)
    } catch (err) {
      console.warn("Camera access denied:", err.message)
    }
  }, [interviewSessionId, stream])

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
      streamRef.current = stream
      setCameraActive(true)
    } else if (interviewSessionId && !cameraActive && !streamRef.current) {
      startCamera(interviewSessionId)
    }
  }, [interviewSessionId, cameraActive, startCamera, stream])

  const stopCamera = useCallback(async () => {
    if (streamRef.current && !stream) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    if (videoSessionId) {
      await fetch(`${API}/video/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ video_session_id: videoSessionId }),
      }).catch(() => {})
    }
  }, [videoSessionId, stream])

  useEffect(() => {
    return () => {
      if (streamRef.current && !stream) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [stream])

  function toggleMute() {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = muted
        setMuted(!muted)
      }
    }
  }

  return (
    <>
      {cameraActive && (
        <div
          className={`fixed z-40 transition-all duration-300 shadow-2xl border-2 border-white/10 rounded-xl overflow-hidden ${
            minimized
              ? "top-4 right-4 w-32 h-20"
              : "top-4 right-4 w-48 h-36 md:w-56 md:h-40"
          }`}
        >
          <div className="relative w-full h-full bg-gray-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${faceDetected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              <span className="text-[9px] font-semibold text-white/70 tracking-wider">YOU</span>
            </div>
            <div className="absolute bottom-1.5 right-1.5 flex gap-1">
              <button
                onClick={() => setMinimized(!minimized)}
                className="w-5 h-5 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white text-[10px] transition-colors"
              >
                {minimized ? "+" : "—"}
              </button>
              <button
                onClick={toggleMute}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors ${
                  muted ? "bg-red-500/80 text-white" : "bg-black/50 hover:bg-black/70 text-white"
                }`}
              >
                {muted ? (
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
              <button
                onClick={stopCamera}
                className="w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center text-white text-[10px] transition-colors"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
