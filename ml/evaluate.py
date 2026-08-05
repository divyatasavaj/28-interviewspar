import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import joblib

# Placeholder training stub for STEP 6.
# Real pipeline is filled once labeled data exists in data/ (Step 5).

LABELS = ["good-answer", "rambling", "no-structure", "resume-gap", "silent-coding", "underselling"]

FEATURE_COLUMNS = [
    "star_present",      # 0/1
    "hedge_word_freq",   # count
    "filler_word_count", # count
    "answer_length",     # words
    "response_latency",  # seconds
    "code_correct",      # 0/1 (technical only)
]

def load_data(csv_path="data/labeled_answers.csv"):
    df = pd.read_csv(csv_path)
    X = df[FEATURE_COLUMNS]
    y = df["mistake_label"]
    return train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

def train():
    X_train, X_test, y_train, y_test = load_data()
    # baseline
    lr = LogisticRegression(max_iter=1000).fit(X_train, y_train)
    rf = RandomForestClassifier(n_estimators=200, random_state=42).fit(X_train, y_train)
    for name, model in [("LogReg", lr), ("RandomForest", rf)]:
        pred = model.predict(X_test)
        print(f"\n=== {name} ===")
        print("accuracy:", accuracy_score(y_test, pred))
        print(confusion_matrix(y_test, pred))
        print(classification_report(y_test, pred, zero_division=0))
    # pick + save the better one in real run
    joblib.dump(rf, "models/classifier.pkl")

if __name__ == "__main__":
    train()
