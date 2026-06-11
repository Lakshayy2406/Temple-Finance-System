
import re
import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request
from google_sheet import get_sheet, ensure_upi_sheets, ensure_income_time_column

upi_bp = Blueprint("upi", __name__)


def _donor_slug(name):
    slug = re.sub(r"[^A-Za-z0-9]+", "-", (name or "").strip())
    slug = slug.strip("-").upper()
    return slug[:24] or "DONOR"


def make_upi_tx_id(donor_name, now=None):
    now = now or datetime.now()
    donor = _donor_slug(donor_name)
    return f"UPI-{donor}-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

INBOX_HEADERS = [
    "Transaction ID",
    "Date",
    "Time",
    "Amount",
    "Sender",
    "Reference",
    "Status",
]


def _inbox_rows():
    ensure_upi_sheets()
    sheet = get_sheet("UPI_Inbox")
    values = sheet.get_all_values()
    if not values:
        return sheet, []
    return sheet, values


def _find_inbox_row(values, tx_id):
    for idx, row in enumerate(values[1:], start=2):
        if row and row[0] == tx_id:
            return idx, row
    return None, None


@upi_bp.get("/pending")
def pending():
    _, values = _inbox_rows()
    if len(values) <= 1:
        return jsonify([])
    records = []
    for row in values[1:]:
        if len(row) < 7:
            row = row + [""] * (7 - len(row))
        if row[6].strip().lower() == "pending":
            records.append(dict(zip(INBOX_HEADERS, row)))
    return jsonify(records)


@upi_bp.get("/converted")
def converted():
    ensure_upi_sheets()
    records = get_sheet("UPI_Conversions").get_all_records()
    return jsonify(records)


@upi_bp.post("/incoming")
def incoming():
    """Register a new UPI payment into the inbox (for auto-fetch integrations)."""
    ensure_upi_sheets()
    d = request.json
    amount = str(d.get("amount", "")).strip()
    if not amount or float(amount) <= 0:
        return jsonify({"error": "Invalid amount"}), 400

    reference = d.get("reference", "").strip()
    _, values = _inbox_rows()
    for row in values[1:]:
        if len(row) >= 7 and row[6].strip().lower() == "pending":
            if row[4] == str(amount) and row[5] == reference and reference:
                return jsonify({"error": "Duplicate UPI transaction"}), 409

    now = datetime.now()
    sender = d.get("sender", "UPI Payment")
    tx_id = d.get("transaction_id") or make_upi_tx_id(sender, now)
    sheet = get_sheet("UPI_Inbox")

    for row in values[1:]:
        if row and row[0] == tx_id:
            return jsonify({"error": "Transaction ID already exists"}), 409

    sheet.append_row(
        [
            tx_id,
            d.get("date") or now.strftime("%d-%m-%Y"),
            d.get("time") or now.strftime("%H:%M"),
            amount,
            sender,
            reference,
            "Pending",
        ]
    )
    return jsonify({"success": True, "transaction_id": tx_id})


@upi_bp.post("/convert/<tx_id>")
def convert(tx_id):
    ensure_upi_sheets()
    ensure_income_time_column()
    sheet, values = _inbox_rows()
    row_idx, row = _find_inbox_row(values, tx_id)

    if not row:
        return jsonify({"error": "Transaction not found"}), 404
    if len(row) < 7:
        row = row + [""] * (7 - len(row))
    if row[6].strip().lower() != "pending":
        return jsonify({"error": "Transaction already converted"}), 409

    conversions = get_sheet("UPI_Conversions").get_all_values()
    for conv in conversions[1:]:
        if conv and conv[1] == tx_id:
            return jsonify({"error": "Transaction already converted"}), 409

    now = datetime.now()
    date_str = now.strftime("%d-%m-%Y")
    time_str = now.strftime("%H:%M")
    amount = row[3]
    sender = row[4] or "UPI Payment"

    income_sheet = get_sheet("Income")
    reference = row[5] or ""
    cash_ref = ""
    if reference.startswith("INCOME-"):
        try:
            income_row_idx = int(reference.split("-")[1])
            income_sheet.update_cell(income_row_idx, 6, "Cash")
            cash_ref = reference
        except (ValueError, IndexError):
            pass

    if not cash_ref:
        income_sheet.append_row(
            [date_str, time_str, sender, "", amount, "Cash", ""]
        )
        cash_ref = f"INCOME-{len(income_sheet.get_all_values())}"

    sheet.update_cell(row_idx, 7, "Converted")

    conv_id = f"CONV-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    get_sheet("UPI_Conversions").append_row(
        [conv_id, tx_id, date_str, time_str, amount, cash_ref]
    )

    return jsonify(
        {
            "success": True,
            "conversion_id": conv_id,
            "amount": amount,
            "cash_income_ref": cash_ref,
        }
    )


@upi_bp.post("/sync-from-income")
def sync_from_income():
    """Import unconverted UPI income rows into the inbox (one-time migration helper)."""
    ensure_upi_sheets()
    ensure_income_time_column()
    income_rows = get_sheet("Income").get_all_records()
    _, inbox_values = _inbox_rows()
    converted_refs = {r[5] for r in inbox_values[1:] if len(r) > 5}
    pending_amounts = {
        (r[3], r[5])
        for r in inbox_values[1:]
        if len(r) > 6 and r[6].strip().lower() == "pending"
    }

    inbox_sheet = get_sheet("UPI_Inbox")
    added = 0
    for idx, row in enumerate(income_rows, start=2):
        if str(row.get("Mode", "")).strip().lower() != "upi":
            continue
        ref = f"INCOME-{idx}"
        if ref in converted_refs:
            continue
        key = (str(row.get("Amount", "")), ref)
        if key in pending_amounts:
            continue
        donor_name = row.get("Name", "UPI Donation")
        tx_id = make_upi_tx_id(donor_name)
        inbox_sheet.append_row(
            [
                tx_id,
                row.get("Date", ""),
                row.get("Time", ""),
                row.get("Amount", ""),
                row.get("Name", "UPI Donation"),
                ref,
                "Pending",
            ]
        )
        added += 1

    return jsonify({"success": True, "imported": added})
