"""Execute notebook code against small fixtures; no Colab or training run needed.

Run with backend/.venv/Scripts/python -m pytest training/tests/test_stage1_notebook.py.
STAGE1_NOTEBOOK can select the original notebook to reproduce the regressions.
"""

import ast
import json
import os
from pathlib import Path

import numpy as np
import pytest
import tensorflow as tf

NOTEBOOK = Path(
    os.environ.get(
        "STAGE1_NOTEBOOK", str(Path(__file__).parents[1] / "stage1_finetune_v2.ipynb")
    )
)


def code_cells():
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    return [
        "".join(cell["source"])
        for cell in notebook["cells"]
        if cell["cell_type"] == "code"
    ]


def execute_nodes(nodes, namespace):
    module = ast.fix_missing_locations(ast.Module(body=nodes, type_ignores=[]))
    exec(compile(module, str(NOTEBOOK), "exec"), namespace)  # noqa: S102 - trusted local cells


def notebook_function(name, namespace):
    for source in code_cells():
        for node in ast.parse(source).body:
            if isinstance(node, ast.FunctionDef) and node.name == name:
                execute_nodes([node], namespace)
                return namespace[name]
    raise AssertionError(f"Missing notebook function: {name}")


def loader():
    namespace = {
        "np": np,
        "Path": Path,
        "class_names": ["A", "B", "C"],
        "CLASS_NAMES": ["A", "B", "C"],
        "CLASS_TO_IDX": {"A": 0, "B": 1, "C": 2},
        "INPUT_SIZE": 96,
    }
    return notebook_function("load_split", namespace)


def save_split(path, labels):
    path.mkdir()
    np.save(path / "images.npy", np.full((len(labels), 96, 96), 255, dtype=np.uint8))
    np.save(path / "labels.npy", np.array(labels))


def test_missing_validation_class_does_not_shift_label_indices(tmp_path):
    save_split(tmp_path / "val", ["A", "C"])
    _, encoded, names = loader()(str(tmp_path / "val"))
    np.testing.assert_array_equal(encoded, [0, 2])
    assert names == ["A", "B", "C"]


def test_unknown_label_is_rejected(tmp_path):
    save_split(tmp_path / "val", ["A", "?"])
    with pytest.raises(ValueError, match="Unknown labels"):
        loader()(str(tmp_path / "val"))


def test_mismatched_image_and_label_counts_are_rejected(tmp_path):
    save_split(tmp_path / "val", ["A", "C"])
    np.save(tmp_path / "val" / "images.npy", np.zeros((1, 96, 96), dtype=np.uint8))
    with pytest.raises(ValueError, match="Image/label count"):
        loader()(str(tmp_path / "val"))


def test_augmentation_keeps_white_background_white():
    namespace = {"tf": tf, "np": np, "SEED": 42}
    source = next(source for source in code_cells() if "augmentation_layer =" in source)
    nodes = []
    for node in ast.parse(source).body:
        nodes.append(node)
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "augmentation_layer"
            for target in node.targets
        ):
            break
    execute_nodes(nodes, namespace)
    white = tf.ones((8, 96, 96, 3), dtype=tf.float32)
    augmented = namespace["augmentation_layer"](white, training=True).numpy()
    np.testing.assert_allclose(augmented, 1.0, atol=1e-5)


def dataset_builder():
    namespace = {
        "np": np,
        "tf": tf,
        "SEED": 42,
        "NUM_CLASSES": 2,
        "BATCH_SIZE": 32,
        "augmentation_layer": tf.keras.Sequential([tf.keras.layers.Identity()]),
    }
    notebook_function("transform_sample", namespace)
    return notebook_function("build_dataset", namespace)


def test_training_shuffle_can_draw_from_beyond_the_first_2000_samples():
    # Ordered groups reproduce the limited-buffer problem without a training run.
    labels = np.repeat([0, 1], 4096).astype(np.int32)
    images = np.broadcast_to((labels * 255)[:, None, None], (len(labels), 2, 2))
    images = images.astype(np.uint8)
    dataset = dataset_builder()(images, labels, augment=True)
    first_images, first_labels = next(iter(dataset))
    assert set(np.argmax(first_labels.numpy(), axis=1)) == {0, 1}
    # Shuffling must keep each image paired with its label.
    np.testing.assert_allclose(
        first_images[:, 0, 0, 0].numpy(),
        np.argmax(first_labels.numpy(), axis=1) * 2 - 1,
    )
    first_epoch = np.concatenate([np.argmax(y.numpy(), axis=1) for _, y in dataset])
    second_epoch = np.concatenate([np.argmax(y.numpy(), axis=1) for _, y in dataset])
    np.testing.assert_array_equal(np.bincount(first_epoch), [4096, 4096])
    assert not np.array_equal(first_epoch, second_epoch)


def test_clean_dataset_preserves_order_and_does_not_augment():
    labels = np.array([0, 1, 0], dtype=np.int32)
    images = np.stack([np.full((2, 2), v, np.uint8) for v in (0, 127, 255)])
    dataset = dataset_builder()(images, labels, augment=False)
    clean_images, clean_labels = next(iter(dataset))
    np.testing.assert_array_equal(np.argmax(clean_labels.numpy(), axis=1), labels)
    np.testing.assert_allclose(
        clean_images[:, 0, 0, 0].numpy(), images[:, 0, 0] / 127.5 - 1, atol=1e-7
    )


def test_diagnostics_reload_checkpoint_and_report_all_classes_without_test_data(
    tmp_path,
):
    diagnostic_cell = next(
        (source for source in code_cells() if "def evaluate_clean_split(" in source),
        None,
    )
    assert diagnostic_cell is not None, (
        "Missing clean train/validation diagnostics cell"
    )
    import matplotlib

    matplotlib.use("Agg")
    checkpoint = tmp_path / "stage1_best.keras"
    model = tf.keras.Sequential(
        [
            tf.keras.Input((2, 2, 3)),
            tf.keras.layers.GlobalAveragePooling2D(),
            tf.keras.layers.Dense(3, activation="softmax"),
        ]
    )
    model.set_weights([np.zeros((3, 3), np.float32), np.array([50, 0, 0], np.float32)])
    model.save(checkpoint)
    # The in-memory model is deliberately different from the saved checkpoint.
    model.set_weights([np.zeros((3, 3), np.float32), np.array([0, 5, 0], np.float32)])
    namespace = {
        "Path": Path,
        "json": json,
        "np": np,
        "tf": tf,
        "model": model,
        "SEED": 42,
        "NUM_CLASSES": 3,
        "BATCH_SIZE": 2,
        "class_names": ["A", "B", "C"],
        "CHECKPOINT_DIR": str(tmp_path),
        "checkpoint_path": str(checkpoint),
        "RUN_ID": "diagnostics-test",
        "selected_phase": "A",
        "X_train": np.full((2, 2, 2), 255, dtype=np.uint8),
        "y_train": np.array([0, 0], dtype=np.int32),
        "X_val": np.full((2, 2, 2), 255, dtype=np.uint8),
        "y_val": np.array([0, 2], dtype=np.int32),
    }
    notebook_function("transform_sample", namespace)
    notebook_function("build_dataset", namespace)
    exec(diagnostic_cell, namespace)  # noqa: S102 - trusted local notebook
    output_dir = tmp_path / "diagnostics"
    summary = json.loads((output_dir / "validation_summary.json").read_text())
    assert summary["checkpoint"] == str(checkpoint)
    assert summary["run_id"] == "diagnostics-test"
    assert summary["train_clean"]["accuracy"] == 1.0
    assert summary["val"]["accuracy"] == 0.5
    # Retain the logits-based training loss even for a confidently wrong class.
    assert summary["val"]["loss"] == pytest.approx(25.0)
    assert summary["val"]["macro_recall"] == pytest.approx(1 / 3)
    assert summary["val"]["missing_classes"] == ["B"]
    assert summary["generalization_gap_percentage_points"] == 50.0
    for split in ("train_clean", "val"):
        report = (output_dir / f"{split}_classification_report.txt").read_text()
        assert "B" in report and "C" in report
        matrix = np.loadtxt(output_dir / f"{split}_confusion_matrix.csv", delimiter=",")
        assert matrix.shape == (3, 3)
        assert matrix.sum() == 2
        assert (output_dir / f"{split}_confusion_matrix.png").exists()
    assert not (tmp_path / "evaluation").exists()


def test_fine_tuning_does_not_change_batch_normalization_state():
    # The top portion contains BN, so the original unfreeze policy breaks this.
    base = tf.keras.Sequential(
        [
            tf.keras.Input((4,)),
            tf.keras.layers.Dense(4),
            tf.keras.layers.Dense(4),
            tf.keras.layers.Dense(4),
            tf.keras.layers.BatchNormalization(),
        ]
    )
    model = tf.keras.Sequential([base, tf.keras.layers.Dense(3, activation="softmax")])
    base.trainable = False
    namespace = {"tf": tf, "base_model": base, "model": model}
    source = next(source for source in code_cells() if "freeze_until =" in source)
    nodes = []
    for node in ast.parse(source).body:
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
            call = node.value
            if isinstance(call.func, ast.Attribute) and call.func.attr == "compile":
                break
        nodes.append(node)
    execute_nodes(nodes, namespace)
    bn = base.layers[-1]
    before = [weight.copy() for weight in bn.get_weights()]
    dense_before = model.layers[-1].get_weights()[0].copy()
    model.compile(optimizer="adam", loss="categorical_crossentropy")
    model.train_on_batch(
        np.full((8, 4), 5, dtype=np.float32), np.tile([1, 0, 0], (8, 1))
    )
    for old, new in zip(before, bn.get_weights(), strict=True):
        np.testing.assert_array_equal(old, new)
    assert not np.array_equal(dense_before, model.layers[-1].get_weights()[0])


def test_each_notebook_cell_is_valid_python():
    for source in code_cells():
        compile(source, str(NOTEBOOK), "exec")


def test_data_directory_with_training_in_path_is_resolved(tmp_path):
    data_dir = tmp_path / "training" / "processed"
    for split in ("train", "val", "test"):
        (data_dir / split).mkdir(parents=True)
    resolve = notebook_function("resolve_processed_dir", {"Path": Path})
    assert resolve([str(tmp_path / "missing"), str(data_dir)]) == str(data_dir)
    assert resolve([str(data_dir / "train")]) == str(data_dir)


@pytest.mark.parametrize("validation_loss, expected_weight", [(0.8, 1.0), (0.4, 2.0)])
def test_phase_b_keeps_the_best_checkpoint_across_phases(
    tmp_path, validation_loss, expected_weight
):
    checkpoint = tmp_path / "stage1_best.keras"
    model = tf.keras.Sequential(
        [
            tf.keras.Input((1,)),
            tf.keras.layers.Dense(1, use_bias=False),
        ]
    )
    model.set_weights([np.array([[1.0]], dtype=np.float32)])
    model.save(checkpoint)
    namespace = {
        "tf": tf,
        "checkpoint_path": str(checkpoint),
        "CHECKPOINT_DIR": str(tmp_path),
        "phase_a_best_loss": 0.5,
    }
    source = next(source for source in code_cells() if "freeze_until =" in source)
    assignment = next(
        node
        for node in ast.parse(source).body
        if isinstance(node, ast.Assign)
        and any(
            isinstance(target, ast.Name) and target.id == "callbacks"
            for target in node.targets
        )
    )
    execute_nodes([assignment], namespace)
    checkpoint_callback = next(
        callback
        for callback in namespace["callbacks"]
        if isinstance(callback, tf.keras.callbacks.ModelCheckpoint)
    )
    checkpoint_callback.set_model(model)
    checkpoint_callback.on_train_begin()
    model.set_weights([np.array([[2.0]], dtype=np.float32)])
    checkpoint_callback.on_epoch_end(0, {"val_loss": validation_loss})
    restored = tf.keras.models.load_model(checkpoint, compile=False)
    np.testing.assert_array_equal(restored.get_weights()[0], [[expected_weight]])


def test_training_checkpoint_can_be_loaded_by_stage2(tmp_path):
    """Run both phases on tiny data, using random weights to avoid a network download."""
    import importlib.util

    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    names = list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    save_split(data_dir / "train", names)
    save_split(data_dir / "val", ["A", "C", "a", "y"])
    checkpoint_dir = tmp_path / "checkpoints"
    checkpoint_dir.mkdir()
    namespace = {
        "Path": Path,
        "json": json,
        "np": np,
        "tf": tf,
        "DATA_DIR": str(data_dir),
        "CHECKPOINT_DIR": str(checkpoint_dir),
        "RUN_ID": "smoke",
        "RUN_FINAL_TEST": False,
    }
    for index in (3, 5, 7, 9, 11, 13):
        tree = ast.parse("".join(notebook["cells"][index]["source"]))
        for node in ast.walk(tree):
            if isinstance(node, ast.keyword) and node.arg == "weights":
                node.value = ast.Constant(None)
            if isinstance(node, ast.keyword) and node.arg == "epochs":
                node.value = ast.Constant(1)
        execute_nodes(tree.body, namespace)

    checkpoint = checkpoint_dir / "stage1_best.keras"
    loaded = tf.keras.models.load_model(checkpoint)
    predictions = loaded(tf.ones((1, 96, 96, 3)), training=False).numpy()
    assert predictions.shape == (1, 52)
    np.testing.assert_allclose(predictions.sum(axis=1), [1], atol=1e-5)

    stage2_path = Path(__file__).parents[1] / "stage2_calibrate.py"
    spec = importlib.util.spec_from_file_location("stage2_for_smoke", stage2_path)
    stage2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(stage2)
    regression = stage2.build_regression_model(str(checkpoint))
    score = regression(tf.ones((1, 96, 96, 3)), training=False).numpy()
    assert score.shape == (1, 1)
    assert np.isfinite(score).all()
    for name in (
        "stage1_phase_a_best.keras",
        "phase_a_history.csv",
        "phase_b_history.csv",
        "run_config.json",
    ):
        assert (checkpoint_dir / name).exists()

    # The final test set cannot be consumed accidentally by Run all.
    with pytest.raises(RuntimeError, match="Final test is disabled"):
        final_cell = next(
            source for source in code_cells() if "if not RUN_FINAL_TEST:" in source
        )
        exec(final_cell, namespace)  # noqa: S102 - local cells
