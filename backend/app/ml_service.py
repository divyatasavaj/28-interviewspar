"""Load the repository's shared numeric classifier without spawning an interpreter."""

import importlib.util
import sys
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def classifier():
    root = Path(__file__).resolve().parents[2] / "ml"
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    spec = importlib.util.spec_from_file_location(
        "interviewspar_classifier", root / "infer.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.predict


def predict(payload):
    return classifier()(payload)
