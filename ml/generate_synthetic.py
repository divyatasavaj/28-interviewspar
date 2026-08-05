# STEP 5/6 — synthetic bootstrap data generator.
# Used ONLY to exercise the training pipeline before the team's real 150-300 samples
# exist (steps.md Step 5 allows LLM-assisted synthetic labeling). Real collection via
# the in-app Data Collect page overwrites/appends to labeled_answers.csv; this script
# writes to synthetic_answers.csv so it never pollutes the real collection file.
import csv
import random

OUT = "data/synthetic_answers.csv"
HEADER = [
    "answer_text", "star_present", "hedge_word_freq", "filler_word_count",
    "answer_length", "response_latency", "code_correct", "mistake_label",
]

# Per-label feature signatures (mean-ish values) used to fabricate plausible rows.
SIGNATURES = {
    "good-answer": dict(star=1, hedge=0, filler=0, length=(80, 160), lat=4.0, code=1),
    "rambling":     dict(star=0, hedge=2, filler=6, length=(180, 320), lat=7.0, code=0),
    "no-structure": dict(star=0, hedge=1, filler=1, length=(40, 110), lat=3.0, code=0),
    "resume-gap":   dict(star=1, hedge=1, filler=1, length=(30, 90), lat=2.0, code=0),
    "silent-coding":dict(star=0, hedge=0, filler=0, length=(5, 25), lat=12.0, code=0),
    "underselling": dict(star=1, hedge=4, filler=1, length=(40, 100), lat=3.0, code=1),
}

FILLER = ["um", "uh", "like", "you know", "basically", "i mean", "well"]
HEDGE = ["maybe", "i think", "sort of", "kind of", "perhaps", "i guess", "probably"]
STAR = ["situation", "task", "action", "result", "when i", "we", "because"]


def make_text(label, sig):
    parts = []
    if sig["star"] and random.random() < 0.8:
        parts.append(random.choice(STAR))
    if label == "rambling":
        parts += random.choices(FILLER, k=random.randint(3, 8))
        parts += ["so", "then", "and", "like", "we", "um", "you know"] * 3
    if label == "underselling":
        parts += random.choices(HEDGE, k=random.randint(3, 5))
    if label == "silent-coding":
        parts = ["ok"] 
    # pad to target length with neutral words
    while len(" ".join(parts).split()) < sig["length"][0]:
        parts.append(random.choice(["the", "project", "team", "worked", "on", "a", "solution", "build", "system"]))
    random.shuffle(parts)
    return " ".join(parts)


def main(n_per_label=35):
    random.seed(42)
    rows = []
    for label, sig in SIGNATURES.items():
        for _ in range(n_per_label):
            text = make_text(label, sig)
            lo, hi = sig["length"]
            length = max(lo, min(hi, len(text.split())))
            rows.append([
                text,
                sig["star"] if "star" in sig else 0,
                sig["hedge"] if label == "underselling" else (random.randint(0, 2) if label == "rambling" else random.randint(0, 1)),
                sig["filler"] if label == "rambling" else random.randint(0, 2),
                length,
                round(sig["lat"] + random.uniform(-1, 1), 1),
                sig["code"] if label in ("good-answer", "underselling") else 0,
                label,
            ])
    random.shuffle(rows)
    with open(OUT, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(rows)
    print(f"wrote {len(rows)} synthetic rows -> {OUT}")


if __name__ == "__main__":
    main()
