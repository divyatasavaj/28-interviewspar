# STEP 6 — train + evaluate the mistake classifier (scikit-learn only).
# Trains Logistic Regression (baseline) and Random Forest, picks the better by test
# accuracy, saves the model + metadata, and prints accuracy / confusion matrix /
# feature importances (required for the report, steps.md Step 6).
import csv
import json
import sys
import os

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import joblib

sys.path.insert(0, os.path.dirname(__file__))
from feature_extractor import FEATURE_COLUMNS

FEATURES = FEATURE_COLUMNS
LABELS = ["good-answer", "rambling", "no-structure", "resume-gap", "silent-coding", "underselling"]
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "classifier.pkl")
META_PATH = os.path.join(MODEL_DIR, "meta.json")


def load_rows(path):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        r = csv.DictReader(f)
        return [row for row in r if row.get("mistake_label") in LABELS]


def main():
    # prefer real collected data; fall back to synthetic bootstrap
    real = load_rows("data/labeled_answers.csv")
    synth = load_rows("data/synthetic_answers.csv")
    rows = real + synth
    if len(rows) < 20:
        print("Not enough data to train (need >=20 rows). Collect samples or run generate_synthetic.py.")
        sys.exit(1)
    print(f"training on {len(real)} real + {len(synth)} synthetic = {len(rows)} rows")

    df = pd.DataFrame(rows)
    for c in FEATURES:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)
    df["mistake_label"] = df["mistake_label"].astype(str)
    X = df[FEATURES]
    y = df["mistake_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    lr = LogisticRegression(max_iter=1000).fit(X_train, y_train)
    rf = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_train, y_train)

    results = {}
    for name, model in [("logreg", lr), ("randomforest", rf)]:
        pred = model.predict(X_test)
        results[name] = accuracy_score(y_test, pred)

    best_name = max(results, key=results.get)
    best = lr if best_name == "logreg" else rf
    print("\n=== accuracies ===", results, "-> best:", best_name)

    pred = best.predict(X_test)
    cm = confusion_matrix(y_test, pred, labels=LABELS).tolist()
    report = classification_report(y_test, pred, labels=LABELS, zero_division=0)

    # feature importance / contribution for explainability
    if hasattr(best, "feature_importances_"):
        importances = best.feature_importances_.tolist()
    else:
        # logistic regression: mean |coef| across classes
        importances = np.abs(best.coef_).mean(axis=0).tolist()
    feature_importance = dict(zip(FEATURES, importances))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(best, MODEL_PATH)
    meta = {
        "model": best_name,
        "features": FEATURES,
        "labels": LABELS,
        "accuracy": results[best_name],
        "confusion_matrix": cm,
        "feature_importance": feature_importance,
        "n_samples": len(rows),
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print("\nconfusion matrix (labels order):", LABELS)
    print(cm)
    print("\nclassification report:\n", report)
    print("feature importance:", feature_importance)
    print(f"\nsaved model -> {MODEL_PATH}\nmeta -> {META_PATH}")


if __name__ == "__main__":
    main()
