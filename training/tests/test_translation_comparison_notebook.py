"""Exercise the translation ablation on small fixtures without Colab or downloads."""

import ast
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
import tensorflow as tf

NOTEBOOK = Path(__file__).parents[1] / "stage1_translation_comparison.ipynb"


def cells():
    assert NOTEBOOK.exists(), "Missing translation comparison notebook"
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    return ["".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code"]


def namespace():
    ns = {
        "np": np,
        "tf": tf,
        "json": json,
        "hashlib": hashlib,
        "Path": Path,
        "SEED": 42,
        "INPUT_SIZE": 96,
        "NUM_CLASSES": 52,
        "BATCH_SIZE": 2,
        "PHASE_B_EPOCHS": 1,
        "PHASE_B_LEARNING_RATE": 1e-5,
        "EARLY_STOPPING_PATIENCE": 5,
        "class_names": list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"),
    }
    nodes = [
        node
        for source in cells()
        for node in ast.parse(source).body
        if isinstance(node, ast.FunctionDef)
    ]
    module = ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[]))
    exec(compile(module, str(NOTEBOOK), "exec"), ns)  # noqa: S102 - trusted notebook
    return ns


def tiny_classifier():
    inputs = tf.keras.Input((96, 96, 3))
    x = tf.keras.layers.Conv2D(2, 1)(inputs)
    x = tf.keras.layers.BatchNormalization(name="early_bn")(x)
    x = tf.keras.layers.Conv2D(2, 1)(x)
    x = tf.keras.layers.BatchNormalization(name="upper_bn")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outputs = tf.keras.layers.Dense(52, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs)


def test_cells_compile_and_final_evaluation_requires_both_explicit_choices():
    sources = cells()
    for source in sources:
        compile(source, str(NOTEBOOK), "exec")
    final_cell = next(s for s in sources if "if not RUN_FINAL_TEST:" in s)
    with pytest.raises(RuntimeError, match="Final test is disabled"):
        exec(final_cell, {"RUN_FINAL_TEST": False})  # noqa: S102 - trusted notebook
    with pytest.raises(RuntimeError, match="FINAL_VARIANT"):
        exec(  # noqa: S102 - trusted notebook
            final_cell, {"RUN_FINAL_TEST": True, "FINAL_VARIANT": None}
        )


def test_rotation_and_zoom_match_but_zero_translation_preserves_their_output():
    make = namespace()["make_augmentation"]
    current, disabled = make(0.05), make(0.0)
    probe = np.ones((4, 96, 96, 3), np.float32)
    probe[:, 10:80, 30:35] = -1
    current_output = tf.constant(probe)
    disabled_output = tf.constant(probe)
    # Both factories use the same rotation/zoom draws before the translation layer.
    for index in (0, 1):
        current_output = current.layers[index](current_output, training=True)
        disabled_output = disabled.layers[index](disabled_output, training=True)
    np.testing.assert_array_equal(current_output, disabled_output)
    unchanged = disabled.layers[2](disabled_output, training=True)
    shifted = current.layers[2](current_output, training=True)
    np.testing.assert_allclose(unchanged, disabled_output, atol=1e-6)
    assert not np.allclose(shifted, current_output)
    white = tf.ones((4, 96, 96, 3))
    for factor in (0.05, 0.0):
        np.testing.assert_allclose(make(factor)(white, training=True), white, atol=1e-6)


def test_both_policies_keep_matching_shuffle_and_repeatable_random_sequences():
    ns = namespace()
    images = np.full((64, 96, 96), 255, np.uint8)
    images[:, 20:70, 30:35] = 0
    labels = np.arange(64, dtype=np.int32) % 52

    def batches(factor):
        tf.keras.utils.set_random_seed(42)
        dataset = ns["build_dataset"](
            images, labels, augment=True, augmentation=ns["make_augmentation"](factor)
        )
        return [(x.numpy(), y.numpy()) for x, y in dataset.take(3)]

    current, disabled, repeat = batches(0.05), batches(0.0), batches(0.0)
    for (_, y1), (x2, y2), (x3, y3) in zip(current, disabled, repeat, strict=True):
        np.testing.assert_array_equal(y1, y2)
        np.testing.assert_array_equal(x2, x3)
        np.testing.assert_array_equal(y2, y3)


def test_winner_uses_validation_loss_then_f1_and_keeps_current_translation_on_ties():
    choose = namespace()["select_validation_winner"]

    def result(factor, loss, f1, accuracy):
        return {
            "translation_factor": factor,
            "val": {"loss": loss, "macro_f1": f1, "accuracy": accuracy},
        }

    candidates = {
        "no_translation": result(0.0, 0.6, 0.9, 0.95),
        "translation_5pct": result(0.05, 0.5, 0.8, 0.85),
    }
    assert choose(candidates) == "translation_5pct"
    candidates["no_translation"]["val"]["loss"] = 0.5
    assert choose(candidates) == "no_translation"
    candidates["translation_5pct"]["val"] = candidates["no_translation"]["val"].copy()
    assert choose(candidates) == "translation_5pct"


def test_source_hash_mismatch_stops_before_loading_or_training(tmp_path):
    ns = namespace()
    source = tmp_path / "changed.keras"
    source.write_bytes(b"changed")
    ns.update({"SOURCE_PHASE_A": str(source), "SOURCE_PHASE_A_SHA256": "original-hash"})
    with pytest.raises(RuntimeError, match="source Phase A checkpoint changed"):
        ns["run_translation_variant"]("no_translation", 0.0)


def test_matched_adaptive_bn_training_saves_reports_and_preserves_source(tmp_path):
    import importlib.util

    import matplotlib

    matplotlib.use("Agg")
    ns = namespace()
    source = tmp_path / "phase_a.keras"
    model = tiny_classifier()
    for layer in model.layers[:-2]:
        layer.trainable = False
    model.save(source)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    images = np.stack([np.full((96, 96), v, np.uint8) for v in (0, 80, 170, 255)])
    labels = np.array([0, 1, 0, 1], np.int32)
    ns.update(
        {
            "SOURCE_PHASE_A": str(source),
            "SOURCE_PHASE_A_SHA256": source_hash,
            "CHECKPOINT_DIR": str(tmp_path / "comparison"),
            "X_train": images,
            "y_train": labels,
            "X_val": images,
            "y_val": labels,
            "RUN_ID": "translation-smoke",
            "run_config": {
                "experiment": "run5_translation_comparison",
                "run_id": "translation-smoke",
                "source_run_id": "source-run",
                "selection_order": ["val_loss", "macro_f1", "accuracy"],
            },
        }
    )
    results = {
        name: ns["run_translation_variant"](name, factor)
        for name, factor in (("translation_5pct", 0.05), ("no_translation", 0.0))
    }
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    assert len({r["initial_weight_sha256"] for r in results.values()}) == 1
    assert results["translation_5pct"]["phase_a_val_loss"] == pytest.approx(
        results["no_translation"]["phase_a_val_loss"], abs=1e-6
    )
    for name, result in results.items():
        config_path = tmp_path / "comparison" / name / "run_config.json"
        config = json.loads(config_path.read_text())
        assert config["bn_frozen"] is False
        assert config["translation_factor"] == (
            0.05 if name == "translation_5pct" else 0.0
        )
        saved = tf.keras.models.load_model(result["checkpoint"], compile=False)
        assert saved.get_layer("upper_bn").trainable
        assert not saved.get_layer("early_bn").trainable
        saved.compile(loss="categorical_crossentropy", metrics=["accuracy"])
        evaluated = saved.evaluate(
            ns["build_dataset"](images, labels), verbose=0, return_dict=True
        )
        assert evaluated["loss"] <= result["phase_a_val_loss"] + 1e-6

    ns["variant_results"] = results
    diagnostic_cell = next(s for s in cells() if "comparison_summaries = {}" in s)
    exec(diagnostic_cell, ns)  # noqa: S102 - trusted notebook
    summary_path = tmp_path / "comparison" / "comparison_summary.json"
    summary = json.loads(summary_path.read_text())
    assert summary["experiment"] == "run5_translation_comparison"
    assert set(summary["variants"]) == {"translation_5pct", "no_translation"}
    for name, result in results.items():
        detail = summary["variants"][name]
        assert detail["translation_factor"] == result["translation_factor"]
        assert detail["bn_frozen"] is False
        assert detail["val"]["samples"] == 4
        output = tmp_path / "comparison" / name
        assert (output / "diagnostics" / "val_classification_report.txt").is_file()
        assert not (output / "evaluation").exists()

    stage2_path = Path(__file__).parents[1] / "stage2_calibrate.py"
    spec = importlib.util.spec_from_file_location(
        "stage2_translation_smoke", stage2_path
    )
    stage2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage2)
    regression = stage2.build_regression_model(results["no_translation"]["checkpoint"])
    assert regression(tf.ones((1, 96, 96, 3)), training=False).shape == (1, 1)
