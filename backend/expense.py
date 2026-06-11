
from flask import Blueprint,request,jsonify
from google_sheet import get_sheet
from datetime import datetime
from zoneinfo import ZoneInfo

expense_bp=Blueprint("expense",__name__)

@expense_bp.post("/add")
def add():
    d = request.json

    now = datetime.now(ZoneInfo("Asia/Kolkata"))

    date_str = now.strftime("%d-%m-%Y")
    time_str = now.strftime("%I:%M %p")

    get_sheet("Expense").append_row(
        [
            date_str,
            time_str,
            d["title"],
            d["amount"],
            d["mode"]
        ]
    )

    return {"success": True}


@expense_bp.get("/all")
def all():
    return jsonify(get_sheet("Expense").get_all_records())
