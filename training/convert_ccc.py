"""CCC Dataset Conversion (ML_PIPELINE §2).

Converts CCC (Cursive Character Challenge / C-Cube) dataset from its
proprietary .chr binary format into training-ready numpy arrays.

CCC .chr format (per character):
    - Line 1: width height (integers)
    - Line 2: baseline upperline (integers, metadata — preserved but not used for pixels)
    - Lines 3+: rows of space-separated 0/1 values (the pixel bitmap)

Pipeline per character (ML_PIPELINE §2.2, §2.3):
    1. Parse .chr -> grayscale numpy array (0/1 -> 255/0)
    2. Pad to square (preserves stroke proportions)
    3. Resize to 96x96 (MobileNetV2's smallest pretrained input size)
    4. Save as .npy

Split (ML_PIPELINE §2.1):
    CCC ships its own predefined split — used as-is.
    Training pool (38,160): ~90% train (~34,300) / ~10% val (~3,800)
    Test (19,133): untouched, used only for Stage 1 evaluation

Usage:
    python convert_ccc.py --raw-dir data/raw --output-dir data/processed

    The raw-dir should contain the CCC dataset organized by split:
        data/raw/
        ├── trn/          # Training characters
        └── tst/          # Test characters

    Each split directory contains subdirectories per class (character label),
    each containing .chr files.
"""

import argparse
import csv
import sys
from pathlib import Path
from typing import Any

import cv2
import numpy as np

TARGET_SIZE = 96  # ML_PIPELINE §2.3
VAL_FRACTION = 0.10  # ML_PIPELINE §2.1: ~10% of training pool for validation
RNG_SEED = 42  # Reproducible val split


def parse_chr_file(filepath: Path) -> np.ndarray | None:
    """Parse a single CCC .chr file into a grayscale numpy array.

    Returns None if the file cannot be parsed (logs a warning).
    """
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        if len(lines) < 3:
            print(f"  WARNING: skipping {filepath} — fewer than 3 lines")
            return None

        # Line 1: width height
        dims = lines[0].strip().split()
        width, height = int(dims[0]), int(dims[1])

        # Line 2: baseline upperline (metadata — not used for pixel data)
        # Lines 3+: pixel bitmap (0/1 values)
        pixel_rows = []
        for line in lines[2:]:
            tokens = line.strip().split()
            if not tokens:
                continue
            row = [int(x) for x in tokens]
            if len(row) == width:
                pixel_rows.append(row)

        if len(pixel_rows) != height:
            print(
                f"  WARNING: skipping {filepath} — expected {height} rows, "
                f"got {len(pixel_rows)}"
            )
            return None

        # Convert to grayscale: 0 (background) -> 255, 1 (ink) -> 0
        # CCC convention: 1 = ink/foreground, 0 = background
        bitmap = np.array(pixel_rows, dtype=np.uint8)
        grayscale = ((1 - bitmap) * 255).astype(np.uint8)

        return grayscale

    except Exception as e:
        print(f"  WARNING: failed to parse {filepath}: {e}")
        return None


def pad_to_square(img: np.ndarray) -> np.ndarray:
    """Pad image to square with white (255) padding, preserving stroke proportions."""
    h, w = img.shape
    if h == w:
        return img
    size = max(h, w)
    padded = np.full((size, size), 255, dtype=np.uint8)
    y_offset = (size - h) // 2
    x_offset = (size - w) // 2
    padded[y_offset : y_offset + h, x_offset : x_offset + w] = img
    return padded


def process_character(img: np.ndarray) -> np.ndarray:
    """Full preprocessing pipeline: pad to square -> resize to 96x96."""
    squared = pad_to_square(img)
    resized = cv2.resize(squared, (TARGET_SIZE, TARGET_SIZE), interpolation=cv2.INTER_AREA)
    return resized


def discover_characters(split_dir: Path) -> list[tuple[Path, str]]:
    """Discover all .chr files in a split directory, organized by class label.

    Returns list of (filepath, label) tuples.
    """
    characters: list[tuple[Path, str]] = []
    if not split_dir.exists():
        print(f"  WARNING: split directory does not exist: {split_dir}")
        return characters

    for class_dir in sorted(split_dir.iterdir()):
        if not class_dir.is_dir():
            continue
        label = class_dir.name
        for chr_file in sorted(class_dir.glob("*.chr")):
            characters.append((chr_file, label))

    return characters


def convert_split(
    characters: list[tuple[Path, str]],
    output_dir: Path,
    split_name: str,
) -> list[dict[str, Any]]:
    """Convert a list of (filepath, label) pairs and save to output_dir.

    Returns manifest entries for CSV output.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_entries: list[dict[str, Any]] = []
    converted = 0
    skipped = 0

    for filepath, label in characters:
        img = parse_chr_file(filepath)
        if img is None:
            skipped += 1
            continue

        processed = process_character(img)

        # Save as .npy with descriptive filename
        out_name = f"{label}_{filepath.stem}.npy"
        out_path = output_dir / out_name
        np.save(out_path, processed)

        manifest_entries.append({
            "filename": out_name,
            "label": label,
            "split": split_name,
            "source_file": str(filepath.name),
        })
        converted += 1

    print(f"  {split_name}: {converted} converted, {skipped} skipped")
    return manifest_entries


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert CCC dataset to training-ready format.")
    parser.add_argument(
        "--raw-dir",
        type=str,
        default="data/raw",
        help="Path to the raw CCC dataset directory.",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/processed",
        help="Path for the processed output.",
    )
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    output_dir = Path(args.output_dir)

    if not raw_dir.exists():
        print(f"ERROR: raw directory does not exist: {raw_dir}")
        print("Download the CCC dataset first — see training/README.md")
        sys.exit(1)

    print("CCC Dataset Conversion")
    print(f"  Raw directory:    {raw_dir}")
    print(f"  Output directory: {output_dir}")
    print(f"  Target size:      {TARGET_SIZE}x{TARGET_SIZE}")
    print(f"  Val fraction:     {VAL_FRACTION}")
    print()

    # Discover training and test characters
    trn_dir = raw_dir / "trn"
    tst_dir = raw_dir / "tst"

    print("Discovering characters...")
    train_chars = discover_characters(trn_dir)
    test_chars = discover_characters(tst_dir)
    print(f"  Training pool: {len(train_chars)} characters")
    print(f"  Test set:      {len(test_chars)} characters")
    print()

    if not train_chars:
        print("ERROR: no training characters found. Check the raw directory structure.")
        print("Expected: data/raw/trn/<class_label>/*.chr")
        sys.exit(1)

    # Split training pool into train/val (ML_PIPELINE §2.1)
    rng = np.random.default_rng(RNG_SEED)
    indices = rng.permutation(len(train_chars))
    val_count = int(len(train_chars) * VAL_FRACTION)
    val_indices = set(indices[:val_count])

    val_chars = [train_chars[i] for i in range(len(train_chars)) if i in val_indices]
    actual_train_chars = [train_chars[i] for i in range(len(train_chars)) if i not in val_indices]

    print(f"Train/val split (seed={RNG_SEED}):")
    print(f"  Train: {len(actual_train_chars)} characters")
    print(f"  Val:   {len(val_chars)} characters")
    print()

    # Convert each split
    all_manifest: list[dict[str, Any]] = []

    print("Converting training set...")
    all_manifest.extend(convert_split(actual_train_chars, output_dir / "train", "train"))

    print("Converting validation set...")
    all_manifest.extend(convert_split(val_chars, output_dir / "val", "val"))

    print("Converting test set...")
    all_manifest.extend(convert_split(test_chars, output_dir / "test", "test"))

    # Write manifest CSV
    manifest_path = output_dir / "manifest.csv"
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "label", "split", "source_file"])
        writer.writeheader()
        writer.writerows(all_manifest)

    print()
    print(f"Done! Manifest written to {manifest_path}")
    print(f"Total characters processed: {len(all_manifest)}")


if __name__ == "__main__":
    main()
