"""Entry point for AI Code Review Service."""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
env_file_path = os.path.join(os.path.dirname(__file__), '.env')
loaded = load_dotenv(env_file_path)

print(f"[Startup] .env file path: {env_file_path}")
print(f"[Startup] .env file exists: {os.path.exists(env_file_path)}")
print(f"[Startup] .env file loaded: {loaded}")

from app.main import app

if __name__ == "__main__":
    import uvicorn
    import sys

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    api_key = os.getenv("GEMINI_API_KEY", "").strip()

    print(f"\n🚀 Starting AI Code Review Service on {host}:{port}")
    print(f"   Health check: http://{host}:{port}/health")
    print(f"   Review endpoint: POST http://{host}:{port}/review")
    print()

    # Show API key status
    if api_key:
        key_preview = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else api_key
        print(f"   Gemini API Key: ✅ Loaded ({key_preview})")
        print(f"   Mode: PRODUCTION (using real AI)")
    else:
        print(f"   Gemini API Key: ❌ Not set")
        print(f"   Mode: DEMO (showing sample reviews)")
        print(f"   How to enable real AI:")
        print(f"     1. Get key from https://aistudio.google.com/apikey")
        print(f"     2. Set in .env: GEMINI_API_KEY=your-key")
        print(f"     3. Restart this service")

    print()

    uvicorn.run(app, host=host, port=port)


