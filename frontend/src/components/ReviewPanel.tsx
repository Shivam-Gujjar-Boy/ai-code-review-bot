import { AlertCircle, AlertTriangle, AlertOctagon, Loader } from 'lucide-react';
import type { ReviewResult } from '@/types';
import styles from './ReviewPanel.module.css';

interface ReviewPanelProps {
  isLoading: boolean;
  review: ReviewResult | null;
  error: string | null;
}

export default function ReviewPanel({ isLoading, review, error }: ReviewPanelProps) {
  if (isLoading) {
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>
          <Loader size={40} className={styles.spinner} />
          <p>Reviewing your code...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.panel}>
        <div className={styles.error}>
          <AlertCircle size={32} />
          <h3>Review Failed</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <p>📝 Submit code for review to see feedback here</p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return styles.severityHigh;
      case 'medium':
        return styles.severityMedium;
      case 'low':
        return styles.severityLow;
      default:
        return '';
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'high':
        return <AlertOctagon size={16} />;
      case 'medium':
        return <AlertTriangle size={16} />;
      default:
        return <AlertCircle size={16} />;
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.scoreBoard}>
          <div className={styles.scoreCircle}>
            <span className={styles.scoreValue}>{review.score}</span>
            <span className={styles.scoreLabel}>Score</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h3 className={styles.title}>Summary</h3>
          <p className={styles.summary}>{review.summary}</p>
        </section>

        {review.bugs.length > 0 && (
          <section className={styles.section}>
            <h3 className={`${styles.title} ${styles.bugsTitle}`}>
              🐛 Bugs ({review.bugs.length})
            </h3>
            <div className={styles.issues}>
              {review.bugs.map((bug, idx) => (
                <div key={idx} className={`${styles.issue} ${getSeverityColor(bug.severity)}`}>
                  <div className={styles.issueIcon}>{getSeverityIcon(bug.severity)}</div>
                  <div className={styles.issueContent}>
                    <div className={styles.issueLine}>Line {bug.line}</div>
                    <div className={styles.issueMessage}>{bug.message}</div>
                    {bug.suggestion && (
                      <div className={styles.issueSuggestion}>
                        💡 {bug.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {review.security.length > 0 && (
          <section className={styles.section}>
            <h3 className={`${styles.title} ${styles.securityTitle}`}>
              🔒 Security ({review.security.length})
            </h3>
            <div className={styles.issues}>
              {review.security.map((sec, idx) => (
                <div key={idx} className={`${styles.issue} ${getSeverityColor(sec.severity)}`}>
                  <div className={styles.issueIcon}>{getSeverityIcon(sec.severity)}</div>
                  <div className={styles.issueContent}>
                    <div className={styles.issueLine}>
                      Line {sec.line}
                      {sec.cwe && <span className={styles.cweTag}>{sec.cwe}</span>}
                    </div>
                    <div className={styles.issueMessage}>{sec.message}</div>
                    {sec.suggestion && (
                      <div className={styles.issueSuggestion}>
                        💡 {sec.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {review.style.length > 0 && (
          <section className={styles.section}>
            <h3 className={`${styles.title} ${styles.styleTitle}`}>
              ✨ Style ({review.style.length})
            </h3>
            <div className={styles.issues}>
              {review.style.map((style, idx) => (
                <div key={idx} className={styles.issue}>
                  <div className={styles.issueIcon}>
                    <AlertCircle size={16} />
                  </div>
                  <div className={styles.issueContent}>
                    <div className={styles.issueLine}>Line {style.line}</div>
                    <div className={styles.issueMessage}>{style.message}</div>
                    {style.suggestion && (
                      <div className={styles.issueSuggestion}>
                        💡 {style.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {review.bugs.length === 0 &&
          review.security.length === 0 &&
          review.style.length === 0 && (
            <div className={styles.allGood}>
              ✅ Great code! No issues found.
            </div>
          )}
      </div>
    </div>
  );
}
