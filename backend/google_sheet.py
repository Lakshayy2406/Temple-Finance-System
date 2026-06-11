
import os
import gspread
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials

load_dotenv()
scope = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_file("credentials.json", scopes=scope)
client = gspread.authorize(creds)
db = client.open(os.getenv("SHEET_NAME"))


def get_sheet(name):
    return db.worksheet(name)


def ensure_income_time_column():
    sheet = get_sheet("Income")
    headers = sheet.row_values(1)
    if headers and headers[0] == "Date" and (len(headers) < 2 or headers[1] != "Time"):
        sheet.insert_cols([["Time"]], col=2)


def ensure_settings_sheet():
    titles = [ws.title for ws in db.worksheets()]
    if "Settings" not in titles:
        ws = db.add_worksheet("Settings", rows=10, cols=3)
        ws.append_row(["Temple Name", "Address", "Contact"])
        ws.append_row(["Temple Finance System", "Finance System", ""])


def ensure_upi_sheets():
    titles = [ws.title for ws in db.worksheets()]
    if "UPI_Inbox" not in titles:
        ws = db.add_worksheet("UPI_Inbox", rows=200, cols=7)
        ws.append_row(
            ["Transaction ID", "Date", "Time", "Amount", "Sender", "Reference", "Status"]
        )
    if "UPI_Conversions" not in titles:
        ws = db.add_worksheet("UPI_Conversions", rows=200, cols=6)
        ws.append_row(
            ["Conversion ID", "Transaction ID", "Date", "Time", "Amount", "Cash Income Ref"]
        )
