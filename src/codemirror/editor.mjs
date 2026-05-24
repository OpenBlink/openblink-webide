import { EditorView, basicSetup } from "codemirror";
import { StreamLanguage } from "@codemirror/language";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { oneDark } from "@codemirror/theme-one-dark";

const parent = document.getElementById("ruby-editor");

if (!parent) {
  throw new Error("Ruby editor mount point was not found");
}

const notifyDocumentChanged = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    window.dispatchEvent(
      new CustomEvent("openblink:editor-doc-changed", {
        detail: { view: update.view },
      }),
    );
  }
});

window.editorView = new EditorView({
  doc: "",
  parent: parent,
  extensions: [
    basicSetup,
    StreamLanguage.define(ruby),
    oneDark,
    notifyDocumentChanged,
  ],
});
