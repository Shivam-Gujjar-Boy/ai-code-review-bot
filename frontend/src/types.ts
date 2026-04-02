/**
 * WebSocket Message Types
 * These types define the contract between frontend and backend
 */

// ============================================================================
// Client -> Server Messages
// ============================================================================

export type ClientMessage =
  | ReviewRequestMessage
  | LoadSessionMessage
  | DeleteSessionMessage
  | ListSessionsMessage;

export interface ReviewRequestMessage {
  type: 'review_request';
  code: string;
  language?: string;
}

export interface LoadSessionMessage {
  type: 'load_session';
  sessionId: string;
}

export interface DeleteSessionMessage {
  type: 'delete_session';
  sessionId: string;
}

export interface ListSessionsMessage {
  type: 'list_sessions';
}

// ============================================================================
// Server -> Client Messages
// ============================================================================

export type ServerMessage =
  | SessionCreatedMessage
  | ReviewChunkMessage
  | ReviewCompleteMessage
  | ReviewErrorMessage
  | SessionLoadedMessage
  | SessionDeletedMessage
  | SessionListMessage
  | ErrorMessage;

export interface SessionCreatedMessage {
  type: 'session_created';
  sessionId: string;
}

export interface ReviewChunkMessage {
  type: 'review_chunk';
  content: string;
}

export interface ReviewCompleteMessage {
  type: 'review_complete';
  review: ReviewResult;
}

export interface ReviewErrorMessage {
  type: 'review_error';
  error: string;
}

export interface SessionLoadedMessage {
  type: 'session_loaded';
  session: ReviewSession;
}

export interface SessionDeletedMessage {
  type: 'session_deleted';
  sessionId: string;
}

export interface SessionListMessage {
  type: 'session_list';
  sessions: SessionSummary[];
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

// ============================================================================
// Domain Types
// ============================================================================

export interface ReviewResult {
  bugs: Issue[];
  style: Issue[];
  security: Issue[];
  summary: string;
  score: number;
  language?: string;
}

export interface Issue {
  line: number;
  message: string;
  severity?: 'high' | 'medium' | 'low';
  suggestion?: string;
  cwe?: string;
}

export interface ReviewSession {
  id: string;
  code: string;
  review: ReviewResult | null;
  language?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  language?: string;
  score?: number;
  createdAt: string;
}
