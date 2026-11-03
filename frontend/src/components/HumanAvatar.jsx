import { useState, useEffect, useRef } from "react";

const DICEBEAR_BASE = "https://api.dicebear.com/9.x/personas/svg";
const FALLBACK_SVG = `
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbd3bf"/>
      <stop offset="100%" stop-color="#f5b8a3"/>
    </linearGradient>
    <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d1b15"/>
      <stop offset="100%" stop-color="#1a0f0a"/>
    </linearGradient>
    <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b4a6b"/>
      <stop offset="100%" stop-color="#283550"/>
    </linearGradient>
  </defs>
  <!-- Background circle -->
  <circle cx="60" cy="60" r="58" fill="url(#shirtGrad)" opacity="0.15"/>
  <!-- Neck -->
  <path d="M48 95 Q52 85 60 85 Q68 85 72 95" fill="url(#skinGrad)"/>
  <!-- Shoulders -->
  <ellipse cx="60" cy="115" rx="35" ry="15" fill="url(#shirtGrad)"/>
  <!-- Head -->
  <circle cx="60" cy="55" r="30" fill="url(#skinGrad)"/>
  <!-- Ears -->
  <ellipse cx="30" cy="55" rx="4" ry="8" fill="url(#skinGrad)"/>
  <ellipse cx="90" cy="55" rx="4" ry="8" fill="url(#skinGrad)"/>
  <!-- Hair -->
  <path d="M30 30 Q30 25 40 22 Q60 18 80 22 Q90 25 90 30 Q90 45 60 50 Q30 45 30 30" fill="url(#hairGrad)"/>
  <!-- Eyebrows -->
  <path d="M40 42 Q50 38 60 42" stroke="#1a0f0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M80 42 Q70 38 60 42" stroke="#1a0f0a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- Eyes -->
  <ellipse cx="46" cy="50" rx="6" ry="5" fill="#2d1b15"/>
  <ellipse cx="74" cy="50" rx="6" ry="5" fill="#2d1b15"/>
  <circle cx="48" cy="48" r="2" fill="white" opacity="0.6"/>
  <circle cx="76" cy="48" r="2" fill="white" opacity="0.6"/>
  <!-- Nose -->
  <path d="M60 55 Q58 60 60 60 Q62 60 60 55" fill="#e8b8a3"/>
  <!-- Mouth (neutral) -->
  <path id="mouthPath" d="M50 70 Q60 75 70 70" stroke="#1a0f0a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Glasses (optional professional look) -->
  <g opacity="0.7">
    <ellipse cx="46" cy="50" rx="10" ry="8" fill="none" stroke="#2d1b15" stroke-width="1.5"/>
    <ellipse cx="74" cy="50" rx="10" ry="8" fill="none" stroke="#2d1b15" stroke-width="1.5"/>
    <line x1="56" y1="50" x2="64" y2="50" stroke="#2d1b15" stroke-width="1.5"/>
  </g>
</svg>
`;

function getDicebearUrl(seed, options = {}) {
  const params = new URLSearchParams({
    seed,
    backgroundColor: "1e1e2e,2d2d44,0f0f13",
    ...options,
  });
  return `${DICEBEAR_BASE}?${params.toString()}`;
}

export default function HumanAvatar({
  seed = "interviewer",
  size = 120,
  status = "idle", // idle | speaking | listening | thinking
  persona = "tech", // hr | tech
  className = "",
  ariaLabel = "AI Interviewer",
}) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [useFallback, setUseFallback] = useState(false);
  const [_loadError, _setLoadError] = useState(false);
  const imgRef = useRef(null);
  const mouthRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Determine DiceBear seed - consistent per session
  const effectiveSeed = `${persona}-${seed}`;

  // Load avatar from DiceBear CDN
  useEffect(() => {
    let mounted = true;
    const url = getDicebearUrl(effectiveSeed);

    // Try to load the SVG
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("DiceBear failed");
        return res.text();
      })
      .then((svgText) => {
        if (!mounted) return;
        // Inject size and make responsive
        const sizedSvg = svgText
          .replace(/width="\d+"/, `width="${size}"`)
          .replace(/height="\d+"/, `height="${size}"`)
          .replace(/viewBox="0 0 \d+ \d+"/, 'viewBox="0 0 120 120"');
        setAvatarUrl(`data:image/svg+xml;base64,${btoa(sizedSvg)}`);
      })
      .catch(() => {
        if (mounted) setUseFallback(true);
      });

    return () => { mounted = false; };
  }, [effectiveSeed, size]);

  // Speaking animation: subtle mouth movement
  useEffect(() => {
    if (status !== "speaking" || useFallback) return;

    let phase = 0;
    const animate = () => {
      phase += 0.15;
      const openness = 0.3 + Math.sin(phase) * 0.25 + Math.sin(phase * 2.3) * 0.15;
      if (mouthRef.current) {
        const y = 70 + openness * 4;
        const ctrlY = 75 + openness * 6;
        mouthRef.current.setAttribute("d", `M50 ${y} Q60 ${ctrlY} 70 ${y}`);
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [status, useFallback]);

  // Listening animation: gentle breathing (scale pulse)
  useEffect(() => {
    if (status !== "listening") return;
    const el = imgRef.current;
    if (!el) return;
    el.style.animation = "breathe 3s ease-in-out infinite";
    return () => { if (el) el.style.animation = ""; };
  }, [status]);

  // Thinking animation: processing indicator
  useEffect(() => {
    if (status !== "thinking") return;
    const el = imgRef.current;
    if (!el) return;
    el.style.animation = "thinkPulse 1.5s ease-in-out infinite";
    return () => { if (el) el.style.animation = ""; };
  }, [status]);

  // Reset mouth when not speaking
  useEffect(() => {
    if (status !== "speaking" && mouthRef.current) {
      mouthRef.current.setAttribute("d", "M50 70 Q60 75 70 70");
    }
  }, [status]);

  const src = useFallback ? `data:image/svg+xml;base64,${btoa(FALLBACK_SVG)}` : avatarUrl;

  const statusStyles = {
    speaking: "ring-2 ring-purple-400/50 shadow-[0_0_20px_rgba(168,85,247,0.3)]",
    listening: "ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]",
    thinking: "ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]",
    idle: "ring-2 ring-white/10",
  };

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Status glow ring */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-300 ${statusStyles[status]}`}
        aria-hidden="true"
      />

      {/* Avatar image */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        style={{ width: size, height: size, borderRadius: "9999px", objectFit: "cover" }}
        onError={() => setUseFallback(true)}
        loading="lazy"
      />

      {/* Speaking mouth overlay for fallback SVG */}
      {useFallback && status === "speaking" && (
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: size, height: size, pointerEvents: "none" }}
          viewBox="0 0 120 120"
        >
          <path
            ref={mouthRef}
            d="M50 70 Q60 75 70 70"
            stroke="#1a0f0a"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Status badge */}
      <div className="absolute bottom-1 right-1">
        <span
          className={`w-3 h-3 rounded-full border-2 border-gray-900 ${
            status === "speaking" ? "bg-purple-400 animate-pulse" :
            status === "listening" ? "bg-emerald-400 animate-pulse" :
            status === "thinking" ? "bg-amber-400 animate-pulse" : "bg-gray-500"
          }`}
          aria-hidden="true"
        />
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes thinkPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.7; filter: brightness(1.2) saturate(1.2); }
        }
      `}</style>
    </div>
  );
}