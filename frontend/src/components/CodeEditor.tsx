import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import styles from './CodeEditor.module.css';

interface CodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  disabled?: boolean;
}

const LANGUAGE_MAP: Record<string, () => any> = {
  javascript: () => javascript({ jsx: true }),
  typescript: () => javascript({ jsx: true, typescript: true }),
  python: () => python(),
  html: () => html(),
  css: () => css(),
  json: () => json(),
  xml: () => xml(),
  java: () => java(),
  rust: () => rust(),
  cpp: () => cpp(),
};

export default function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  disabled
}: CodeEditorProps) {
  const extension = useMemo(() => {
    const getLang = LANGUAGE_MAP[language] || (() => javascript());
    return getLang();
  }, [language]);

  return (
    <div className={styles.editor}>
      <div className={styles.languageSelector}>
        <label htmlFor="language-select">Language:</label>
        <select
          id="language-select"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={disabled}
          className={styles.select}
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="rust">Rust</option>
          <option value="cpp">C++</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
          <option value="xml">XML</option>
        </select>
      </div>

      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[extension]}
        height="100%"
        theme="dark"
        className={styles.codemirror}
        readOnly={disabled}
      />
    </div>
  );
}
