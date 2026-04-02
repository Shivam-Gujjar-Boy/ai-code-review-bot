# AI Code Review Bot

AI Code Review Bot is a real-time code review application that lets users paste or upload source code and receive structured AI feedback.

The project has three parts:
- frontend: React + TypeScript interface with a code editor, review panel, and session history
- backend: Node.js + TypeScript service for WebSocket communication, session management, and SQLite storage
- ai-service: Python + FastAPI service that calls Gemini to generate review results

Reviews are categorized into bugs, style, and security findings, with an overall summary and score.