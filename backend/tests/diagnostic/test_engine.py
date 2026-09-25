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
