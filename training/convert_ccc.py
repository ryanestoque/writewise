"""CCC Dataset Conversion (ML_PIPELINE §2).

Converts CCC (Cursive Character Challenge / C-Cube) dataset from its
official sequential multi-character .chr files into training-ready numpy arrays.

CCC .chr format (per character in training.chr / test.chr):
    - Line 1: width height dist_top dist_bottom dist_base_upper (integers)
    - Lines 2..height+1: height lines of width 0/1 strings (the pixel bitmap)
    - Line height+2: single character label (e.g., 'a', 'B', 'z')

Pipeline per character (ML_PIPELINE §2.2, §2.3):
    1. Parse stream -> grayscale numpy array (0/1 -> 255/0)
    2. Pad to square (preserves stroke proportions)
    3. Resize to 96x96 (MobileNetV2 standard input size)
    4. Save as .npy (both individual and combined arrays for fast Colab I/O)

Split (ML_PIPELINE §2.1):
    - training.chr (38,160 characters): 90% train (~34,344) / 10% val (~3,816)
    - test.chr (19,133 characters): untouched, used only for Stage 1 evaluation

Usage:
    python convert_ccc.py --raw-dir data/raw --output-dir data/processed
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np

TARGET_SIZE = 96  # ML_PIPELINE §2.3
VAL_FRACTION = 0.10  # ML_PIPELINE §2.1: ~10% of training pool for validation
RNG_SEED = 42  # Reproducible val split


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


def process_character(grayscale: np.ndarray) -> np.ndarray:
    """Full preprocessing pipeline: pad to square -> resize to 96x96."""
    squared = pad_to_square(grayscale)
    resized = cv2.resize(squared, (TARGET_SIZE, TARGET_SIZE), interpolation=cv2.INTER_AREA)
    return resized


def parse_chr_stream(filepath: Path) -> list[tuple[np.ndarray, str]]:
    """Parse a multi-character .chr file into processed 96x96 images and labels."""
    print(f"Reading and parsing {filepath.name} ({filepath.stat().st_size / (1024*1024):.1f} MB)...")
    samples: list[tuple[np.ndarray, str]] = []
    
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()

    total_lines = len(lines)
    idx = 0
    skipped = 0

    while idx < total_lines:
        line = lines[idx].strip()
        if not line:
            idx += 1
            continue

        tokens = line.split()
        if len(tokens) < 5:
            # Not a header line, skip
            idx += 1
            continue

        try:
            width = int(tokens[0])
            height = int(tokens[1])
        except ValueError:
            idx += 1
            continue

        # Check that we have enough lines for bitmap + label
        if idx + height + 1 >= total_lines:
            print(f"  WARNING: unexpected EOF at line {idx+1}")
            break

        # Read height bitmap lines
        raw_rows = []
        valid = True
        for r in range(height):
            row_str = lines[idx + 1 + r].strip()
            if len(row_str) != width:
                valid = False
                break
            raw_rows.append(row_str)

        label_line = lines[idx + 1 + height].strip()

        if not valid or not label_line or len(label_line) != 1:
            skipped += 1
            idx += 1 + height + 1
            continue

        # Fast vector conversion from ascii 0/1 strings to uint8 array
        try:
            raw_bytes = "".join(raw_rows).encode("ascii")
            bitmap = (np.frombuffer(raw_bytes, dtype=np.uint8) == ord("1")).astype(np.uint8).reshape((height, width))
            # 0 (background) -> 255, 1 (ink) -> 0
            grayscale = ((1 - bitmap) * 255).astype(np.uint8)
            processed = process_character(grayscale)
            samples.append((processed, label_line))
        except Exception as e:
            skipped += 1

        idx += 1 + height + 1

    print(f"  Parsed {len(samples)} valid characters (skipped {skipped}) from {filepath.name}")
    return samples


def save_split_data(
    samples: list[tuple[np.ndarray, str]],
    output_dir: Path,
    split_name: str,
) -> list[dict[str, Any]]:
    """Save split samples as individual .npy files and combined numpy matrices."""
    split_dir = output_dir / split_name
    split_dir.mkdir(parents=True, exist_ok=True)

    manifest_entries: list[dict[str, Any]] = []
    images_list = []
    labels_list = []

    print(f"Saving {split_name} split ({len(samples)} samples)...")
    t0 = time.time()

    for i, (img, label) in enumerate(samples):
        # Filename: e.g. a_00001.npy or D_00042.npy
        filename = f"{label}_{i:05d}.npy"
        np.save(split_dir / filename, img)
        images_list.append(img)
        labels_list.append(label)

        manifest_entries.append({
            "filename": filename,
            "label": label,
            "split": split_name,
            "sample_index": i,
        })

    # Also save combined matrices for ultra-fast Colab loading
    if images_list:
        np.save(split_dir / "images.npy", np.array(images_list, dtype=np.uint8))
        np.save(split_dir / "labels.npy", np.array(labels_list))

    elapsed = time.time() - t0
    print(f"  Saved {len(samples)} samples to {split_dir} in {elapsed:.1f}s")
    return manifest_entries


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert CCC dataset to training-ready format.")
    parser.add_argument(
        "--raw-dir",
        type=str,
        default="data/raw",
        help="Path to the raw CCC dataset directory containing training.chr and test.chr.",
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
        sys.exit(1)

    # Look for training.chr and test.chr
    train_file = raw_dir / "training.chr"
    if not train_file.exists():
        train_file = raw_dir / "train.chr"
    test_file = raw_dir / "test.chr"

    if not train_file.exists() or not test_file.exists():
        print(f"ERROR: missing training.chr or test.chr in {raw_dir}")
        print("Expected training.chr and test.chr from official Idiap CCC archive.")
        sys.exit(1)

    print("=" * 60)
    print("CCC Dataset Conversion (ML_PIPELINE §2)")
    print(f"  Raw directory:    {raw_dir}")
    print(f"  Output directory: {output_dir}")
    print(f"  Target size:      {TARGET_SIZE}x{TARGET_SIZE}")
    print(f"  Val fraction:     {VAL_FRACTION}")
    print("=" * 60)
    print()

    # 1. Parse training.chr
    train_pool = parse_chr_stream(train_file)
    if not train_pool:
        print("ERROR: No valid characters found in training file.")
        sys.exit(1)

    # 2. Split training pool into train / val (ML_PIPELINE §2.1)
    rng = np.random.default_rng(RNG_SEED)
    indices = rng.permutation(len(train_pool))
    val_count = int(len(train_pool) * VAL_FRACTION)
    val_indices = set(indices[:val_count])

    val_samples = [train_pool[i] for i in range(len(train_pool)) if i in val_indices]
    train_samples = [train_pool[i] for i in range(len(train_pool)) if i not in val_indices]

    print()
    print(f"Train/Val Split (seed={RNG_SEED}):")
    print(f"  Train: {len(train_samples):,} characters")
    print(f"  Val:   {len(val_samples):,} characters")
    print()

    # 3. Parse test.chr
    test_samples = parse_chr_stream(test_file)
    print(f"  Test:  {len(test_samples):,} characters")
    print()

    # 4. Save splits
    all_manifest: list[dict[str, Any]] = []
    all_manifest.extend(save_split_data(train_samples, output_dir, "train"))
    all_manifest.extend(save_split_data(val_samples, output_dir, "val"))
    all_manifest.extend(save_split_data(test_samples, output_dir, "test"))

    # 5. Extract unique classes and write class metadata
    all_classes = sorted(list({sample[1] for sample in train_pool} | {sample[1] for sample in test_samples}))
    class_info = {
        "num_classes": len(all_classes),
        "classes": all_classes,
        "class_to_idx": {c: i for i, c in enumerate(all_classes)},
    }
    with open(output_dir / "classes.json", "w", encoding="utf-8") as f:
        json.dump(class_info, f, indent=2)

    # 6. Write manifest CSV
    manifest_path = output_dir / "manifest.csv"
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["filename", "label", "split", "sample_index"])
        writer.writeheader()
        writer.writerows(all_manifest)

    print()
    print("=" * 60)
    print("SUCCESS: Conversion complete!")
    print(f"  Total processed: {len(all_manifest):,} characters across {len(all_classes)} classes")
    print(f"  Classes: {', '.join(all_classes)}")
    print(f"  Manifest: {manifest_path}")
    print(f"  Classes JSON: {output_dir / 'classes.json'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
