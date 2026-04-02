/**
 * WebSocket Handler for Code Review Sessions
 */
import { WebSocket } from 'ws';
import http from 'http';
import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket as WS } from 'ws';
import pino from 'pino';
import { ClientMessage, ServerMessage, WebSocketClient, ReviewResult } from '../types';
import * as db from '../db';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

export class WebSocketHandler {
  private wss: WebSocketServer;
  private clients: Map<string, { ws: WebSocket; isReviewing: boolean }> = new Map();

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info(`WebSocket server initialized at ws://localhost:${server.address()?.toString().split(':').pop()}/ws`);
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const sessionId = crypto.randomUUID();
    logger.info({ sessionId }, 'New WebSocket connection');

    // Store client with session
    this.clients.set(sessionId, { ws, isReviewing: false });

    // Send session created message
    this.send(ws, { type: 'session_created', sessionId });

    ws.on('message', (data) => {
      this.handleMessage(sessionId, data.toString());
    });

    ws.on('close', () => {
      logger.info({ sessionId }, 'WebSocket connection closed');
      this.clients.delete(sessionId);
    });

    ws.on('error', (error) => {
      logger.error({ sessionId, error }, 'WebSocket error');
    });

    // Send initial session list
    this.sendSessionList(ws);
  }

  private handleMessage(sessionId: string, rawMessage: string): void {
    const client = this.clients.get(sessionId);
    if (!client) {
      logger.warn({ sessionId }, 'Message from unknown session');
      return;
    }

    let message: ClientMessage;
    try {
      message = JSON.parse(rawMessage);
    } catch (error) {
      logger.error({ sessionId, error }, 'Invalid JSON message');
      this.send(client.ws, { type: 'error', message: 'Invalid JSON format' });
      return;
    }

    logger.debug({ sessionId, type: message.type }, 'Received message');

    switch (message.type) {
      case 'review_request':
        this.handleReviewRequest(sessionId, message);
        break;
      case 'load_session':
        this.handleLoadSession(sessionId, message);
        break;
      case 'delete_session':
        this.handleDeleteSession(sessionId, message);
        break;
      case 'list_sessions':
        this.sendSessionList(client.ws);
        break;
      default:
        this.send(client.ws, { type: 'error', message: `Unknown message type: ${(message as any).type}` });
    }
  }

  private async handleReviewRequest(
    sessionId: string,
    message: Extract<ClientMessage, { type: 'review_request' }>
  ): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client) return;

    // Prevent concurrent reviews
    if (client.isReviewing) {
      this.send(client.ws, { type: 'error', message: 'Review already in progress' });
      return;
    }

    client.isReviewing = true;

    try {
      // Create session in database
      const session = db.createSession(message.code, message.language);
      logger.info({ sessionId, language: message.language }, 'Review started');

      // Stream review from Python service
      const reviewResult = await this.streamReviewFromPythonService(
        client.ws,
        message.code,
        message.language
      );

      if (!reviewResult) {
        throw new Error('AI service returned no completed review');
      }

      // Save review to database
      db.updateSessionReview(
        session.id,
        JSON.stringify(reviewResult),
        reviewResult.score
      );

      // Send complete review
      this.send(client.ws, { type: 'review_complete', review: reviewResult });

      // Refresh session list
      this.broadcastSessionList();

      logger.info({ sessionId, score: reviewResult.score }, 'Review completed');
    } catch (error) {
      logger.error({ sessionId, error }, 'Review failed');
      this.send(client.ws, {
        type: 'review_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      client.isReviewing = false;
    }
  }

  private async streamReviewFromPythonService(
    ws: WebSocket,
    code: string,
    language?: string
  ): Promise<ReviewResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(`${PYTHON_SERVICE_URL}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body from Python service');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completeReview: ReviewResult | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.type === 'chunk' && data.content) {
                  // Forward chunk to client
                  this.send(ws, { type: 'review_chunk', content: data.content });
                } else if (data.type === 'complete' && data.data) {
                  completeReview = data.data as ReviewResult;
                  logger.debug('Received complete review from Python service');
                } else if (data.type === 'error') {
                  logger.error({ error: data.error }, 'Error from Python service');
                  throw new Error(data.error);
                }
              } catch (error) {
                if (error instanceof Error && error.name === 'SyntaxError') {
                  logger.warn({ error: error.message, line }, 'Failed to parse SSE data');
                } else if (error instanceof Error) {
                  throw error;
                }
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.trim().startsWith('data: ')) {
          try {
            const jsonStr = buffer.slice(6).trim();
            const data = JSON.parse(jsonStr);
            if (data.type === 'complete' && data.data) {
              completeReview = data.data as ReviewResult;
            }
          } catch (error) {
            logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to parse final buffer data');
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!completeReview) {
        throw new Error('Python service completed without a final review payload');
      }

      return completeReview;
    } finally {
      clearTimeout(timeout);
    }
  }

  private handleLoadSession(
    sessionId: string,
    message: Extract<ClientMessage, { type: 'load_session' }>
  ): void {
    const client = this.clients.get(sessionId);
    if (!client) return;

    const record = db.getSessionById(message.sessionId);
    if (!record) {
      this.send(client.ws, { type: 'error', message: 'Session not found' });
      return;
    }

    const session = db.recordToSession(record);
    this.send(client.ws, { type: 'session_loaded', session });
    logger.info({ sessionId, loadedSessionId: message.sessionId }, 'Session loaded');
  }

  private handleDeleteSession(
    sessionId: string,
    message: Extract<ClientMessage, { type: 'delete_session' }>
  ): void {
    const client = this.clients.get(sessionId);
    if (!client) return;

    const deleted = db.deleteSession(message.sessionId);
    if (deleted) {
      this.send(client.ws, { type: 'session_deleted', sessionId: message.sessionId });
      this.broadcastSessionList();
      logger.info({ sessionId, deletedSessionId: message.sessionId }, 'Session deleted');
    } else {
      this.send(client.ws, { type: 'error', message: 'Session not found' });
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendSessionList(ws: WebSocket): void {
    const records = db.getAllSessions(50);
    const sessions = records.map(db.recordToSummary);
    this.send(ws, { type: 'session_list', sessions });
  }

  private broadcastSessionList(): void {
    const records = db.getAllSessions(50);
    const sessions = records.map(db.recordToSummary);
    const message: ServerMessage = { type: 'session_list', sessions };

    this.clients.forEach(({ ws }) => {
      this.send(ws, message);
    });
  }

  public close(): void {
    this.wss.clients.forEach((client) => {
      client.close(1000, 'Server shutting down');
    });
    this.wss.close();
  }
}
