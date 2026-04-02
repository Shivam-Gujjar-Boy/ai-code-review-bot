/**
 * AI Code Review Bot - Backend Server
 * Node.js + Express + WebSocket
 */
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import pino from 'pino';
import sessionsRouter from './routes/sessions';
import { WebSocketHandler } from './websocket/handler';

// Load environment variables
dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: [...DEV_ORIGINS, ...ALLOWED_ORIGINS],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' })); // Limit payload size for security

// Request logging
app.use((req, res, next) => {
  logger.info({ method: req.method, path: req.path }, 'HTTP request');
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'code-review-backend',
    pythonService: PYTHON_SERVICE_URL,
  });
});

// API routes
app.use('/api/sessions', sessionsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(server);

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  wsHandler.close();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, HOST, () => {
  logger.info(`🚀 Code Review Backend running on http://${HOST}:${PORT}`);
  logger.info(`   Health: http://${HOST}:${PORT}/health`);
  logger.info(`   WebSocket: ws://${HOST}:${PORT}/ws`);
  logger.info(`   Python Service: ${PYTHON_SERVICE_URL}`);
});

export { app, server };
