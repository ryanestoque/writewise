"""Combined model export (ML_PIPELINE §7).

Combines the frozen Stage 1 backbone + trained Stage 2 regression head
into a single .keras artifact for deployment on Railway.

The combined model takes a preprocessed 96x96x3 input and outputs a
single scalar (letter-formation score, nominally in [0, 100]).

Usage:
    python export_model.py \
        --stage1-checkpoint checkpoints/stage1_best.keras \
        --stage2-checkpoint checkpoints/stage2_head.keras \
        --output-path artifacts/writewise_model.keras
"""

import argparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export combined Stage 1 + Stage 2 model artifact."
    )
    parser.add_argument(
        "--stage1-checkpoint",
        type=str,
        required=True,
        help="Path to the Stage 1 fine-tuned .keras checkpoint.",
    )
    parser.add_argument(
        "--stage2-checkpoint",
        type=str,
        required=True,
        help="Path to the trained Stage 2 regression head .keras checkpoint.",
    )
    parser.add_argument(
        "--output-path",
        type=str,
        default="artifacts/writewise_model.keras",
        help="Path to save the combined deployable .keras artifact.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    print("Model export requested:")
    print(f"  Stage 1 checkpoint: {args.stage1_checkpoint}")
    print(f"  Stage 2 checkpoint: {args.stage2_checkpoint}")
    print(f"  Output path:       {args.output_path}")
    print()
    raise NotImplementedError(
        "Model export cannot run yet — awaiting trained Stage 2 head. "
        "See ML_PIPELINE.md §7 for the export pipeline."
    )


if __name__ == "__main__":
    main()
