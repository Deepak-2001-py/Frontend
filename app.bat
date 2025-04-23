@echo off

:: Start the frontend using a local http server
start cmd /k python -m http.server 5500

:: Wait a little for frontend to start
timeout /t 2 /nobreak >nul

:: Open the browser to the frontend
start "" "http://localhost:5500"