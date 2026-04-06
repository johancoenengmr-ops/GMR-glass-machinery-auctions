@echo off
start powershell -NoExit -Command "cd backend_directory && python app.py"
start powershell -NoExit -Command "cd frontend_directory && npm start"