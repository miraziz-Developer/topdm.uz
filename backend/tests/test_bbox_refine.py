from PIL import Image

from app.application.visual_search.bbox_refine import (
    build_body_part_detections,
    estimate_person_silhouette_bbox,
    is_invalid_outfit_bbox,
    snap_bbox_to_subject,
)


def test_rejects_side_tree_column():
    bbox = {"x": 0.02, "y": 0.12, "w": 0.18, "h": 0.72}
    assert is_invalid_outfit_bbox(bbox) is True


def test_accepts_torso_box():
    bbox = {"x": 0.28, "y": 0.22, "w": 0.44, "h": 0.24}
    assert is_invalid_outfit_bbox(bbox) is False


def test_snap_pulls_box_to_subject_column():
    bbox = {"x": 0.04, "y": 0.42, "w": 0.20, "h": 0.28}
    snapped = snap_bbox_to_subject(bbox, 0.5, 0.55, category="pants")
    assert snapped["x"] >= 0.12
    assert snapped["x"] + snapped["w"] <= 0.92


def test_body_parts_return_two_slots():
    pil = Image.new("RGB", (400, 800), (90, 150, 70))
    for y in range(120, 720):
        for x in range(140, 260):
            pil.putpixel((x, y), (20, 20, 20) if y < 420 else (130, 130, 130))
    items = build_body_part_detections(pil, color="qora")
    assert len(items) >= 2
    ids = [item["id"] for item in items]
    assert ids[0] == "top"
    assert "pants" in ids


def test_person_bbox_centered():
    pil = Image.new("RGB", (400, 800), (90, 150, 70))
    for y in range(100, 700):
        for x in range(150, 250):
            pil.putpixel((x, y), (40, 40, 40))
    person = estimate_person_silhouette_bbox(pil)
    assert 0.30 <= person["x"] + person["w"] / 2 <= 0.70
