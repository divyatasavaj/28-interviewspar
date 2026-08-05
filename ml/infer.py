# STEP 6 — inference + explainability. Loads the trained model and returns the mistake
# label plus the top contributing features for THAT prediction (rules.md §4 / PRD Module 4).
# Reads a JSON object from stdin: {"answer_text": "...", "response_latency": 0, "code_correct": 0}
# Prints a JSON object: {"label": ..., "confidence": ..., "top_features": [...], "source": ...}
import sys
import os
import json

sys.path.insert(0, os.path.dirname(__file__))
from feature_extractor import extract_features, FEATURE_COLUMNS

MODEL_PATH = "models/classifier.pkl"
META_PATH = "models/meta.json"

# Heuristic fallback when no model is trained yet (so the flow still works in demos).
def heuristic(feats):
    if feats["answer_length"] <= 25 and feats["code_correct"] == 0:
        return "silent-coding"
    if feats["filler_word_count"] >= 4 or feats["answer_length"] >= 180:
        return "rambling"
    if feats["star_present"] == 0 and feats["answer_length"] < 110:
        return "no-structure"
    if feats["hedge_word_freq"] >= 3:
        return "underselling"
    return "good-answer"


def top_features(feats, meta, pred_label):
    # contribution ~ feature_value * importance (RF) or * |coef| (logreg)
    importances = meta.get("feature_importance", {})
    contribs = {}
    for f in FEATURE_COLUMNS:
        v = feats[f]
        imp = importances.get(f, 0)
        contribs[f] = round(v * imp, 4)
    ranked = sorted(contribs.items(), key=lambda kv: abs(kv[1]), reverse=True)[:3]
    return [{"feature": k, "value": feats[k], "weight": v} for k, v in ranked]


def main():
    payload = json.loads(sys.stdin.read() or "{}")
    feats = extract_features(
        payload.get("answer_text", ""),
        response_latency=float(payload.get("response_latency", 0) or 0),
        code_correct=int(payload.get("code_correct", 0) or 0),
    )

    if os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
        import joblib
        model = joblib.load(MODEL_PATH)
        meta = json.load(open(META_PATH))
        # build feature vector in the order the model expects (as DataFrame to keep names)
        import pandas as pd
        X = pd.DataFrame([[feats[f] for f in meta["features"]]], columns=meta["features"])
        pred = model.predict(X)[0]
        try:
            proba = model.predict_proba(X)[0]
            classes = list(model.classes_)
            confidence = round(float(proba[classes.index(pred)]), 3)
        except Exception:
            confidence = None
        out = {
            "label": pred,
            "confidence": confidence,
            "top_features": top_features(feats, meta, pred),
            "source": "model:" + meta.get("model", "?"),
        }
    else:
        label = heuristic(feats)
        out = {
            "label": label,
            "confidence": None,
            "top_features": [
                {"feature": k, "value": feats[k], "weight": None}
                for k in ["filler_word_count", "answer_length", "star_present"]
            ],
            "source": "heuristic",
        }
    print(json.dumps(out))


if __name__ == "__main__":
    main()
