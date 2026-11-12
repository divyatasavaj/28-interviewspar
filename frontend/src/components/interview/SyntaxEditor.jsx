import { useEffect, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { tags } from '@lezer/highlight';

const highlighting = HighlightStyle.define([
  { tag: [tags.keyword, tags.operator], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.comment], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool], color: 'var(--code-number)' },
  { tag: tags.function(tags.variableName), color: 'var(--theme-link)' },
]);
const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--panel)', color: 'var(--ink)', fontSize: '14px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, monospace', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { padding: '12px 0', minHeight: '220px', caretColor: 'var(--ink)' },
  '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--muted)', borderRight: '1px solid var(--line)' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--wash)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--editor-selection)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--editor-selection)', outline: '1px solid var(--focus)' },
  '.cm-cursor': { borderLeftColor: 'var(--ink)' },
});

export default function SyntaxEditor({ value, language, disabled, onChange }) {
  const host = useRef(null);
  const view = useRef(null);
  const onChangeRef = useRef(onChange);
  const languageConfig = useRef(new Compartment());
  const lockConfig = useRef(new Compartment());
  onChangeRef.current = onChange;

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(),
          history(), indentOnInput(), bracketMatching(), closeBrackets(),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          syntaxHighlighting(highlighting), editorTheme,
          languageConfig.current.of(language === 'python' ? python() : javascript()),
          lockConfig.current.of(EditorState.readOnly.of(disabled)),
          EditorView.contentAttributes.of({ id: 'solution-code', 'aria-label': 'Your code', 'aria-describedby': 'editor-help', spellcheck: 'false' }),
          EditorState.transactionFilter.of(transaction =>
            transaction.newDoc.length > 12000 && transaction.docChanged ? [] : transaction),
          EditorView.updateListener.of(update => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
    // The mounted editor owns its history. Later props are applied through compartments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: [
      languageConfig.current.reconfigure(language === 'python' ? python() : javascript()),
      lockConfig.current.reconfigure(EditorState.readOnly.of(disabled)),
    ] });
  }, [language, disabled]);

  return <div className="syntax-editor" ref={host} />;
}
