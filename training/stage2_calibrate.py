"""Stage 2 — Letter-formation regression head training & calibration (ML_PIPELINE §6).

Trains or initializes the regression head on top of the frozen Stage 1 backbone.

Two Operating Modes:
1. Baseline Mode (--baseline):
   Freezes the Stage 1 MobileNetV2 backbone, attaches the regression head
   (GlobalAveragePooling2D -> Dense(64, relu) -> Dropout -> Dense(1)), and
   initializes calibrated baseline weights (centered around 72.5) without
   requiring real classroom data. This produces a deployable artifact for
   immediate testing.

2. Real Calibration Mode (--paired-data-path <csv_path>):
   Trains the regression head against real Phase 1 teacher scores paired with
   extracted word crops.

Architecture (ML_PIPELINE §6.3):
    Frozen Stage 1 backbone (MobileNetV2, fine-tuned on CCC)
    -> GlobalAveragePooling2D
    -> Dense(64, activation='relu')
    -> Dropout(0.2)
    -> Dense(1, activation='linear')

Training target scale (ML_PIPELINE §6.4):
    Needs Improvement -> 12.5
    Developing         -> 37.5
    Satisfactory       -> 62.5
    Excellent          -> 87.5

Usage:
    # Baseline mode (immediate export without teacher data):
    python stage2_calibrate.py \
        --stage1-checkpoint checkpoints/stage1_best.keras \
        --output-path checkpoints/stage2_calibrated.keras \
        --baseline

    # Real calibration mode (once Phase 1 paired data exists):
    python stage2_calibrate.py \
        --stage1-checkpoint checkpoints/stage1_best.keras \
        --paired-data-path data/paired/export.csv \
        --output-path checkpoints/stage2_calibrated.keras
"""

import argparse
import os
from pathlib import Path
from typing import Optional, Tuple

import numpy as np

# Band mapping per ML_PIPELINE §6.4
BAND_TO_SCORE = {
    "needs_improvement": 12.5,
    "developing": 37.5,
    "satisfactory": 62.5,
    "excellent": 87.5,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train or initialize Stage 2 letter-formation regression head."
    )
    parser.add_argument(
        "--stage1-checkpoint",
        type=str,
        required=True,
        help="Path to the Stage 1 fine-tuned .keras checkpoint.",
    )
    parser.add_argument(
        "--paired-data-path",
        type=str,
        default=None,
        help="Path to CSV containing paired data (crop_path and score/band).",
    )
    parser.add_argument(
        "--baseline",
        action="store_true",
        help="Initialize baseline regression head without requiring paired data.",
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default="checkpoints/stage2_calibrated.keras",
        help="Path to save the combined model checkpoint.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Maximum training epochs for paired data training.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Training batch size.",
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=1e-3,
        help="Adam optimizer learning rate for head training.",
    )
    return parser.parse_args()


def build_regression_model(stage1_checkpoint: str):
    """Load Stage 1 model, freeze backbone, and attach Stage 2 regression head."""
    import tensorflow as tf

    print(f"Loading Stage 1 checkpoint: {stage1_checkpoint}")
    stage1_model = tf.keras.models.load_model(stage1_checkpoint)

    # Locate the pooling layer or extract features from the convolutional base
    gap_layer = None
    for layer in stage1_model.layers:
        if isinstance(layer, tf.keras.layers.GlobalAveragePooling2D):
            gap_layer = layer
            break

    if gap_layer is not None:
        features = gap_layer.output
    else:
        # If no GAP in Stage 1, take layer right before classification head
        features = tf.keras.layers.GlobalAveragePooling2D(name="stage2_gap")(
            stage1_model.layers[-2].output
        )

    # Freeze all convolutional backbone layers (ML_PIPELINE §6.3)
    for layer in stage1_model.layers:
        if layer == gap_layer:
            break
        layer.trainable = False
    if gap_layer is not None:
        gap_layer.trainable = False

    # Attach regression head (Dense(64, relu) -> Dropout -> Dense(1))
    x = tf.keras.layers.Dense(64, activation="relu", name="stage2_dense64")(features)
    x = tf.keras.layers.Dropout(0.2, name="stage2_dropout")(x)
    output = tf.keras.layers.Dense(1, activation="linear", name="letter_formation_score")(x)

    model = tf.keras.Model(
        inputs=stage1_model.input,
        outputs=output,
        name="writewise_letter_formation",
    )

    print(f"Total model parameters: {model.count_params():,}")
    print(f"Trainable parameters in head: {sum(np.prod(p.shape) for p in model.trainable_weights):,}")
    return model


def initialize_baseline_head(model, baseline_target: float = 72.5):
    """Set regression head weights for calibrated baseline score output."""
    dense_out = model.get_layer("letter_formation_score")
    weights, biases = dense_out.get_weights()

    # Small normal distribution for weights, with target score as bias
    np.random.seed(42)
    weights = np.random.normal(loc=0.0, scale=0.01, size=weights.shape).astype(np.float32)
    biases = np.array([baseline_target], dtype=np.float32)
    dense_out.set_weights([weights, biases])
    print(f"Regression head initialized with baseline bias: {baseline_target} (Satisfactory band)")
    return model


def load_paired_dataset(csv_path: str, batch_size: int = 32):
    """Load paired crop paths and rubric scores from CSV."""
    import csv
    import cv2
    import tensorflow as tf

    crops = []
    scores = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            crop_path = row.get("crop_path") or row.get("image_path")
            if not crop_path or not os.path.exists(crop_path):
                continue

            # Parse score or band
            if "score" in row and row["score"]:
                score_val = float(row["score"])
            elif "band" in row and row["band"]:
                band_key = row["band"].strip().lower()
                score_val = BAND_TO_SCORE.get(band_key, 62.5)
            else:
                continue

            crops.append(crop_path)
            scores.append(score_val)

    if not crops:
        raise ValueError(f"No valid image pairs found in CSV: {csv_path}")

    print(f"Loaded {len(crops)} paired samples from {csv_path}")

    # Split 90/10 train/val
    indices = np.arange(len(crops))
    np.random.seed(42)
    np.random.shuffle(indices)

    val_count = max(1, int(len(crops) * 0.1))
    train_idx, val_idx = indices[val_count:], indices[:val_count]

    def generator(idx_list):
        for idx in idx_list:
            path = crops[idx]
            target_score = scores[idx]

            # Load image (supports .npy, .jpg, .png)
            if path.endswith(".npy"):
                img = np.load(path)
            else:
                img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)

            if img is None:
                continue

            # Pad to square
            h, w = img.shape[:2]
            side = max(h, w)
            pad_top = (side - h) // 2
            pad_bottom = side - h - pad_top
            pad_left = (side - w) // 2
            pad_right = side - w - pad_left
            padded = cv2.copyMakeBorder(
                img, pad_top, pad_bottom, pad_left, pad_right,
                cv2.BORDER_CONSTANT, value=255
            )

            # Resize to 96x96 and 3 channels
            resized = cv2.resize(padded, (96, 96))
            three_ch = np.stack([resized] * 3, axis=-1)
            norm = (three_ch.astype(np.float32) / 127.5) - 1.0

            yield norm, np.float32(target_score)

    output_signature = (
        tf.TensorSpec(shape=(96, 96, 3), dtype=tf.float32),
        tf.TensorSpec(shape=(), dtype=tf.float32),
    )

    train_ds = (
        tf.data.Dataset.from_generator(lambda: generator(train_idx), output_signature=output_signature)
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )
    val_ds = (
        tf.data.Dataset.from_generator(lambda: generator(val_idx), output_signature=output_signature)
        .batch(batch_size)
        .prefetch(tf.data.AUTOTUNE)
    )

    return train_ds, val_ds


def main():
    args = parse_args()

    if not args.baseline and not args.paired_data_path:
        print("ERROR: Specify either --baseline for initialized weights or --paired-data-path for training.")
        return

    import tensorflow as tf

    # 1. Build regression model with frozen Stage 1 backbone
    model = build_regression_model(args.stage1_checkpoint)

    # 2. Train on paired data OR initialize baseline
    if args.baseline:
        print("\n--- Running in Baseline Mode ---")
        model = initialize_baseline_head(model)
    else:
        print(f"\n--- Training on Paired Data: {args.paired_data_path} ---")
        train_ds, val_ds = load_paired_dataset(args.paired_data_path, batch_size=args.batch_size)

        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate),
            loss=tf.keras.losses.MeanSquaredError(),
            metrics=[tf.keras.metrics.MeanAbsoluteError(name="mae")],
        )

        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=7,
                restore_best_weights=True,
                verbose=1,
            )
        ]

        model.fit(
            train_ds,
            validation_data=val_ds,
            epochs=args.epochs,
            callbacks=callbacks,
            verbose=1,
        )

    # 3. Sanity check forward pass
    dummy = np.random.uniform(-1.0, 1.0, size=(2, 96, 96, 3)).astype(np.float32)
    preds = model(dummy, training=False).numpy()
    print(f"\nSanity check prediction shape: {preds.shape}, sample outputs: {preds.flatten()[:2]}")

    # 4. Save checkpoint
    out_dir = Path(args.output_path).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    model.save(args.output_path)
    print(f"\nSuccessfully saved Stage 2 calibrated model to: {args.output_path}")


if __name__ == "__main__":
    main()
