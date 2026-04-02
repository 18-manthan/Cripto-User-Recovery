#!/bin/bash
# RUD Deployment Quick Setup Script
# This script prepares your project for free deployment on Render + Vercel

echo "🚀 RUD Deployment Setup Script"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the project root
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Project structure verified${NC}"
echo ""

# Step 1: Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
    echo "Creating .gitignore..."
    touch .gitignore
    echo "✓ .gitignore created"
else
    echo "✓ .gitignore already exists"
fi

# Step 2: Create backend .env.example
if [ ! -f "backend/.env.example" ]; then
    echo "Creating backend/.env.example..."
    touch backend/.env.example
else
    echo "✓ backend/.env.example already exists"
fi

# Step 3: Create Procfile for Render
if [ ! -f "backend/Procfile" ]; then
    echo "Creating backend/Procfile for Render..."
    touch backend/Procfile
else
    echo "✓ backend/Procfile already exists"
fi

echo ""
echo -e "${YELLOW}📋 Deployment Steps:${NC}"
echo ""
echo "1️⃣  Create GitHub Repository:"
echo "   - Go to github.com"
echo "   - Create new repo 'rud-demo'"
echo "   - Push your code: git push origin main"
echo ""

echo "2️⃣  Groq API Setup:"
echo "   - Visit: https://console.groq.com/keys"
echo "   - Create free account"
echo "   - Copy your API key"
echo ""

echo "3️⃣  Deploy Backend (Render.com):"
echo "   - Go to https://render.com"
echo "   - Sign up with GitHub"
echo "   - Create Web Service from rud-demo repo"
echo "   - Build: pip install -r backend/requirements.txt"
echo "   - Start: cd backend && uvicorn main:app --host 0.0.0.0 --port 8000"
echo "   - Add GROQ_API_KEY to environment variables"
echo ""

echo "4️⃣  Deploy Frontend (Vercel.com):"
echo "   - Go to https://vercel.com"
echo "   - Sign up with GitHub"
echo "   - Import rud-demo repo"
echo "   - Set root directory: frontend"
echo "   - Add env var: VITE_API_URL=https://rud-backend.onrender.com"
echo ""

echo "5️⃣  Update CORS in backend/main.py:"
echo "   - Add your Vercel URL to allowed origins"
echo ""

echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next: Update your paths and deploy! 🚀"
