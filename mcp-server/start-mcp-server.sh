#!/bin/bash

# Start MCP Server for Teams Extractor
# This script starts the MCP server that exposes Teams messages to Claude Desktop

set -e

# Change to script directory
cd "$(dirname "$0")"

# Check if database exists
if [ ! -f "../data/teams_messages.db" ]; then
    echo "Warning: Database not found at ../data/teams_messages.db"
    echo "Make sure the processor has created the database before using the MCP server"
fi

# Check if virtual environment exists
if [ ! -d "../venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv ../venv
fi

# Activate virtual environment
source ../venv/bin/activate

# Install dependencies
echo "Installing MCP server dependencies..."
pip install -q -r requirements.txt

# Run the MCP server
echo "Starting MCP server..."
python server.py
