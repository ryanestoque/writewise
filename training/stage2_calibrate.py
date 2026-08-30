"""Stage 2 — Letter-formation regression head training (ML_PIPELINE §6).

Trains the regression head on top of the frozen Stage 1 backbone using
paired teacher-score / word-crop data from Phase 1.

Cannot run until real paired data exists from Phase 1's manual-score
collection. See ML_PIPELINE.md §6 for full architecture details.

Architecture:
    Frozen Stage 1 backbone (MobileNetV2, fine-tuned on CCC)
    -> GlobalAveragePooling2D
    -> Dense(64, relu)
    -> Dense(1)

Training target scale (ML_PIPELINE §6.4):
    Needs Improvement -> 12.5
    Developing         -> 37.5
    Satisfactory       -> 62.5
    Excellent          -> 87.5

Loss: MSE against these numeric targets.

Usage:
    python stage2_calibrate.py \
        --paired-data-path data/paired/export.csv \
        --stage1-checkpoint checkpoints/stage1_best.keras \
        --output-path checkpoints/stage2_head.keras
"""

import argparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train the Stage 2 letter-formation regression head."
    )
    parser.add_argument(
        "--paired-data-path",
        type=str,
        required=True,
        help="Path to the exported paired data (teacher scores + word crop paths).",
    )
    parser.add_argument(
        "--stage1-checkpoint",
        type=str,
        required=True,
        help="Path to the Stage 1 fine-tuned .keras checkpoint.",
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default="checkpoints/stage2_head.keras",
        help="Path to save the trained Stage 2 head checkpoint.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Maximum training epochs (early stopping may terminate earlier).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Training batch size.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print("Stage 2 calibration requested:")
    print(f"  Paired data:       {args.paired_data_path}")
    print(f"  Stage 1 checkpoint: {args.stage1_checkpoint}")
    print(f"  Output path:       {args.output_path}")
    print(f"  Max epochs:        {args.epochs}")
    print(f"  Batch size:        {args.batch_size}")
    print()
    raise NotImplementedError(
        "Stage 2 training cannot run yet — awaiting paired data from Phase 1. "
        "See ML_PIPELINE.md §6 and PRD.md §5 for the dependency chain."
    )


if __name__ == "__main__":
    main()
