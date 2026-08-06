import { useCallback, useRef, useState } from "react";

// STEP 9 — live speech-to-text (Web Speech API, Chrome) + fluency signals.
// Exposes transcript, filler-word count, pause count, and a simple fluency score.
// Runs only in the browser (Web Speech API is not available in Node).
const FILLERS = ["um", "uh", "like", "you know", "basically", "actually", "literally", "right", "okay", "well", "hmm", "i mean"];

export function useSpeech() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [fluency, setFluency] = useState(null);
  const recRef = useRef(null);
  const pausesRef = useRef(0);
  const lastTsRef = useRef(0);

  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const computeFluency = useCallback((text, pauses) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lower = " " + text.toLowerCase() + " ";
    const fillers = FILLERS.reduce((n, w) => n + (lower.match(new RegExp("(?<![\\w])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w])", "g")) || []).length, 0);
    const score = Math.max(0, Math.min(100, 100 - fillers * 5 - pauses * 4));
    setFluency({ fillers, pauses, words: words.length, score });
    return fillers;
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    let acc = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) acc += txt + " ";
        else interim += txt;
      }
      const now = Date.now();
      if (lastTsRef.current && now - lastTsRef.current > 1500) pausesRef.current += 1;
      lastTsRef.current = now;
      const full = (acc + interim).trim();
      setTranscript(full);
      computeFluency(full, pausesRef.current);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
    pausesRef.current = 0;
    lastTsRef.current = Date.now();
  }, [supported, computeFluency]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, fluency, start, stop, setTranscript };
}
