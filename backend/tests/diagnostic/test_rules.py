from app.diagnostic.rules import (
    evaluate_baseline_drift,
    evaluate_letter_formation,
    evaluate_size_consistency,
    evaluate_slant,
    evaluate_word_gap,
)


def test_evaluate_baseline_drift():
    sev, note = evaluate_baseline_drift(0.04)
    assert sev == "normal"
    assert "consistent" in note.lower()

    sev, note = evaluate_baseline_drift(0.18)
    assert sev == "needs_attention"
    assert "18%" in note


def test_evaluate_word_gap():
    sev, note = evaluate_word_gap(2.0)
    assert sev == "normal"

    sev, note = evaluate_word_gap(3.5)
    assert sev == "needs_attention"
    assert "wide" in note.lower()

    sev, note = evaluate_word_gap(0.8)
    assert sev == "needs_attention"
    assert "tight" in note.lower()


def test_evaluate_size_consistency():
    sev, note = evaluate_size_consistency(1.0)
    assert sev == "normal"

    sev, note = evaluate_size_consistency(1.35)
    assert sev == "needs_attention"
    assert "exceed" in note.lower()


def test_evaluate_slant():
    sev, vector, note = evaluate_slant(12.0, [100, 200, 80, 50])
    assert sev == "normal"
    assert len(vector) == 4

    sev, vector, note = evaluate_slant(35.0, [100, 200, 80, 50])
    assert sev == "needs_attention"
    assert "steep" in note.lower()


def test_evaluate_letter_formation():
    sev, band, note = evaluate_letter_formation(75.0)
    assert sev == "normal"
    assert band == "satisfactory"

    sev, band, note = evaluate_letter_formation(45.0)
    assert sev == "needs_attention"
    assert band == "developing"
