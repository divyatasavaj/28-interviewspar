import re

FILLER_WORDS = {"um", "uh", "like", "ah", "er", "hmm", "well", "actually", "basically", "literally", "you know", "i mean"}


def detect_filler_words(transcript: str) -> int:
    if not transcript:
        return 0
    lower = transcript.lower()
    count = 0
    for word in FILLER_WORDS:
        count += len(re.findall(r'\b' + re.escape(word) + r'\b', lower))
    return count


def detect_pauses(word_timestamps: list[dict] = None) -> dict:
    if not word_timestamps or len(word_timestamps) < 2:
        return {"pause_count": 0, "pause_ms_total": 0}
    pauses = []
    for i in range(1, len(word_timestamps)):
        gap = word_timestamps[i].get("start", 0) - word_timestamps[i - 1].get("end", 0)
        if gap > 500:
            pauses.append(gap)
    return {
        "pause_count": len(pauses),
        "pause_ms_total": sum(pauses) if pauses else 0,
    }


def check_grammar(transcript: str) -> int:
    if not transcript:
        return 0
    sentences = re.split(r'[.!?]+', transcript)
    errors = 0
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if s[0].islower():
            errors += 1
        if s and s[-1] not in ".!?":
            errors += 1
    return errors


def compute_fluency_score(transcript: str = None, word_timestamps: list[dict] = None) -> dict:
    filler_count = detect_filler_words(transcript or "")
    pause_data = detect_pauses(word_timestamps)
    grammar_errors = check_grammar(transcript or "")

    word_count = len((transcript or "").split())
    if word_count == 0:
        return {"filler_count": 0, "pause_ms_total": 0, "grammar_errors": 0, "score": 1.0}

    filler_penalty = min(filler_count / max(word_count, 1) * 2, 0.3)
    pause_penalty = min(pause_data.get("pause_ms_total", 0) / 30000, 0.2)
    grammar_penalty = min(grammar_errors / max(word_count, 1) * 3, 0.2)
    score = max(0.0, 1.0 - filler_penalty - pause_penalty - grammar_penalty)

    return {
        "filler_count": filler_count,
        "pause_ms_total": pause_data.get("pause_ms_total", 0),
        "grammar_errors": grammar_errors,
        "score": round(score, 2),
    }
