# Mistake Classifier workspace (Module 4 / Step 5-6)

## Layout
- `data/`            labeled samples: `answer_text, feature_values, mistake_label`
- `train_classifier.ipynb`  feature extraction + LogisticRegression/RandomForest training
- `evaluate.py`      prints accuracy + confusion matrix + feature importances

## Conventions (docs/rules.md)
- Classifier runs on extracted numeric/structured features — never raw LLM text.
- Always keep an explainability export (top features per prediction).
- scikit-learn only — no deep learning.
