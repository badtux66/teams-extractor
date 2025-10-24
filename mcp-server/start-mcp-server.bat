@echo off
REM Start MCP Server for Teams Extractor (Windows)
REM This script starts the MCP server that exposes Teams messages to Claude Desktop

cd /d %~dp0

REM Check if database exists
if not exist "..\data\teams_messages.db" (
    echo Warning: Database not found at ..\data\teams_messages.db
    echo Make sure the processor has created the database before using the MCP server
)

REM Check if virtual environment exists
if not exist "..\venv" (
    echo Creating virtual environment...
    python -m venv ..\venv
)

REM Activate virtual environment
call ..\venv\Scripts\activate.bat

REM Install dependencies
echo Installing MCP server dependencies...
pip install -q -r requirements.txt

REM Run the MCP server
echo Starting MCP server...
python server.py
