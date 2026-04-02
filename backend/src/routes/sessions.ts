/**
 * REST API Routes for Session Management
 */
import { Router, Request, Response } from 'express';
import * as db from '../db';

// Type helper for query params - safely extract string value
const parseParam = (param: unknown, fallback: string): string => {
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && typeof param[0] === 'string') return param[0];
  return fallback;
};

const router = Router();

/**
 * GET /sessions
 * List all review sessions
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(parseParam(req.query.limit, '50'), 10) || 50;
    const records = db.getAllSessions(Math.min(limit, 100));
    const sessions = records.map(db.recordToSummary);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /sessions/:id
 * Get a specific review session
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseParam(req.params.id, '');
    const record = db.getSessionById(id);
    if (!record) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(db.recordToSession(record));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * DELETE /sessions/:id
 * Delete a review session
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseParam(req.params.id, '');
    const deleted = db.deleteSession(id);
    if (deleted) {
      res.status(204).send();
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
