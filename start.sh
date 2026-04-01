#!/bin/bash

# RUD Demo Launcher Script
# Quick start for the High-Value User Recovery Engine demo

set -e

DEMO_DIR="/home/cis/Documents/Lucifer/RUD/demo"
BACKEND_DIR="$DEMO_DIR/backend"

echo "🚀 RUD Demo Launcher"
echo "=================="
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Backend directory not found: $BACKEND_DIR"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed"
    echo "   Install: apt-get install python3"
    exit 1
fi

echo "✓ Python3 found: $(python3 --version)"
echo ""

# Check/create virtual environment
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "📦 Creating virtual environment..."
    cd "$BACKEND_DIR"
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip setuptools wheel
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment found"
    source "$BACKEND_DIR/venv/bin/activate"
fi

echo ""

# Check/install requirements
if [ ! -f "$BACKEND_DIR/main.py" ]; then
    echo "❌ Backend files not found"
    exit 1
fi

echo "📥 Checking dependencies..."
pip install -q -r "$BACKEND_DIR/requirements.txt" 2>/dev/null || {
    echo "Installing FastAPI and dependencies..."
    pip install fastapi uvicorn pydantic python-dateutil
}

echo "✓ Dependencies installed"
echo ""

# Check if port 8000 is available
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8000 is already in use"
    echo "   Kill with: pkill -f 'python3 main.py'"
    echo ""
    read -p "   Try port 8001 instead? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PORT=8001
    else
        exit 1
    fi
else
    PORT=8000
fi

echo "🚀 Starting RUD Demo Backend..."
echo "   API: http://localhost:$PORT"
echo "   Dashboard: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
cd "$BACKEND_DIR"
python3 main.py --port $PORT

