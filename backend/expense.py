
from flask import Blueprint,request,jsonify
from google_sheet import get_sheet
from datetime import datetime
expense_bp=Blueprint("expense",__name__)
@expense_bp.post("/add")
def add():
 d=request.json
 get_sheet("Expense").append_row([datetime.now().strftime("%d-%m-%Y"),d["title"],d["amount"],d["mode"]])
 return {"success":True}
@expense_bp.get("/all")
def all(): return jsonify(get_sheet("Expense").get_all_records())
