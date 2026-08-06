# STEP 6 — Python feature extractor (mirrors backend/services/featureExtractor.js).
# Deterministic, rule-based numeric features so the classifier input is defensible (rules.md §4).
import re

FILLER_WORDS = [
    "um", "uh", "like", "you know", "basically", "actually", "literally",
    "right", "okay", "so", "well", "hmm", "i mean",
]
HEDGE_WORDS = [
    "maybe", "i think", "sort of", "kind of", "perhaps", "possibly",
    "i guess", "somewhat", "might", "probably", "i suppose", "not sure",
]
STAR_WORDS = ["situation", "task", "action", "result", "when i", "we ", "because"]

FEATURE_COLUMNS = [
    "star_present", "hedge_word_freq", "filler_word_count",
    "answer_length", "response_latency", "code_correct",
]


def extract_features(text="", response_latency=0.0, code_correct=0):
    text = text or ""
    lower = " " + text.lower() + " "
    words = text.strip().split()
    # whole-word / phrase counting (handles multi-word fillers like "you know")
    filler = sum(len(re.findall(r"(?<!\w)" + re.escape(w) + r"(?!\w)", lower)) for w in FILLER_WORDS)
    hedge = sum(len(re.findall(r"(?<!\w)" + re.escape(w) + r"(?!\w)", lower)) for w in HEDGE_WORDS)
    star = 1 if any(w in lower for w in STAR_WORDS) else 0
    return {
        "star_present": star,
        "hedge_word_freq": hedge,
        "filler_word_count": filler,
        "answer_length": len(words),
        "response_latency": float(response_latency),
        "code_correct": int(code_correct),
    }


if __name__ == "__main__":
    print(extract_features("um i think maybe we should sort of try a hashmap"))
