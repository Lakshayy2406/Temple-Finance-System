
from flask import Blueprint
from google_sheet import get_sheet

dashboard_bp = Blueprint("dashboard", __name__)


def _income_total():
    return sum(
        float(x.get("Amount", 0))
        for x in get_sheet("Income").get_all_records()
        if str(x.get("Mode", "")).strip().lower() != "converted"
    )


@dashboard_bp.get("/")
def dash():
    i = _income_total()
    e = sum(float(x.get("Amount", 0)) for x in get_sheet("Expense").get_all_records())
    return {"income": i, "expense": e, "balance": i - e}
