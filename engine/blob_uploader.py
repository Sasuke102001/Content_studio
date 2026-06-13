"""
Upload training artifacts to Azure Blob Storage after a successful generation.
Fire-and-forget — never raises, never blocks the main generation flow.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def _get_client(connection_string: str, container_name: str = "training-artifacts"):
    """Return a ContainerClient, or None if azure-storage-blob isn't installed."""
    try:
        from azure.storage.blob import ContainerClient
    except ImportError:
        return None
    client = ContainerClient.from_connection_string(connection_string, container_name)
    # Auto-create the container if it doesn't exist yet
    try:
        client.create_container()
    except Exception:
        pass  # Already exists
    return client


def upload_training_artifact(
    project_dir: str,
    revision_id: str,
    mode: str,
    params: dict,
    connection_string: str | None = None,
) -> None:
    """
    Package (input, plan, carousel.html) as JSONL and upload to
    training-artifacts/{YYYY-MM}/{revision_id}/training.jsonl
    Also uploads carousel.html raw if present.

    Silently no-ops when connection_string is empty or azure sdk is missing.
    """
    if not connection_string:
        connection_string = os.environ.get("AZURE_BLOB_CONNECTION_STRING", "")
    if not connection_string:
        return

    try:
        _do_upload(project_dir, revision_id, mode, params, connection_string)
    except Exception as exc:
        # Never let upload failures surface to the caller
        print(f"[BlobUploader] Upload failed (non-fatal): {exc}", file=sys.stderr)


def _do_upload(
    project_dir: str,
    revision_id: str,
    mode: str,
    params: dict,
    connection_string: str,
) -> None:
    project_path = Path(project_dir)
    plan_path = project_path / "plan.md"
    html_path = project_path / "carousel.html"

    plan_text = plan_path.read_text(encoding="utf-8") if plan_path.exists() else ""
    html_text = html_path.read_text(encoding="utf-8") if html_path.exists() else ""

    # Build the training record
    record = {
        "revision_id": revision_id,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "input_direction": params.get("input_direction", ""),
        "input_context": params.get("input_context", ""),
        "language_overrides": params.get("language_overrides", {}),
        "style_overrides": params.get("style_overrides", {}),
        "plan": plan_text,
        "carousel_html": html_text,
    }

    jsonl_bytes = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")

    month_prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    base_path = f"{month_prefix}/{revision_id}"

    client = _get_client(connection_string)
    if client is None:
        print("[BlobUploader] azure-storage-blob not installed — skipping upload.", file=sys.stderr)
        return

    # Upload JSONL training record
    client.upload_blob(
        name=f"{base_path}/training.jsonl",
        data=jsonl_bytes,
        overwrite=True,
    )

    # Upload raw carousel HTML for reference
    if html_text:
        client.upload_blob(
            name=f"{base_path}/carousel.html",
            data=html_text.encode("utf-8"),
            overwrite=True,
        )

    print(f"[BlobUploader] Uploaded training artifacts to {base_path}/", file=sys.stderr)
