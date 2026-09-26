import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  bracketMatching,
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
  codeFolding,
  foldGutter,
  foldKeymap,
} from "@codemirror/language";
import { Compartment, type Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";

const lightTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#ffffff", color: "#1f2328" },
    ".cm-gutters": { backgroundColor: "#f6f8fa", color: "#8c959f", border: "none" },
    ".cm-activeLine": { backgroundColor: "#f6f8fa88" },
    ".cm-activeLineGutter": { backgroundColor: "#eaeef2" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#1f2328" },
    "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "#add6ff" },
  },
  { dark: false },
);

const darkTheme = EditorView.theme(
  {
    "&": { backgroundColor: "#0d1117", color: "#e6edf3" },
    ".cm-gutters": { backgroundColor: "#161b22", color: "#6e7681", border: "none" },
    ".cm-activeLine": { backgroundColor: "#161b2288" },
    ".cm-activeLineGutter": { backgroundColor: "#21262d" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#e6edf3" },
    "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "#264f78" },
  },
  { dark: true },
);

const darkHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#79c0ff", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.link, color: "#a5d6ff" },
  { tag: tags.monospace, color: "#a5d6ff" },
  { tag: tags.quote, color: "#8b949e" },
  { tag: tags.processingInstruction, color: "#8b949e" },
]);

export function createEditor(
  parent: HTMLElement,
  doc: string,
  dark: boolean,
  onDocChanged: (doc: string) => void,
  langCompartment: Compartment,
  initialLang: Extension,
): EditorView {
  return new EditorView({
    parent,
    doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      codeFolding(),
      foldGutter(),
      bracketMatching(),
      highlightActiveLine(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap]),
      langCompartment.of(initialLang),
      EditorView.lineWrapping,
      dark ? darkTheme : lightTheme,
      syntaxHighlighting(dark ? darkHighlight : defaultHighlightStyle),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onDocChanged(u.state.doc.toString());
      }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "var(--font-size)" },
        ".cm-scroller": { fontFamily: "Consolas, 'Courier New', monospace", lineHeight: "1.6" },
        ".cm-content": { padding: "8px 0" },
      }),
    ],
  });
}
