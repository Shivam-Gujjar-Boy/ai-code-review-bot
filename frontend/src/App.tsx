import { useEffect, useRef, useState } from 'react';
import { Trash2, RotateCw } from 'lucide-react';
import type { SessionSummary, ReviewSession, ReviewResult } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import CodeEditor from '@/components/CodeEditor';
import ReviewPanel from '@/components/ReviewPanel';
import SessionSidebar from '@/components/SessionSidebar';
import styles from './App.module.css';

interface EditorState {
  code: string;
  language: string;
}

interface ReviewState {
  isReviewing: boolean;
  rawContent: string;
  review: ReviewResult | null;
  error: string | null;
}

type ResizeTarget = 'sidebar' | 'editor' | null;

export default function App() {
  const [editor, setEditor] = useState<EditorState>({ code: '', language: 'javascript' });
  const [review, setReview] = useState<ReviewState>({
    isReviewing: false,
    rawContent: '',
    review: null,
    error: null,
  });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [editorWidth, setEditorWidth] = useState(680);
  const [activeResize, setActiveResize] = useState<ResizeTarget>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const ws = useWebSocket({
    onSessionCreated: () => {
      // Refresh session list when new session is created
    },
    onReviewChunk: (chunk) => {
      setReview((prev) => ({
        ...prev,
        rawContent: prev.rawContent + chunk,
      }));
    },
    onReviewComplete: (reviewData) => {
      setReview((prev) => ({
        ...prev,
        isReviewing: false,
        review: reviewData,
        error: null,
      }));
    },
    onError: (error) => {
      setReview((prev) => ({
        ...prev,
        isReviewing: false,
        error,
      }));
    },
    onSessionList: (sessionList) => {
      setSessions(sessionList);
    },
    onSessionLoaded: (session: ReviewSession) => {
      setEditor({ code: session.code, language: session.language || 'javascript' });
      setReview({
        isReviewing: false,
        rawContent: '',
        review: session.review,
        error: null,
      });
    },
    onSessionDeleted: () => {
      ws.listSessions();
    },
  });

  useEffect(() => {
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const handleMouseMove = (event: MouseEvent) => {
      if (!activeResize || !containerRef.current) return;

      const bounds = containerRef.current.getBoundingClientRect();
      const sidebarMin = 260;
      const sidebarMax = 420;
      const editorMin = 560;
      const reviewMin = 420;
      const gutterSpace = 24;

      if (activeResize === 'sidebar') {
        const maxWidth = Math.max(sidebarMin, bounds.width - editorMin - reviewMin - gutterSpace);
        setSidebarWidth(clamp(event.clientX - bounds.left, sidebarMin, Math.min(sidebarMax, maxWidth)));
      }

      if (activeResize === 'editor') {
        const leftEdge = bounds.left + sidebarWidth + gutterSpace;
        const maxWidth = Math.max(editorMin, bounds.width - sidebarWidth - reviewMin - gutterSpace * 2);
        setEditorWidth(clamp(event.clientX - leftEdge, editorMin, maxWidth));
      }
    };

    const handleMouseUp = () => {
      setActiveResize(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (activeResize) {
      document.body.style.cursor = activeResize === 'sidebar' ? 'col-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeResize, sidebarWidth]);

  const handleReview = async () => {
    if (!editor.code.trim()) {
      setReview((prev) => ({ ...prev, error: 'Please enter code to review' }));
      return;
    }

    setReview({
      isReviewing: true,
      rawContent: '',
      review: null,
      error: null,
    });

    ws.submitReview(editor.code, editor.language);
  };

  const handleClearEditor = () => {
    setEditor({ code: '', language: 'javascript' });
    setReview({
      isReviewing: false,
      rawContent: '',
      review: null,
      error: null,
    });
  };

  const handleLoadSession = (sessionId: string) => {
    ws.loadSession(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    ws.deleteSession(sessionId);
  };

  const startResize = (target: ResizeTarget) => {
    setActiveResize(target);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const filename = file.name.toLowerCase();

      // Detect language from file extension
      let language = 'javascript';
      if (filename.endsWith('.py')) language = 'python';
      else if (filename.endsWith('.ts') || filename.endsWith('.tsx')) language = 'typescript';
      else if (filename.endsWith('.java')) language = 'java';
      else if (filename.endsWith('.rs')) language = 'rust';
      else if (filename.endsWith('.cpp') || filename.endsWith('.cc') || filename.endsWith('.cxx') || filename.endsWith('.c++')) language = 'cpp';
      else if (filename.endsWith('.json')) language = 'json';
      else if (filename.endsWith('.html')) language = 'html';
      else if (filename.endsWith('.css')) language = 'css';
      else if (filename.endsWith('.xml')) language = 'xml';

      setEditor({ code: content, language });
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brandBlock}>
            <div className={styles.brandMark}>AI</div>
            <div>
              <h1>Code Review Workspace</h1>
              <p>Live review stream, session history, and editable source side by side.</p>
            </div>
          </div>
          <div className={styles.statusBadge}>
            <span className={ws.connected ? styles.connected : styles.disconnected}></span>
            {ws.connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      <div
        className={styles.container}
        ref={containerRef}
        style={{
          '--sidebar-width': `${sidebarWidth}px`,
          '--editor-width': `${editorWidth}px`,
        } as React.CSSProperties}
      >
        <SessionSidebar
          sessions={sessions}
          onLoadSession={handleLoadSession}
          onDeleteSession={handleDeleteSession}
          width={sidebarWidth}
        />

        <div
          className={styles.resizeHandle}
          onMouseDown={() => startResize('sidebar')}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize history panel"
        />

        <div className={styles.editorPane}>
          <div className={styles.editorHeader}>
            <div className={styles.editorTitle}>
              <h2>Code Editor</h2>
              <span className={styles.languageBadge}>{editor.language}</span>
            </div>
            <div className={styles.editorControls}>
              <label className={styles.uploadBtn}>
                <span>Upload</span>
                <input
                  type="file"
                  hidden
                  onChange={handleFileUpload}
                  accept=".js,.ts,.tsx,.py,.java,.rs,.cpp,.cc,.cxx,.json,.html,.css,.xml"
                />
              </label>
              <button
                className={styles.clearBtn}
                onClick={handleClearEditor}
                title="Clear editor"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <CodeEditor
            value={editor.code}
            onChange={(code) => setEditor((prev) => ({ ...prev, code }))}
            language={editor.language}
            onLanguageChange={(language) => setEditor((prev) => ({ ...prev, language }))}
            disabled={review.isReviewing}
          />

          <div className={styles.editorFooter}>
            <div className={styles.editorHint}>
              Paste code, upload a file, or switch languages before sending a review.
            </div>
            <button
              className={`${styles.reviewBtn} ${review.isReviewing ? styles.reviewing : ''}`}
              onClick={handleReview}
              disabled={review.isReviewing}
            >
              {review.isReviewing ? (
                <>
                  <RotateCw size={16} className={styles.spinIcon} />
                  Reviewing...
                </>
              ) : (
                'Review Code'
              )}
            </button>
          </div>
        </div>

        <div
          className={styles.resizeHandle}
          onMouseDown={() => startResize('editor')}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor pane"
        />

        <div className={styles.reviewPane}>
          <ReviewPanel
            isLoading={review.isReviewing}
            review={review.review}
            error={review.error}
          />
        </div>
      </div>
    </div>
  );
}
