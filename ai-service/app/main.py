"""FastAPI application for AI Code Review Service."""
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
import asyncio

from app.schemas import ReviewRequest, ReviewResult
from app.services.reviewer import get_review_service

app = FastAPI(
    title="AI Code Review Service",
    description="Microservice for AI-powered code review with streaming support",
    version="1.0.0",
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    service = get_review_service()
    await service.close()


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ai-code-review"}


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "service": "AI Code Review Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "review_stream": "/review (POST, streaming)",
            "review": "/review (POST, non-streaming)",
        }
    }


@app.post("/review")
async def stream_review(request: ReviewRequest):
    """
    Stream a code review in real-time.

    Returns Server-Sent Events (SSE) stream with chunks of the review.
    """
    try:
        # Validate request
        ReviewRequest.model_validate(request)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    service = get_review_service()

    async def generate_stream():
        """Generate SSE-formatted stream."""
        try:
            async for chunk in service.stream_review(request.code, request.language):
                normalized_chunk = chunk.lstrip()
                # Handle special markers
                if normalized_chunk.startswith("__COMPLETE__:"):
                    data = normalized_chunk[len("__COMPLETE__:"):]
                    yield f"data: {json.dumps({'type': 'complete', 'data': json.loads(data)})}\n\n"
                elif normalized_chunk.startswith("__ERROR__:"):
                    error_msg = normalized_chunk[len("__ERROR__:"):]
                    yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
                else:
                    # Regular content chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                await asyncio.sleep(0)  # Yield control to event loop
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@app.post("/review/json")
async def review_json(request: ReviewRequest):
    """
    Get a complete code review as a single JSON response.

    Use this endpoint if you don't need streaming.
    """
    try:
        ReviewRequest.model_validate(request)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    service = get_review_service()

    # Collect all chunks and return complete review
    full_content = ""
    async for chunk in service.stream_review(request.code, request.language):
        if chunk.startswith("__COMPLETE__:"):
            data = chunk[len("__COMPLETE__:"):]
            return json.loads(data)
        elif chunk.startswith("__ERROR__:"):
            error_msg = chunk[len("__ERROR__:"):]
            raise HTTPException(status_code=500, detail=error_msg)
        else:
            full_content += chunk

    # Fallback: parse accumulated content
    try:
        return json.loads(full_content.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse review response")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
