@echo off
cd /d "%~dp0"
start "Temple Finance Backend" cmd /k "cd backend && python app.py"
start "Temple Finance Frontend" cmd /k "cd frontend && npm run dev"
echo Started backend (http://127.0.0.1:5000) and frontend (http://localhost:5173).
