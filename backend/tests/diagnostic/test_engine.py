from app.diagnostic.engine import generate_diagnostic_overlay


def make_sample_raw_output():
    return {
        "guide_lines": {
            "baseline_y": [420, 680],
            "midline_y": [360, 620],
            "topline_y": [300, 560],
        },
        "lines": [
            {
                "line_index": 0,
                "words": [
                    {
                        "word_index": 0,
                        "bbox": [50, 360, 80, 60],
                        "slant_deg": 12.0,
                        "baseline_deviation_ratio": 0.04,
                        "size_ratio": 0.95,
                        "letter_formation_score": 82.0,
                        "measured_baseline_y": 420,
                    },
                    {
                        "word_index": 1,
                        "bbox": [180, 350, 100, 75],
                        "slant_deg": 34.0,  # Outlier
                        "baseline_deviation_ratio": 0.16,  # Outlier
                        "size_ratio": 1.35,  # Outlier
                        "letter_formation_score": 45.0,  # Outlier
                    },
                ],
                "word_gaps": [3.6],  # Outlier gap
                "intra_word_gaps": [0.3],
            }
        ],
        "aggregate": {
            "slant": {"mean": 23.0, "std": 11.0},
            "word_spacing": {"mean": 3.6, "std": 0.0},
            "letter_spacing": {"mean": 0.3, "std": 0.0},
            "baseline_deviation": {"mean": 0.10, "std": 0.06},
            "size_consistency": {"mean": 1.15, "std": 0.20},
            "letter_formation": {"mean": 63.5, "std": 18.5},
        },
    }


def test_generate_diagnostic_overlay_structure():
    raw_output = make_sample_raw_output()
    overlay = generate_diagnostic_overlay(raw_output)

    assert "summary" in overlay
    assert "baseline" in overlay
    assert "spacing" in overlay
    assert "size" in overlay
    assert "slant" in overlay
    assert "letter_formation" in overlay

    # Check baseline
    assert len(overlay["baseline"]["guide_lines"]["baseline_y"]) == 2
    assert len(overlay["baseline"]["annotations"]) == 2
    assert overlay["baseline"]["annotations"][0]["severity"] == "normal"
    assert overlay["baseline"]["annotations"][0]["measured_y"] == 420
    assert overlay["baseline"]["annotations"][1]["severity"] == "needs_attention"
    assert overlay["baseline"]["annotations"][1]["measured_y"] is None

    # Check spacing
    assert len(overlay["spacing"]["annotations"]) == 1
    assert overlay["spacing"]["annotations"][0]["severity"] == "needs_attention"

    # Check slant
    assert overlay["slant"]["annotations"][1]["severity"] == "needs_attention"

    # Check letter formation
    assert overlay["letter_formation"]["annotations"][1]["severity"] == "needs_attention"

    # Check summary count
    assert overlay["summary"]["attention_item_count"] >= 4


def test_generate_diagnostic_overlay_resilient_on_empty_input():
    empty_raw = {"guide_lines": {}, "lines": []}
    overlay = generate_diagnostic_overlay(empty_raw)
    assert overlay["summary"]["attention_item_count"] == 0
    assert len(overlay["baseline"]["annotations"]) == 0


def test_diagnostic_engine_passes_saliency_polygons_to_formation_annotation():
    raw_output = {
        "guide_lines": {"baseline_y": [100], "midline_y": [80], "topline_y": [60]},
        "lines": [
            {
                "line_index": 0,
                "words": [
                    {
                        "word_index": 0,
                        "bbox": [50, 70, 80, 40],
                        "letter_formation_score": 45.0,
                        "saliency_polygons": [[[60, 80], [70, 80], [65, 95]]],
                    }
                ],
            }
        ],
    }

    overlay = generate_diagnostic_overlay(raw_output)
    formation = overlay["letter_formation"]["annotations"]

    assert len(formation) == 1
    assert formation[0]["saliency_polygons"] == [[[60, 80], [70, 80], [65, 95]]]
    assert formation[0]["severity"] == "needs_attention"


def test_slant_inter_word_outlier_detection_in_line():
    """Matches the user's scenario: [9°, 1°, 3°, 26°] on one line."""
    raw_output = {
        "guide_lines": {"baseline_y": [400], "midline_y": [350], "topline_y": [300]},
        "lines": [
            {
                "line_index": 0,
                "words": [
                    {"word_index": 0, "bbox": [10, 340, 40, 60], "slant_deg": 9.0},
                    {"word_index": 1, "bbox": [60, 340, 50, 60], "slant_deg": 1.0},
                    {"word_index": 2, "bbox": [120, 340, 45, 60], "slant_deg": 3.0},
                    {"word_index": 3, "bbox": [180, 340, 45, 60], "slant_deg": 26.0},
                ],
            }
        ],
    }

    overlay = generate_diagnostic_overlay(raw_output)
    slant_ann = overlay["slant"]["annotations"]

    assert len(slant_ann) == 4
    # The first 3 are close to the line median (6.0°)
    assert slant_ann[0]["severity"] == "normal"
    assert slant_ann[1]["severity"] == "normal"
    assert slant_ann[2]["severity"] == "normal"

    # Word 3 (26.0°) deviates sharply (> 6° from median 6.0°) on a high-variance line
    assert slant_ann[3]["severity"] == "needs_attention"
    assert "irregular slant" in slant_ann[3]["note"].lower()
    assert "deviates" in slant_ann[3]["note"].lower()
