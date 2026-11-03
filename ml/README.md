# Experimental coaching classifier

`feature_extractor.py` produces nine features in schema version 2:
`star_present`, `hedge_word_freq`, `filler_word_count`, `answer_length`,
`response_latency` (seconds), `code_correct`, `pause_count`, `grammar_errors`,
and `fluency_score` (0–100). A supplied zero is preserved. JavaScript parity is
checked against `backend/services/featureExtractor.js`.

`generate_synthetic.py` creates bootstrap examples and computes text features
from their actual text. `train_classifier.py` combines labeled/synthetic CSVs,
stratifies train/validation/test partitions, chooses standardized logistic
regression or random forest using validation accuracy, then evaluates once on
the untouched test partition. `evaluate.py` invokes this same pipeline.

From the root, with the backend environment activated:

```sh
python ml/generate_synthetic.py
python ml/train_classifier.py
python -m unittest discover -s ml -p 'test_*.py' -q
```

Training writes ignored `models/classifier.pkl` and tracked metadata in
`models/meta.json`. Inference checks schema and artifact hash before loading a
locally trusted model. Do not load a downloaded, untrusted pickle. If the artifact
is absent or incompatible, `infer.predict` returns a labeled text heuristic.

`backend/app/ml_service.py` adapts this function into the interview rubric.
Logistic-regression explanations show class-specific standardized contributions;
other models report observations rather than causal explanations. The classifier
cannot verify a resume claim: `resume-gap` and `silent-coding` predictions fall
back to text observations because the required evidence is not collected.

The current metadata describes **211 rows: 210 synthetic and 1 labeled seed**.
Validation accuracy was about 97.6%, and the 43-example synthetic-heavy test
partition scored 100%. These numbers measure this bootstrap dataset only.
`production_validated` is false. Independent real candidate data, annotation
agreement, grouped splits, and fairness/calibration evaluation remain required.
