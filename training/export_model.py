"""Combined model export & validation (ML_PIPELINE §7).

Packages and verifies the final .keras model artifact for production deployment
on Supabase Storage and Railway.

The final model:
- Accepts: (None, 96, 96, 3) float32 normalized [-1, 1]
- Emits: (None, 1) float32 letter-formation score [0, 100]

Usage:
    # Export directly from calibrated Stage 2 model:
    python export_model.py \
        --model-path checkpoints/stage2_calibrated.keras \
        --output-path artifacts/writewise-model.keras

    # Or assemble from Stage 1 checkpoint directly in baseline mode:
    python export_model.py \
        --stage1-checkpoint checkpoints/stage1_best.keras \
        --baseline \
        --output-path artifacts/writewise-model.keras
"""

import argparse
from pathlib import Path

import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export and validate deployable WriteWise CNN model artifact."
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default=None,
        help="Path to a Stage 2 calibrated .keras model.",
    )
    parser.add_argument(
        "--stage1-checkpoint",
        type=str,
        default=None,
        help="Path to Stage 1 checkpoint (if assembling baseline directly).",
    )
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="If using --stage1-checkpoint, initialize a baseline regression head.",
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default="artifacts/writewise-model.keras",
        help="Output path for the final .keras artifact.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    import tensorflow as tf

    if args.model_path and Path(args.model_path).exists():
        print(f"Loading calibrated model from: {args.model_path}")
        model = tf.keras.models.load_model(args.model_path)
    elif args.stage1_checkpoint and Path(args.stage1_checkpoint).exists():
        print(f"Assembling deployable model from Stage 1 checkpoint: {args.stage1_checkpoint}")
        from stage2_calibrate import build_regression_model, initialize_baseline_head

        model = build_regression_model(args.stage1_checkpoint)
        model = initialize_baseline_head(model)
    else:
        print("ERROR: Provide a valid --model-path or --stage1-checkpoint.")
        return

    # 1. Validate Input Shape
    input_shape = model.input_shape
    print(f"Model Input Shape:  {input_shape}")
    if input_shape[1:] != (96, 96, 3):
        raise ValueError(f"Expected input shape (*, 96, 96, 3), got {input_shape}")

    # 2. Validate Output Shape
    output_shape = model.output_shape
    print(f"Model Output Shape: {output_shape}")
    if output_shape[1:] != (1,):
        raise ValueError(f"Expected output shape (*, 1), got {output_shape}")

    # 3. Test dummy forward pass
    print("\nRunning test forward pass on dummy crops...")
    dummy_input = np.random.uniform(-1.0, 1.0, size=(4, 96, 96, 3)).astype(np.float32)
    predictions = model(dummy_input, training=False).numpy()
    print(f"  Test batch size:   4")
    print(f"  Prediction shape:  {predictions.shape}")
    print(f"  Sample scores:     {[round(float(s[0]), 2) for s in predictions]}")

    # 4. Save clean deployment artifact
    out_path = Path(args.output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(out_path))

    artifact_size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"\nSuccessfully exported production artifact: {out_path}")
    print(f"Artifact file size: {artifact_size_mb:.2f} MB")
    print(f"Total parameters:   {model.count_params():,}")
    print(
        "\nDeployment Next Step:\n"
        f"  Upload {out_path.name} to the Supabase Storage bucket 'model-artifacts'.\n"
        "  FastAPI will load this file at container startup during lifespan initialization."
    )


if __name__ == "__main__":
    main()
