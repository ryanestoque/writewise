"""Stage 1 Evaluation (ML_PIPELINE §5).

Runs once after fine-tuning completes. Evaluates the Stage 1 character
classifier against CCC's held-out 19,133-character test set.

Produces the exact metrics PRD §11 requires:
    - Overall accuracy (target: >=90%)
    - Per-class precision, recall, F1-score
    - Macro-averaged precision/recall/F1
    - 52x52 confusion matrix

Results saved to training/results/stage1_evaluation/.

Usage:
    python evaluate_stage1.py \
        --checkpoint checkpoints/stage1_best.keras \
        --test-dir data/processed/test \
        --output-dir results/stage1_evaluation
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate Stage 1 CNN on CCC test set.")
    parser.add_argument(
        "--checkpoint",
        type=str,
        required=True,
        help="Path to the Stage 1 .keras checkpoint.",
    )
    parser.add_argument(
        "--test-dir",
        type=str,
        default="data/processed/test",
        help="Path to the processed CCC test split directory.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="results/stage1_evaluation",
        help="Directory to save evaluation outputs.",
    )
    return parser.parse_args()


def load_test_data(test_dir: str) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Load test .npy files and return (images, labels_encoded, class_names)."""
    test_path = Path(test_dir)
    images = []
    labels = []

    for npy_file in sorted(test_path.glob("*.npy")):
        img = np.load(npy_file)
        label = npy_file.stem.split("_")[0]
        images.append(img)
        labels.append(label)

    if not images:
        return np.empty((0, 96, 96), dtype=np.uint8), np.empty(0, dtype=int), []

    images_arr = np.array(images, dtype=np.uint8)
    class_names = sorted(set(labels))
    label_to_idx = {name: idx for idx, name in enumerate(class_names)}
    labels_encoded = np.array([label_to_idx[l] for l in labels])

    return images_arr, labels_encoded, class_names


def preprocess_for_inference(images: np.ndarray) -> np.ndarray:
    """Preprocess images for MobileNetV2 inference: grayscale->3ch, normalize."""
    images_3ch = np.stack([images] * 3, axis=-1)
    images_norm = (images_3ch.astype(np.float32) / 127.5) - 1.0
    return images_norm


def main() -> None:
    args = parse_args()

    checkpoint_path = Path(args.checkpoint)
    test_dir = Path(args.test_dir)
    output_dir = Path(args.output_dir)

    if not checkpoint_path.exists():
        print(f"ERROR: checkpoint not found: {checkpoint_path}")
        sys.exit(1)

    if not test_dir.exists():
        print(f"ERROR: test directory not found: {test_dir}")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    print("Stage 1 Evaluation (ML_PIPELINE §5)")
    print(f"  Checkpoint: {checkpoint_path}")
    print(f"  Test dir:   {test_dir}")
    print(f"  Output dir: {output_dir}")
    print()

    # Load model
    print("Loading model...")
    import tensorflow as tf

    model = tf.keras.models.load_model(str(checkpoint_path))
    print(f"  Model loaded: {model.count_params():,} parameters")

    # Load test data
    print("Loading test data...")
    X_test, y_test, class_names = load_test_data(str(test_dir))
    print(f"  Test samples: {len(X_test)}")
    print(f"  Classes: {len(class_names)}")

    if len(X_test) == 0:
        print("ERROR: no test samples found in test directory.")
        sys.exit(1)

    # Preprocess
    X_test_prep = preprocess_for_inference(X_test)

    # Run inference
    print("Running inference on test set...")
    predictions = model.predict(X_test_prep, batch_size=64, verbose=1)
    y_pred = np.argmax(predictions, axis=1)

    # Compute metrics
    print("Computing metrics...")
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
    )

    accuracy = float(accuracy_score(y_test, y_pred))
    macro_precision = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    macro_recall = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))

    # Print summary
    print()
    print("=" * 60)
    print(f"  Overall Accuracy:     {accuracy:.4f} ({accuracy*100:.1f}%)")
    print(f"  Macro Precision:      {macro_precision:.4f}")
    print(f"  Macro Recall:         {macro_recall:.4f}")
    print(f"  Macro F1-Score:       {macro_f1:.4f}")
    print("  Target (PRD §11):     >=90.0%")
    print(f"  {'✅ PASS' if accuracy >= 0.90 else '❌ BELOW TARGET'}")
    print("=" * 60)

    # Save classification report
    report = classification_report(
        y_test, y_pred, target_names=class_names, zero_division=0
    )
    report_path = output_dir / "classification_report.txt"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("Stage 1 Evaluation — Classification Report\n")
        f.write(f"Checkpoint: {checkpoint_path}\n")
        f.write(f"Test samples: {len(X_test)}\n")
        f.write(f"\n{report}\n")
    print(f"\nClassification report saved to {report_path}")

    # Save confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    cm_path = output_dir / "confusion_matrix.csv"
    np.savetxt(cm_path, cm, delimiter=",", fmt="%d")
    print(f"Confusion matrix CSV saved to {cm_path}")

    # Save confusion matrix heatmap
    try:
        import matplotlib

        matplotlib.use("Agg")  # Non-interactive backend
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(16, 14))
        im = ax.imshow(cm, interpolation="nearest", cmap="Blues")
        ax.set_title("Stage 1 Confusion Matrix (CCC Test Set)", fontsize=14)
        ax.set_xlabel("Predicted", fontsize=12)
        ax.set_ylabel("True", fontsize=12)

        # Add class labels
        tick_positions = list(range(len(class_names)))
        ax.set_xticks(tick_positions)
        ax.set_xticklabels(class_names, rotation=90, fontsize=6)
        ax.set_yticks(tick_positions)
        ax.set_yticklabels(class_names, fontsize=6)

        plt.colorbar(im, ax=ax)
        plt.tight_layout()

        cm_img_path = output_dir / "confusion_matrix.png"
        plt.savefig(cm_img_path, dpi=150)
        plt.close()
        print(f"Confusion matrix heatmap saved to {cm_img_path}")
    except ImportError:
        print("  matplotlib not available — skipping confusion matrix heatmap")

    # Save machine-readable summary
    summary = {
        "checkpoint": str(checkpoint_path),
        "test_samples": len(X_test),
        "num_classes": len(class_names),
        "accuracy": round(accuracy, 6),
        "macro_precision": round(macro_precision, 6),
        "macro_recall": round(macro_recall, 6),
        "macro_f1": round(macro_f1, 6),
        "target_accuracy": 0.90,
        "passes_target": accuracy >= 0.90,
    }
    summary_path = output_dir / "summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary JSON saved to {summary_path}")


if __name__ == "__main__":
    main()
