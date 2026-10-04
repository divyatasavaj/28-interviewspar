import hashlib
import os
import re
from pathlib import Path
import edge_tts

CACHE_DIR = Path("/tmp/interspars_tts_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_VOICE = "en-US-AvaNeural"
DEFAULT_RATE = "-3%"
DEFAULT_PITCH = "+0Hz"

SUPPORTED_VOICES = [
    {
        "id": "en-US-AvaNeural",
        "name": "Ava",
        "gender": "Female",
        "description": "Natural, expressive, and conversational (Recommended)",
    },
    {
        "id": "en-US-AndrewNeural",
        "name": "Andrew",
        "gender": "Male",
        "description": "Warm, professional, and confident (Recommended)",
    },
    {
        "id": "en-US-EmmaNeural",
        "name": "Emma",
        "gender": "Female",
        "description": "Clear and polished interviewer tone",
    },
    {
        "id": "en-US-BrianNeural",
        "name": "Brian",
        "gender": "Male",
        "description": "Calm, thoughtful, and articulate",
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny",
        "gender": "Female",
        "description": "Friendly and engaging conversationalist",
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy",
        "gender": "Male",
        "description": "Relaxed and casual conversational style",
    },
]


def clean_text_for_speech(text: str) -> str:
    """Cleans markdown, technical symbols, and adds natural phrasing pauses."""
    if not text:
        return ""

    # Strip code blocks
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Strip inline code
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Strip markdown headings and bold/italics
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)
    # Strip bullet lists
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)

    # Normalize technical acronyms for clear pronunciation
    text = re.sub(r"\bAPI\b", "A P I", text)
    text = re.sub(r"\bUI\b", "U I", text)
    text = re.sub(r"\bUX\b", "U X", text)
    text = re.sub(r"\bSQL\b", "sequel", text, flags=re.IGNORECASE)
    text = re.sub(r"\bNoSQL\b", "no sequel", text, flags=re.IGNORECASE)
    text = re.sub(r"\be\.g\.,?\b", "for example,", text, flags=re.IGNORECASE)
    text = re.sub(r"\bi\.e\.,?\b", "that is,", text, flags=re.IGNORECASE)
    text = re.sub(r"\betc\.\b", "and so on", text, flags=re.IGNORECASE)

    # Enhance conversational pauses: replace semicolons and colons with comma pauses
    text = text.replace(";", ", ")
    text = text.replace(" : ", ", ")
    text = re.sub(r":\s+", ", ", text)

    # Clean redundant whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_cache_key(text: str, voice: str, rate: str, pitch: str) -> str:
    raw = f"{text}|{voice}|{rate}|{pitch}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


async def generate_speech_audio(
    text: str,
    voice: str = DEFAULT_VOICE,
    rate: str = DEFAULT_RATE,
    pitch: str = DEFAULT_PITCH,
) -> bytes:
    """Generates MP3 speech audio using high-quality neural voice."""
    cleaned = clean_text_for_speech(text)
    if not cleaned:
        return b""

    # Validate voice against supported list or fallback
    valid_voice_ids = {v["id"] for v in SUPPORTED_VOICES}
    if voice not in valid_voice_ids:
        voice = DEFAULT_VOICE

    cache_key = get_cache_key(cleaned, voice, rate, pitch)
    cache_path = CACHE_DIR / f"{cache_key}.mp3"

    if cache_path.exists() and cache_path.stat().st_size > 0:
        return cache_path.read_bytes()

    communicate = edge_tts.Communicate(
        text=cleaned,
        voice=voice,
        rate=rate,
        pitch=pitch,
    )

    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    audio_data = b"".join(audio_chunks)

    # Save to cache
    try:
        cache_path.write_bytes(audio_data)
    except Exception:
        pass

    return audio_data
