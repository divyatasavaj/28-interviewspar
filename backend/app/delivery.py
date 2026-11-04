"""Validated client observations and transparent delivery coaching, separate from answer scores."""

import re
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Millis = Annotated[int, Field(strict=True, ge=0, le=3_600_000)]
Count = Annotated[int, Field(strict=True, ge=0, le=100_000)]


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AudioObservation(Observation):
    capture_ms: Millis
    observed_ms: Millis
    voiced_ms: Millis
    speech_span_ms: Millis
    pause_count: Count
    pause_ms: Millis
    longest_pause_ms: Millis
    sample_count: Count
    clipped_samples: Count

    @model_validator(mode="after")
    def consistent(self):
        if not (self.voiced_ms <= self.speech_span_ms <= self.observed_ms <= self.capture_ms + 10):
            raise ValueError("Audio durations are inconsistent")
        if self.pause_ms > self.speech_span_ms - self.voiced_ms + 10 or self.longest_pause_ms > self.pause_ms:
            raise ValueError("Pause durations are inconsistent")
        if self.pause_count * 500 > self.pause_ms + 10 or self.clipped_samples > self.sample_count:
            raise ValueError("Audio sample counts are inconsistent")
        if not self.sample_count and self.observed_ms:
            raise ValueError("Audio duration requires samples")
        return self


class CameraObservation(Observation):
    samples: Count
    face_samples: Count
    centered_samples: Count
    multiple_samples: Count

    @model_validator(mode="after")
    def consistent(self):
        if not (self.centered_samples + self.multiple_samples <= self.face_samples <= self.samples):
            raise ValueError("Camera sample counts are inconsistent")
        return self


class FocusObservation(Observation):
    observed_ms: Millis
    hidden_ms: Millis
    hidden_count: Count

    @model_validator(mode="after")
    def consistent(self):
        if self.hidden_ms > self.observed_ms:
            raise ValueError("Hidden time exceeds observed time")
        return self


class DeliveryObservation(Observation):
    consent: Literal[True]
    transcript: str = Field(default="", max_length=12000)
    transcript_complete: bool = Field(default=True, strict=True)
    language: Literal["en-US", "en-IN", "en-GB"] = "en-IN"
    audio: AudioObservation | None = None
    camera: CameraObservation | None = None
    focus: FocusObservation | None = None
    confidence_self_rating: Annotated[int, Field(strict=True, ge=1, le=5)] | None = None


def percent(numerator, denominator):
    return round(100 * numerator / denominator, 1) if denominator else None


def delivery_feedback(observation, answer):
    if observation is None:
        return None
    data = observation.model_dump() if isinstance(observation, DeliveryObservation) else observation
    transcript = data.get("transcript", "")
    words = re.findall(r"\b\w+(?:['’]\w+)?\b", transcript, re.UNICODE)
    fillers = re.findall(r"\b(?:um+|uh+|erm|er|hmm+|you know|i mean)\b", transcript.lower())
    possible = re.findall(r"\b(?:like|well|actually|basically|literally)\b", transcript.lower())
    audio, camera, focus = data.get("audio"), data.get("camera"), data.get("focus")
    coverage = percent(audio["observed_ms"], audio["capture_ms"]) if audio else None
    # Short/silent/incompletely observed clips do not support a meaningful rate.
    rate = round(len(words) * 60000 / audio["speech_span_ms"]) if (
        data.get("transcript_complete", True) and audio and audio["speech_span_ms"] >= 5000 and audio["voiced_ms"] >= 1000
        and len(words) >= 5 and coverage is not None and coverage >= 80
    ) else None
    notes = []
    if not data.get("transcript_complete", True):
        notes.append("The recognized transcript is incomplete. Filler counts cover captured words only; speaking pace is unavailable.")
    if rate is not None:
        if rate > 180:
            notes.append(f"About {rate} words/minute in this sample. Try a deliberate pause between ideas if it felt rushed.")
        elif rate < 100:
            notes.append(f"About {rate} words/minute in this sample. Rehearse one example to make transitions smoother if you felt stuck.")
        else:
            notes.append(f"About {rate} words/minute in this sample. Check whether your examples were easy to follow.")
    elif transcript:
        notes.append("Speaking pace is unavailable: record at least five words over five seconds with microphone coverage.")
    if fillers:
        notes.append(f"The recognized transcript contains {len(fillers)} filler expressions. Try replacing one with a brief pause.")
    if audio and audio["pause_count"]:
        notes.append(f"{audio['pause_count']} energy gaps of at least 0.5 seconds occurred between detected speech. Pauses can help separate ideas.")
    if audio and audio["clipped_samples"]:
        notes.append("Some microphone samples reached the clipping threshold. Try moving slightly farther from the microphone.")
    if camera and camera["multiple_samples"]:
        notes.append("More than one face was detected in some camera samples. This is a framing observation, not an integrity judgment.")
    if focus and focus["hidden_count"]:
        notes.append(f"The interview tab became hidden {focus['hidden_count']} time(s) during spoken answers.")
    return {
        "source": "browser-observations-v1", "language": data.get("language"),
        "recognized_word_count": len(words),
        "filler_count": len(fillers) if transcript else None,
        "filler_examples": sorted(set(fillers)),
        "possible_filler_count": len(possible) if transcript else None,
        "possible_filler_examples": sorted(set(possible)),
        "transcript_edited": bool(transcript) and " ".join(transcript.split()) != " ".join(answer.split()),
        "transcript_complete": data.get("transcript_complete", True),
        "words_per_minute": rate, "audio_coverage_percent": coverage,
        "audio": audio, "camera": camera, "focus": focus,
        "face_presence_percent": percent(camera["face_samples"], camera["samples"]) if camera else None,
        "centered_frame_percent": percent(camera["centered_samples"], camera["samples"]) if camera else None,
        "page_visible_percent": percent(focus["observed_ms"]-focus["hidden_ms"], focus["observed_ms"]) if focus else None,
        "confidence_self_rating": data.get("confidence_self_rating"),
        "coaching": notes,
        "limitations": [
            "Browser-reported practice observations; not independently verified or a hiring score.",
            "Speech recognition may omit fillers or misrecognize accents. Contextual words such as 'like' are listed separately.",
            "Microphone energy estimates speech and pauses; background noise and browser suspension affect coverage. Pronunciation is not scored.",
            "Face presence and framing do not measure eye contact, attention, or confidence. Confidence is an optional self-rating.",
        ],
    }


def summarize_delivery(answers):
    rows = [a.get("evaluation", {}).get("delivery") for a in answers if not a.get("skipped")]
    rows = [row for row in rows if row]
    if not rows:
        return None
    spoken = [r for r in rows if r.get("filler_count") is not None]
    paced = [r for r in rows if r.get("words_per_minute") is not None]
    cameras = [r["camera"] for r in rows if r.get("camera")]
    focuses = [r["focus"] for r in rows if r.get("focus")]
    ratings = [r["confidence_self_rating"] for r in rows if r.get("confidence_self_rating") is not None]
    span = sum(r["audio"]["speech_span_ms"] for r in paced)
    camera_samples = sum(c["samples"] for c in cameras)
    focus_ms = sum(f["observed_ms"] for f in focuses)
    return {
        "answers_observed": len(rows), "spoken_answers": len(spoken),
        "filler_count": sum(r["filler_count"] for r in spoken) if spoken else None,
        "words_per_minute": round(sum(r["recognized_word_count"] for r in paced)*60000/span) if span else None,
        "pause_count": sum(r["audio"]["pause_count"] for r in rows if r.get("audio")) if any(r.get("audio") for r in rows) else None,
        "face_presence_percent": percent(sum(c["face_samples"] for c in cameras),camera_samples),
        "page_visible_percent": percent(focus_ms-sum(f["hidden_ms"] for f in focuses),focus_ms),
        "confidence_self_rating": round(sum(ratings)/len(ratings),1) if ratings else None,
        "confidence_ratings": len(ratings), "limitations": rows[0]["limitations"],
    }
