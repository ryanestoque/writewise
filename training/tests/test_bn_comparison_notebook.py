"""Exercise the matched Phase B experiment without Colab or ImageNet downloads."""

import ast
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
import tensorflow as tf

NOTEBOOK = Path(__file__).parents[1] / "stage1_bn_comparison.ipynb"


def cells():
    assert NOTEBOOK.exists(), "Missing BN comparison notebook"
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    return ["".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code"]


def functions(namespace):
    nodes = [
        node
        for source in cells()
        for node in ast.parse(source).body
        if isinstance(node, ast.FunctionDef)
    ]
    module = ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[]))
    exec(compile(module, str(NOTEBOOK), "exec"), namespace)  # noqa: S102 - trusted notebook
    return namespace


def namespace():
    return functions(
        {
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
    )


def tiny_classifier():
    inputs = tf.keras.Input((96, 96, 3))
    x = tf.keras.layers.Conv2D(2, 1)(inputs)
    x = tf.keras.layers.BatchNormalization(name="early_bn")(x)
    x = tf.keras.layers.Conv2D(2, 1)(x)
    x = tf.keras.layers.BatchNormalization(name="upper_bn")(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    outputs = tf.keras.layers.Dense(52, activation="softmax")(x)
    return tf.keras.Model(inputs, outputs)


def test_all_cells_compile_and_final_test_requires_explicit_policy():
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


@pytest.mark.parametrize("freeze_bn", [True, False])
def test_only_upper_bn_can_adapt_and_lower_bn_stays_frozen(freeze_bn):
    ns = namespace()
    model = tiny_classifier()
    ns["configure_bn_policy"](model, freeze_bn)
    early = model.get_layer("early_bn")
    upper = model.get_layer("upper_bn")
    assert not early.trainable
    assert upper.trainable is (not freeze_bn)
    before_early = [w.copy() for w in early.get_weights()]
    before_upper = [w.copy() for w in upper.get_weights()]
    model.compile(optimizer="adam", loss="categorical_crossentropy")
    model.train_on_batch(
        np.full((2, 96, 96, 3), 5, dtype=np.float32), tf.one_hot([0, 1], 52)
    )
    assert all(np.array_equal(a, b) for a, b in zip(before_early, early.get_weights()))
    changed = any(
        not np.array_equal(a, b) for a, b in zip(before_upper, upper.get_weights())
    )
    assert changed is (not freeze_bn)


def test_matched_restarts_have_identical_shuffle_and_augmentation():
    ns = namespace()
    images = np.full((64, 96, 96), 255, dtype=np.uint8)
    images[:, 20:60, 30:35] = 0
    labels = np.arange(64, dtype=np.int32) % 52

    def batches():
        tf.keras.utils.set_random_seed(42)
        augmentation = ns["make_augmentation"]()
        dataset = ns["build_dataset"](
            images, labels, augment=True, augmentation=augmentation
        )
        return [(x.numpy(), y.numpy()) for x, y in dataset.take(3)]

    first, second = batches(), batches()
    for (x1, y1), (x2, y2) in zip(first, second, strict=True):
        np.testing.assert_array_equal(x1, x2)
        np.testing.assert_array_equal(y1, y2)
    white = tf.ones((2, 96, 96, 3))
    np.testing.assert_allclose(ns["make_augmentation"]()(white, training=True), white)


def test_validation_selection_uses_loss_then_macro_f1_and_prefers_frozen_on_ties():
    choose = namespace()["select_validation_winner"]

    def result(loss, f1, accuracy, frozen):
        return {
            "bn_frozen": frozen,
            "val": {"loss": loss, "macro_f1": f1, "accuracy": accuracy},
        }

    # Even a higher accuracy cannot override the primary validation-loss metric.
    candidates = {
        "adaptive_bn": result(0.6, 0.8, 0.9, False),
        "frozen_bn": result(0.5, 0.7, 0.8, True),
    }
    assert choose(candidates) == "frozen_bn"
    candidates["adaptive_bn"]["val"]["loss"] = 0.5
    assert choose(candidates) == "adaptive_bn"
    candidates["frozen_bn"]["val"] = candidates["adaptive_bn"]["val"].copy()
    assert choose(candidates) == "frozen_bn"


def test_both_variants_start_from_same_weights_preserve_source_and_load_in_stage2(
    tmp_path,
):
    import importlib.util

    ns = namespace()
    source = tmp_path / "source_phase_a.keras"
    source_model = tiny_classifier()
    for layer in source_model.layers[:-2]:
        layer.trainable = False
    source_model.save(source)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    images = np.stack([np.full((96, 96), v, np.uint8) for v in (0, 80, 170, 255)])
    labels = np.array([0, 1, 0, 1], dtype=np.int32)
    ns.update(
        {
            "SOURCE_PHASE_A": str(source),
            "SOURCE_PHASE_A_SHA256": source_hash,
            "CHECKPOINT_DIR": str(tmp_path / "comparison"),
            "X_train": images,
            "y_train": labels,
            "X_val": images,
            "y_val": labels,
            "run_config": {
                "run_id": "comparison-smoke",
                "experiment": "run4_bn_comparison",
                "source_run_id": "source-run",
                "selection_order": ["val_loss", "macro_f1", "accuracy"],
            },
            "RUN_ID": "comparison-smoke",
        }
    )
    results = {
        name: ns["run_bn_variant"](name, freeze_bn)
        for name, freeze_bn in (("frozen_bn", True), ("adaptive_bn", False))
    }
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
    assert (
        results["frozen_bn"]["initial_weight_sha256"]
        == results["adaptive_bn"]["initial_weight_sha256"]
    )
    assert results["frozen_bn"]["phase_a_val_loss"] == pytest.approx(
        results["adaptive_bn"]["phase_a_val_loss"], abs=1e-6
    )
    for name, result in results.items():
        output = tmp_path / "comparison" / name
        assert Path(result["checkpoint"]).is_file()
        assert (output / "phase_b_history.csv").is_file()
        assert (output / "training_history.json").is_file()
        metadata = json.loads((output / "run_config.json").read_text())
        assert metadata["bn_frozen"] is (name == "frozen_bn")
        assert metadata["source_phase_a_sha256"] == source_hash
        saved = tf.keras.models.load_model(result["checkpoint"], compile=False)
        saved.compile(loss="categorical_crossentropy", metrics=["accuracy"])
        metrics = saved.evaluate(
            ns["build_dataset"](images, labels), verbose=0, return_dict=True
        )
        assert metrics["loss"] <= result["phase_a_val_loss"] + 1e-6
        assert not (output / "evaluation").exists()

    import matplotlib

    matplotlib.use("Agg")
    ns["variant_results"] = results
    diagnostic_cell = next(s for s in cells() if "comparison_summaries = {}" in s)
    exec(diagnostic_cell, ns)  # noqa: S102 - trusted notebook
    summary_path = tmp_path / "comparison" / "comparison_summary.json"
    summary = json.loads(summary_path.read_text())
    assert set(summary["variants"]) == {"frozen_bn", "adaptive_bn"}
    assert summary["recommended_variant"] in summary["variants"]
    for name in results:
        assert summary["variants"][name]["val"]["samples"] == 4
        assert (
            tmp_path
            / "comparison"
            / name
            / "diagnostics"
            / "val_classification_report.txt"
        ).exists()

    stage2_path = Path(__file__).parents[1] / "stage2_calibrate.py"
    spec = importlib.util.spec_from_file_location("stage2_bn_smoke", stage2_path)
    stage2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage2)
    regression = stage2.build_regression_model(results["adaptive_bn"]["checkpoint"])
    assert regression(tf.ones((1, 96, 96, 3)), training=False).shape == (1, 1)


def test_branch_checkpoint_never_replaces_better_phase_a_with_worse_phase_b(tmp_path):
    ns = namespace()
    path = tmp_path / "stage1_best.keras"
    model = tiny_classifier()
    model.save(path)
    original_hash = hashlib.sha256(path.read_bytes()).hexdigest()
    callbacks = ns["phase_b_callbacks"](tmp_path, 0.5)
    callback = next(
        c for c in callbacks if isinstance(c, tf.keras.callbacks.ModelCheckpoint)
    )
    callback.set_model(model)
    callback.on_train_begin()
    callback.on_epoch_end(0, {"val_loss": 0.9})
    assert hashlib.sha256(path.read_bytes()).hexdigest() == original_hash


def test_phase_b_source_requires_frozen_backbone_and_rejects_a_finetuned_model():
    validate = namespace()["validate_phase_a_model"]
    model = tiny_classifier()
    with pytest.raises(ValueError, match="Phase A"):
        validate(model)
    for layer in model.layers[:-2]:
        layer.trainable = False
    validate(model)
