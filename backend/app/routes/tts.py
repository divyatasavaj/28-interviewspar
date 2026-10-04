from fastapi import APIRouter, HTTPException, Query, Response
from pydantic import BaseModel
from typing import Optional
from app.tts import (
    DEFAULT_RATE,
    DEFAULT_PITCH,
    DEFAULT_VOICE,
    SUPPORTED_VOICES,
    generate_speech_audio,
)

router = APIRouter(prefix="/tts", tags=["TTS"])


class SynthesizeRequest(BaseModel):
    text: str
    voice: Optional[str] = DEFAULT_VOICE
    rate: Optional[str] = DEFAULT_RATE
    pitch: Optional[str] = DEFAULT_PITCH


@router.get("/voices")
def get_voices():
    return {
        "voices": SUPPORTED_VOICES,
        "default": DEFAULT_VOICE,
        "default_rate": DEFAULT_RATE,
        "default_pitch": DEFAULT_PITCH,
    }


@router.post("/synthesize")
async def synthesize_speech(req: SynthesizeRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_data = await generate_speech_audio(
            text=req.text,
            voice=req.voice or DEFAULT_VOICE,
            rate=req.rate or DEFAULT_RATE,
            pitch=req.pitch or DEFAULT_PITCH,
        )
        if not audio_data:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech")

        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")


@router.get("/speak")
async def speak_stream(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query(DEFAULT_VOICE, description="Neural voice ID"),
    rate: str = Query(DEFAULT_RATE, description="Speech rate adjustment"),
    pitch: str = Query(DEFAULT_PITCH, description="Speech pitch adjustment"),
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    try:
        audio_data = await generate_speech_audio(
            text=text,
            voice=voice,
            rate=rate,
            pitch=pitch,
        )
        if not audio_data:
            raise HTTPException(status_code=500, detail="Failed to synthesize speech")

        return Response(content=audio_data, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis error: {str(e)}")
