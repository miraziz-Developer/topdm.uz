from __future__ import annotations

from app.schemas.orders import (
    ORDER_STATUS_LABELS_UZ,
    ORDER_TRACKER_PIPELINE,
    OrderStatus,
)


def normalize_tracker_status(status: str) -> str:
    if status == OrderStatus.pending.value:
        return OrderStatus.reserved.value
    return status


def build_tracker_payload(status: str) -> dict:
    normalized = normalize_tracker_status(status)
    steps = [
        {"status": step.value, "label": ORDER_STATUS_LABELS_UZ[step.value]}
        for step in ORDER_TRACKER_PIPELINE
    ]

    if normalized == OrderStatus.cancelled.value:
        return {
            "tracker_steps": steps,
            "tracker_active_index": -1,
            "tracker_progress_pct": 0,
            "status_label": ORDER_STATUS_LABELS_UZ[OrderStatus.cancelled.value],
        }

    pipeline_values = [s.value for s in ORDER_TRACKER_PIPELINE]
    try:
        active_index = pipeline_values.index(normalized)
    except ValueError:
        active_index = 0

    pct = round(((active_index + 1) / len(pipeline_values)) * 100)
    label = ORDER_STATUS_LABELS_UZ.get(status) or ORDER_STATUS_LABELS_UZ.get(normalized, status)

    return {
        "tracker_steps": steps,
        "tracker_active_index": active_index,
        "tracker_progress_pct": pct,
        "status_label": label,
    }


def enrich_order_for_live_tracker(order_dict: dict) -> dict:
    tracker = build_tracker_payload(str(order_dict.get("status") or OrderStatus.reserved.value))
    return {**order_dict, **tracker}
