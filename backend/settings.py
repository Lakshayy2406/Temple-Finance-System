
from flask import Blueprint, jsonify
from google_sheet import get_sheet, ensure_settings_sheet

settings_bp = Blueprint("settings", __name__)


@settings_bp.get("/")
def get_settings():
    ensure_settings_sheet()
    rows = get_sheet("Settings").get_all_values()
    if len(rows) < 2:
        return jsonify({"temple_name": "Temple Finance System", "address": "", "contact": ""})
    headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]
    values = rows[1] + [""] * (len(headers) - len(rows[1]))
    return jsonify(dict(zip(headers, values)))
