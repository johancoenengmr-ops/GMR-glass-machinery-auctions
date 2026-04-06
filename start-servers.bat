@echo off
REM Get the directory where this batch file is located
cd /d "%~dp0"

REM Navigate to backend and start Python server
start cmd /k "cd backend && python app.py"

REM Wait 3 seconds for backend to start, then start frontend
timeout /t 3 /nobreak
start cmd /k "cd frontend && npm start"

REM Keep this window open
pause
