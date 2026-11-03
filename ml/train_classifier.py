"""Train on recomputed features; select on validation and report untouched test results."""

import csv
import hashlib
import json
from pathlib import Path
import joblib
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
from feature_extractor import FEATURE_COLUMNS, extract_features

ROOT = Path(__file__).resolve().parent
LABELS = [
    "good-answer",
    "rambling",
    "no-structure",
    "resume-gap",
    "silent-coding",
    "underselling",
]


def main():
    groups = {
        name: list(csv.DictReader((ROOT / "data" / name).read_text().splitlines()))
        for name in ["labeled_answers.csv", "synthetic_answers.csv"]
    }
    rows = [
        r
        for group in groups.values()
        for r in group
        if r.get("mistake_label") in LABELS
    ]
    X = pd.DataFrame(
        [
            extract_features(
                r["answer_text"],
                float(r.get("response_latency") or 0),
                int(r.get("code_correct") or 0),
                int(r.get("pause_count") or 0),
                int(r.get("grammar_errors") or 0),
                (
                    float(r["fluency_score"])
                    if r.get("fluency_score") not in ("", None)
                    else 100
                ),
            )
            for r in rows
        ],
        columns=FEATURE_COLUMNS,
    )
    y = pd.Series([r["mistake_label"] for r in rows])
    X_train, X_hold, y_train, y_hold = train_test_split(
        X, y, test_size=0.4, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_hold, y_hold, test_size=0.5, random_state=43, stratify=y_hold
    )
    candidates = {
        "logreg": Pipeline(
            [
                ("scale", StandardScaler()),
                ("classifier", LogisticRegression(max_iter=2000)),
            ]
        ),
        "randomforest": RandomForestClassifier(n_estimators=200, random_state=42),
    }
    validation = {}
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        validation[name] = accuracy_score(y_val, model.predict(X_val))
    name = max(validation, key=validation.get)
    model = candidates[name]
    predictions = model.predict(X_test)
    model_dir = ROOT / "models"
    model_dir.mkdir(exist_ok=True)
    artifact = model_dir / "classifier.pkl"
    joblib.dump(model, artifact)
    metadata = {
        "feature_schema_version": 2,
        "model": name,
        "features": FEATURE_COLUMNS,
        "labels": LABELS,
        "validation_accuracy": validation,
        "accuracy": accuracy_score(y_test, predictions),
        "confusion_matrix": confusion_matrix(
            y_test, predictions, labels=LABELS
        ).tolist(),
        "n_samples": len(rows),
        "test_samples": len(y_test),
        "real_samples": len(groups["labeled_answers.csv"]),
        "synthetic_samples": len(groups["synthetic_answers.csv"]),
        "data_provenance": "synthetic bootstrap; not validated for candidate assessment",
        "production_validated": False,
        "artifact_sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
    }
    (model_dir / "meta.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(
        json.dumps(
            {
                k: v
                for k, v in metadata.items()
                if k not in ("artifact_sha256", "confusion_matrix")
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
