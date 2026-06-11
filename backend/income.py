
from flask import Blueprint, request, jsonify
from google_sheet import get_sheet, ensure_income_time_column, ensure_upi_sheets
from datetime import datetime
from upi import make_upi_tx_id

income_bp = Blueprint("income", __name__)


@income_bp.post("/add")
def add():
    d = request.json
    now = datetime.now()
    date_str = d.get("date") or now.strftime("%d-%m-%Y")
    time_str = d.get("time") or now.strftime("%H:%M")
    mode = d.get("mode", "Cash").strip()

    ensure_income_time_column()
    income_sheet = get_sheet("Income")
    income_sheet.append_row(
        [date_str, time_str, d["name"], "", d["amount"], mode, ""]
    )

    if mode.lower() == "upi":
        ensure_upi_sheets()
        income_row_idx = len(income_sheet.get_all_values())
        tx_id = make_upi_tx_id(d["name"], now)
        get_sheet("UPI_Inbox").append_row(
            [
                tx_id,
                date_str,
                time_str,
                d["amount"],
                d["name"],
                f"INCOME-{income_row_idx}",
                "Pending",
            ]
        )
        return {"success": True, "queued_upi": True, "transaction_id": tx_id}

    return {"success": True}


@income_bp.get("/all")
def all():
    ensure_income_time_column()
    return jsonify(get_sheet("Income").get_all_records())
