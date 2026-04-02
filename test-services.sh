#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  AI Code Review Bot - Service Diagnostics                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Check Backend
echo -e "${YELLOW}Checking Backend (http://localhost:8080)...${NC}"
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
    BACKEND_HEALTH=$(curl -s http://localhost:8080/health)
    echo "  Response: $BACKEND_HEALTH"
else
    echo -e "${RED}✗ Backend is NOT running${NC}"
    echo "  Start with: cd backend && npm run dev"
fi
echo ""

# Check AI Service
echo -e "${YELLOW}Checking AI Service (http://localhost:8000)...${NC}"
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ AI Service is running${NC}"
    AI_HEALTH=$(curl -s http://localhost:8000/health)
    echo "  Response: $AI_HEALTH"
else
    echo -e "${RED}✗ AI Service is NOT running${NC}"
    echo "  Start with: cd ai-service && python main.py"
fi
echo ""

# Test AI Service Review Endpoint
echo -e "${YELLOW}Testing AI Service /review endpoint...${NC}"
AI_RESPONSE=$(curl -s -X POST http://localhost:8000/review \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(1);","language":"javascript"}' \
  -m 5 2>&1 | head -c 300)

if [[ "$AI_RESPONSE" == *"data:"* ]] || [[ "$AI_RESPONSE" == *"complete"* ]]; then
    echo -e "${GREEN}✓ AI Service /review endpoint responding${NC}"
    echo "  Sample response (first 300 chars):"
    echo "  $AI_RESPONSE" | head -c 300
    echo ""
else
    echo -e "${RED}✗ AI Service /review not responding correctly${NC}"
    echo "  Response: $AI_RESPONSE"
    echo ""
    echo "  Debugging steps:"
    echo "  1. Check AI Service logs for errors"
    echo "  2. Verify GEMINI_API_KEY is set in .env"
    echo "  3. Try test command manually:"
    echo "     curl -X POST http://localhost:8000/review -H 'Content-Type: application/json' -d '{\"code\":\"test\",\"language\":\"python\"}'"
fi

# Check Database
echo -e "${YELLOW}Checking Database...${NC}"
if [ -f "backend/data/reviews.db" ]; then
    echo -e "${GREEN}✓ Database file exists${NC}"
    DB_SIZE=$(du -h backend/data/reviews.db 2>/dev/null | cut -f1)
    echo "  Size: $DB_SIZE"
else
    echo -e "${YELLOW}⚠ Database not yet created (will be created on first review)${NC}"
fi
echo ""

# Check Frontend
echo -e "${YELLOW}Checking Frontend (http://localhost:5173)...${NC}"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend dev server is running${NC}"
else
    echo -e "${YELLOW}⚠ Frontend dev server not accessible${NC}"
    echo "  Start with: cd frontend && npm run dev"
    echo "  (Usually takes 1-2 seconds to start)"
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Diagnostic Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

BACKEND_UP=$(curl -s http://localhost:8080/health > /dev/null 2>&1 && echo "1" || echo "0")
AI_UP=$(curl -s http://localhost:8000/health > /dev/null 2>&1 && echo "1" || echo "0")

if [ "$BACKEND_UP" == "1" ] && [ "$AI_UP" == "1" ]; then
    echo -e "${GREEN}✓ All core services are running!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open http://localhost:5173 in your browser"
    echo "2. Paste code or upload a file"
    echo "3. Click 'Review Code'"
    echo "4. Review should appear in 2-3 seconds"
    echo ""
    echo -e "${YELLOW}Debugging tips:${NC}"
    echo "- Check browser console for WebSocket errors"
    echo "- Check backend logs for 'Review' messages"
    echo "- Check if AI service is in demo mode (no GEMINI_API_KEY set)"
else
    echo -e "${RED}✗ Some services are not running${NC}"
    echo ""
    echo "Please start all three services:"
    echo ""
    echo "Terminal 1 (Backend):"
    echo "  cd backend && npm run dev"
    echo ""
    echo "Terminal 2 (AI Service):"
    echo "  cd ai-service && python main.py"
    echo ""
    echo "Terminal 3 (Frontend):"
    echo "  cd frontend && npm run dev"
fi
echo ""
