import re


def _tokenize(s: str) -> list[str]:
    return [t for t in re.sub(r"[^a-zA-Z0-9_]", " ", s).lower().split() if t]


def _freq(arr: list[str]) -> dict:
    m = {}
    for t in arr:
        m[t] = m.get(t, 0) + 1
    return m


def code_similarity(submitted: str = "", known: str = "") -> float:
    a = _tokenize(submitted)
    b = _tokenize(known)
    if not a or not b:
        return 0.0

    fa, fb = _freq(a), _freq(b)
    keys = set(fa) | set(fb)
    inter = mag_a = mag_b = 0
    for k in keys:
        x, y = fa.get(k, 0), fb.get(k, 0)
        inter += x * y
        mag_a += x * x
        mag_b += y * y
    denom = (mag_a ** 0.5) * (mag_b ** 0.5) or 1
    return round(inter / denom, 2)


def similarity_flag(score: float) -> str:
    if score >= 0.8:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"