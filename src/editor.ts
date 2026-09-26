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

// GitHub-dark-flavored palette covering all languages, not just Markdown.
const darkHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "#79c0ff", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.link, color: "#a5d6ff" },
  { tag: tags.monospace, color: "#a5d6ff" },
  { tag: tags.quote, color: "#8b949e" },
  { tag: [tags.comment, tags.blockComment, tags.lineComment, tags.docComment], color: "#8b949e", fontStyle: "italic" },
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.definitionKeyword, tags.operatorKeyword, tags.self, tags.controlOperator], color: "#ff7b72" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape, tags.character], color: "#a5d6ff" },
  { tag: [tags.number, tags.integer, tags.float, tags.bool, tags.null, tags.atom, tags.unit], color: "#79c0ff" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: "#d2a8ff" },
  { tag: tags.propertyName, color: "#79c0ff" },
  { tag: [tags.attributeName, tags.labelName], color: "#79c0ff" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "#ffa657" },
  { tag: tags.tagName, color: "#7ee787" },
  { tag: tags.attributeValue, color: "#a5d6ff" },
  { tag: [tags.definition(tags.variableName), tags.function(tags.definition(tags.variableName))], color: "#e6edf3" },
  { tag: [tags.operator, tags.compareOperator, tags.arithmeticOperator, tags.logicOperator, tags.bitwiseOperator], color: "#ff7b72" },
  { tag: [tags.punctuation, tags.separator, tags.squareBracket, tags.paren, tags.brace, tags.angleBracket], color: "#c9d1d9" },
  { tag: [tags.meta, tags.processingInstruction, tags.annotation], color: "#8b949e" },
  { tag: tags.url, color: "#a5d6ff", textDecoration: "underline" },
  { tag: tags.inserted, color: "#7ee787" },
  { tag: tags.deleted, color: "#ff7b72" },
  { tag: tags.changed, color: "#79c0ff" },
  { tag: tags.invalid, color: "#f85149" },
  { tag: tags.special(tags.variableName), color: "#79c0ff" },
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
