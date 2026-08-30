"""ML inference module (ML_PIPELINE.md).

Public API:
    - run_letter_formation_inference(word_crops) -> LetterFormationResult
    - load_model() — called once at startup
"""

from app.ml.exceptions import ModelInferenceError
from app.ml.inference import run_letter_formation_inference
from app.ml.model import get_model, is_stub_mode, load_model
from app.ml.models import LetterFormationResult, WordFormationScore

__all__ = [
    "LetterFormationResult",
    "ModelInferenceError",
    "WordFormationScore",
    "get_model",
    "is_stub_mode",
    "load_model",
    "run_letter_formation_inference",
]
