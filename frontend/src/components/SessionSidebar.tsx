import { Trash2, Clock3, FileCode2 } from 'lucide-react';
import type { SessionSummary } from '@/types';
import styles from './SessionSidebar.module.css';

interface SessionSidebarProps {
  sessions: SessionSummary[];
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  width?: number;
}

export default function SessionSidebar({
  sessions,
  onLoadSession,
  onDeleteSession,
  width,
}: SessionSidebarProps) {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch {
      return 'unknown';
    }
  };

  return (
    <aside className={styles.sidebar} style={width ? { width } : undefined}>
      <div className={styles.header}>
        <div>
          <h2>Review History</h2>
          <p>Open past sessions, revisit code, or clear old runs.</p>
        </div>
        <div className={styles.countPill}>
          {sessions.length}
        </div>
      </div>

      <div className={styles.content}>
        {sessions.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <FileCode2 size={28} />
            </div>
            <p>No reviews yet</p>
            <span>Submit code for review and your sessions will appear here.</span>
          </div>
        ) : (
          <div className={styles.sessionList}>
            {sessions.map((session) => (
              <div key={session.id} className={styles.sessionItem}>
                <button
                  onClick={() => onLoadSession(session.id)}
                  className={styles.sessionContent}
                >
                  <div className={styles.sessionInfo}>
                    <div className={styles.sessionMetaRow}>
                      <div className={styles.language}>
                        {session.language || 'unknown'}
                      </div>
                      {session.score !== undefined && (
                        <div className={styles.score}>{session.score}</div>
                      )}
                    </div>
                    <div className={styles.titleRow}>
                      <Clock3 size={12} />
                      <span className={styles.time}>
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                    <div className={styles.sessionTitle}>
                      Review session
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className={styles.deleteBtn}
                  title="Delete session"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
