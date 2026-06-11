
from flask import Flask 
from flask_cors import CORS
import traceback
from income import income_bp
from expense import expense_bp
from dashboard import dashboard_bp
from settings import settings_bp
from upi import upi_bp
app=Flask(__name__)
CORS(app)

@app.errorhandler(Exception)
def show_error(e):
    print("SERVER ERROR:")
    print(traceback.format_exc())
    return {"error": str(e)}, 500
    
app.register_blueprint(income_bp,url_prefix="/income")
app.register_blueprint(expense_bp,url_prefix="/expense")
app.register_blueprint(dashboard_bp,url_prefix="/dashboard")
app.register_blueprint(settings_bp,url_prefix="/settings")
app.register_blueprint(upi_bp,url_prefix="/upi")
@app.route("/")
def home(): return {"message":"Temple Finance Running"}
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port
    )
