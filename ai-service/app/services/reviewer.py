"""AI-powered code review service using Gemini."""
import json
import os
from typing import Any, AsyncGenerator, Dict, List, Optional

from httpx import AsyncClient

from app.schemas import ReviewResult, Issue


# Language detection mapping based on file extensions and common patterns
LANGUAGE_PATTERNS = {
    "python": ["def ", "class ", "import ", "from ", "print(", "async def"],
    "javascript": ["function ", "const ", "let ", "var ", "=>", "console.log"],
    "typescript": ["interface ", "type ", "<", "as ", "enum "],
    "go": ["func ", "package ", "import ", "var ", "type "],
    "java": ["public class ", "public static void", "import java.", "private ", "protected "],
    "rust": ["fn ", "let ", "mut ", "impl ", "pub "],
    "ruby": ["def ", "end", "require ", "puts ", "class "],
    "php": ["<?php", "function ", "$", "echo ", "namespace "],
    "swift": ["func ", "var ", "let ", "import ", "struct "],
    "kotlin": ["fun ", "val ", "var ", "class ", "package "],
}


def detect_language(code: str, hint: Optional[str] = None) -> str:
    """Detect programming language from code content."""
    if hint:
        hint = hint.lower()
        lang_map = {
            "js": "javascript", "javascript": "javascript",
            "ts": "typescript", "typescript": "typescript",
            "py": "python", "python": "python",
            "go": "go", "golang": "go",
            "java": "java",
            "rs": "rust", "rust": "rust",
            "rb": "ruby", "ruby": "ruby",
            "php": "php",
            "swift": "swift",
            "kt": "kotlin", "kotlin": "kotlin",
        }
        if hint in lang_map:
            return lang_map[hint]

    # Detect from shebang
    if code.startswith("#!"):
        first_line = code.split("\n")[0].lower()
        if "python" in first_line:
            return "python"
        if "node" in first_line:
            return "javascript"

    # Detect from patterns
    scores: Dict[str, int] = {}
    lines = code[:5000].lower()  # Check first 5KB

    for lang, patterns in LANGUAGE_PATTERNS.items():
        score = sum(1 for pattern in patterns if pattern.lower() in lines)
        if score > 0:
            scores[lang] = score

    if scores:
        return max(scores, key=lambda lang: scores[lang])

    # Fallback to extension-based detection
    return "unknown"


def build_review_prompt(code: str, language: str) -> str:
    """Build the prompt for the LLM to generate a structured review."""
    return f"""You are an expert code reviewer. Analyze the following {language} code and provide a structured review.

Your response MUST be a valid JSON object with this exact schema:
{{
  "bugs": [{{"line": number, "message": "string", "severity": "high"|"medium"|"low", "suggestion": "string"}}],
  "style": [{{"line": number, "message": "string", "suggestion": "string"}}],
  "security": [{{"line": number, "message": "string", "cwe": "string", "severity": "high"|"medium"|"low"}}],
  "summary": "string",
  "score": number (0-100),
  "language": "string"
}}

Guidelines:
- Be specific and actionable in your feedback
- Only report real issues, not nitpicks
- For security issues, include CWE reference when applicable
- Score should reflect: correctness (40%), security (30%), style (20%), maintainability (10%)
- If no issues in a category, return an empty array

Code to review:
```{language}
{code}
```

Respond ONLY with the JSON object, no other text."""


def _extract_json_text(raw_text: str) -> str:
    """Extract JSON text from a response that may include fences or extra prose."""
    text = raw_text.strip()

    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3:
            text = "\n".join(lines[1:-1]).strip()

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return text[first_brace:last_brace + 1]

    return text


def _issue_list(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [item for item in items if isinstance(item, dict)]


class CodeReviewService:
    """Service for AI-powered code review."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (api_key or os.getenv("GEMINI_API_KEY", "")).strip()
        self.model = os.getenv("GEMINI_MODEL", "gemini-flash-latest").strip() or "gemini-flash-latest"
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"
        # Create client that will be reused
        self.client = None

        # Log API key status
        import sys
        if self.api_key:
            key_preview = self.api_key[:8] + "..." + self.api_key[-4:] if len(self.api_key) > 12 else self.api_key
            print(f"[AI Service] ✅ Gemini API Key loaded: {key_preview} - PRODUCTION MODE", file=sys.stderr)
        else:
            print(f"[AI Service] ⚠️  No Gemini API key found - DEMO MODE", file=sys.stderr)

    async def stream_review(self, code: str, language: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Stream a code review as JSON chunks."""
        if not language or language == "unknown":
            language = detect_language(code)

        # Use demo mode if API key is not configured
        if not self.api_key:
            # Demo mode without valid API key - yield in SSE-compatible format
            demo_review = self._generate_demo_review(language)
            yield f"__COMPLETE__:{demo_review}"
            return

        # Create client for this request
        if self.client is None:
            self.client = AsyncClient(timeout=60.0)

        prompt = build_review_prompt(code, language)

        try:
            response = await self.client.post(
                f"{self.base_url}/models/{self.model}:generateContent",
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.api_key,
                },
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                {"text": prompt}
                            ],
                        }
                    ],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.2,
                        "maxOutputTokens": 2000,
                        "thinkingConfig": {
                            "thinkingBudget": 0,
                        },
                    },
                },
                timeout=60.0,
            )
            response.raise_for_status()

            payload = response.json()
            if payload.get("promptFeedback", {}).get("blockReason"):
                raise RuntimeError(
                    f"Gemini blocked the prompt: {payload['promptFeedback']['blockReason']}"
                )

            candidates = payload.get("candidates", [])
            if not candidates:
                raise RuntimeError("Gemini returned no candidates")

            parts = candidates[0].get("content", {}).get("parts", [])
            content = "".join(
                part.get("text", "")
                for part in parts
                if isinstance(part, dict)
            ).strip()

            if not content:
                raise RuntimeError("Gemini returned an empty response")

            # Forward one content chunk so the client still sees a streamed update.
            yield content

            # Validate the final content is valid JSON
            review_data = json.loads(_extract_json_text(content))
            review = ReviewResult(
                bugs=[Issue(**b) for b in _issue_list(review_data.get("bugs", []))],
                style=[Issue(**s) for s in _issue_list(review_data.get("style", []))],
                security=[Issue(**sec) for sec in _issue_list(review_data.get("security", []))],
                summary=review_data.get("summary", "Review complete"),
                score=review_data.get("score", 50),
                language=language
            )

            # Send final complete chunk with validated data
            yield f"__COMPLETE__:{json.dumps(review.model_dump())}"

        except Exception as e:
            import sys
            error_msg = str(e)
            print(f"[AI Service ERROR] {error_msg}", file=sys.stderr)
            yield f"__ERROR__:{error_msg}"

    def _generate_demo_review(self, language: str) -> str:
        """Generate a demo review when no API key is available."""
        demo_review = ReviewResult(
            bugs=[
                Issue(
                    line=1,
                    message="[DEMO MODE] This is a sample bug issue to demonstrate the system",
                    severity="medium",
                    suggestion="This is demo mode - set GEMINI_API_KEY to use real AI reviews"
                )
            ],
            style=[
                Issue(
                    line=2,
                    message="[DEMO MODE] Sample style suggestion",
                    suggestion="Running in demo mode - connect to Gemini API for real reviews"
                )
            ],
            security=[],
            summary=f"[DEMO MODE] This is a demonstration review. To get real AI-powered reviews, set the GEMINI_API_KEY environment variable. Detected language: {language}",
            score=72,
            language=language
        )
        return json.dumps(demo_review.model_dump())

    async def close(self):
        """Close the HTTP client."""
        if self.client:
            await self.client.aclose()


# Global service instance
_review_service: Optional[CodeReviewService] = None


def get_review_service() -> CodeReviewService:
    """Get or create the review service singleton."""
    global _review_service
    if _review_service is None:
        _review_service = CodeReviewService()
    return _review_service
