import sys
import json

def emit_progress(status: str, percentage: int, message: str, delta: str = None):
    payload = {
        "status": status,
        "percentage": percentage,
        "message": message
    }
    if delta is not None:
        payload["delta"] = delta
    print(json.dumps(payload), flush=True)

def log_info(msg: str):
    emit_progress("running", 0, msg)

def log_error(msg: str):
    # Emit structured fail to stdout for the app UI
    emit_progress("failed", 0, msg)
