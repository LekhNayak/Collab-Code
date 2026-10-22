// Two-way binding between a Y.Text and a Monaco model — a trimmed fork of y-monaco 0.1.6.
//
// Differences from upstream:
//  - takes the monaco namespace from the editor instead of importing monaco-editor, which made
//    the bundle ship a second copy of Monaco next to the one @monaco-editor/react loads
//  - disposes its cursor listener on destroy (upstream leaks one per binding)
//  - binds a single editor; several bindings (one per open tab) can share that editor, each only
//    acting while its own model is the editor's current model
//  - rerender() / publishSelection() so remote cursors and our own cursor update on tab switch
//
// Text in the Y.Text uses "\n" only (the server normalizes on load), and callers set the model's
// EOL to LF, so model offsets and Y.Text indexes always line up.

import * as Y from 'yjs';
import type * as Monaco from 'monaco-editor';
import type { WebsocketProvider } from 'y-websocket';

type MonacoApi = typeof Monaco;
type Awareness = WebsocketProvider['awareness'];

interface RelativeSelection {
    start: Y.RelativePosition;
    end: Y.RelativePosition;
    direction: Monaco.SelectionDirection;
}

export interface MonacoBindingOptions {
    // Publish our cursor/selection to other clients (off for read-only observers)
    shareSelection?: boolean;
}

export class MonacoBinding {
    private readonly monaco: MonacoApi;
    private readonly doc: Y.Doc;
    private readonly ytext: Y.Text;
    private readonly model: Monaco.editor.ITextModel;
    private readonly editor: Monaco.editor.IStandaloneCodeEditor;
    private readonly awareness: Awareness | null;
    private readonly shareSelection: boolean;
    private savedSelection: RelativeSelection | null = null;
    private decorations: string[] = [];
    private applyingRemote = false;
    private applyingLocal = false;
    private destroyed = false;
    private readonly disposables: Monaco.IDisposable[] = [];

    constructor(
        monaco: MonacoApi,
        ytext: Y.Text,
        model: Monaco.editor.ITextModel,
        editor: Monaco.editor.IStandaloneCodeEditor,
        awareness: Awareness | null,
        options: MonacoBindingOptions = {},
    ) {
        this.monaco = monaco;
        this.doc = ytext.doc as Y.Doc;
        this.ytext = ytext;
        this.model = model;
        this.editor = editor;
        this.awareness = awareness;
        this.shareSelection = options.shareSelection ?? true;

        this.doc.on('beforeAllTransactions', this.beforeTransaction);
        ytext.observe(this.ytextObserver);

        if (model.getValue() !== ytext.toString()) {
            model.setValue(ytext.toString());
        }

        this.disposables.push(
            model.onDidChangeContent(event => {
                if (this.applyingRemote) return;
                this.applyingLocal = true;
                try {
                    // Apply changes from right to left so earlier offsets stay valid
                    this.doc.transact(() => {
                        [...event.changes]
                            .sort((a, b) => b.rangeOffset - a.rangeOffset)
                            .forEach(change => {
                                ytext.delete(change.rangeOffset, change.rangeLength);
                                ytext.insert(change.rangeOffset, change.text);
                            });
                    }, this);
                } finally {
                    this.applyingLocal = false;
                }
            }),
            model.onWillDispose(() => this.destroy()),
            editor.onDidChangeCursorSelection(() => this.publishSelection()),
        );
        awareness?.on('change', this.rerender);
    }

    private get isActive(): boolean {
        return this.editor.getModel() === this.model;
    }

    // Remember our selection relative to the shared text, so remote edits don't move it
    private beforeTransaction = () => {
        if (this.applyingLocal) return;
        this.savedSelection = null;
        if (!this.isActive) return;
        const sel = this.editor.getSelection();
        if (!sel) return;
        this.savedSelection = {
            start: Y.createRelativePositionFromTypeIndex(this.ytext, this.model.getOffsetAt(sel.getStartPosition())),
            end: Y.createRelativePositionFromTypeIndex(this.ytext, this.model.getOffsetAt(sel.getEndPosition())),
            direction: sel.getDirection(),
        };
    };

    private ytextObserver = (event: Y.YTextEvent) => {
        if (event.transaction.origin === this) return;
        const { monaco, model } = this;
        this.applyingRemote = true;
        try {
            let index = 0;
            event.delta.forEach(op => {
                if (op.retain !== undefined) {
                    index += op.retain;
                } else if (op.insert !== undefined) {
                    const pos = model.getPositionAt(index);
                    const text = op.insert as string;
                    model.applyEdits([{ range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column), text }]);
                    index += text.length;
                } else if (op.delete !== undefined) {
                    const start = model.getPositionAt(index);
                    const end = model.getPositionAt(index + op.delete);
                    model.applyEdits([{ range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column), text: '' }]);
                }
            });
            const rsel = this.savedSelection;
            if (rsel && this.isActive) {
                const start = Y.createAbsolutePositionFromRelativePosition(rsel.start, this.doc);
                const end = Y.createAbsolutePositionFromRelativePosition(rsel.end, this.doc);
                if (start && end && start.type === this.ytext && end.type === this.ytext) {
                    const s = model.getPositionAt(start.index);
                    const e = model.getPositionAt(end.index);
                    this.editor.setSelection(monaco.Selection.createWithDirection(s.lineNumber, s.column, e.lineNumber, e.column, rsel.direction));
                }
            }
        } finally {
            this.applyingRemote = false;
        }
        this.rerender();
    };

    // Draw other users' cursors/selections that are inside this file
    rerender = () => {
        if (this.destroyed || !this.awareness) return;
        if (!this.isActive) {
            this.decorations = [];
            return;
        }
        const { monaco, model } = this;
        const next: Monaco.editor.IModelDeltaDecoration[] = [];
        this.awareness.getStates().forEach((state, clientId) => {
            if (clientId === this.doc.clientID || !state.selection?.anchor || !state.selection?.head) return;
            const anchor = Y.createAbsolutePositionFromRelativePosition(state.selection.anchor, this.doc);
            const head = Y.createAbsolutePositionFromRelativePosition(state.selection.head, this.doc);
            if (!anchor || !head || anchor.type !== this.ytext || head.type !== this.ytext) return;
            const forward = anchor.index < head.index;
            const start = model.getPositionAt(forward ? anchor.index : head.index);
            const end = model.getPositionAt(forward ? head.index : anchor.index);
            const headClass = `yRemoteSelectionHead yRemoteSelectionHead-${clientId}`;
            next.push({
                range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
                options: {
                    className: `yRemoteSelection yRemoteSelection-${clientId}`,
                    afterContentClassName: forward ? headClass : null,
                    beforeContentClassName: forward ? null : headClass,
                },
            });
        });
        this.decorations = this.editor.deltaDecorations(this.decorations, next);
    };

    publishSelection = () => {
        if (this.destroyed || !this.awareness || !this.shareSelection || !this.isActive) return;
        const sel = this.editor.getSelection();
        if (!sel) return;
        let anchor = this.model.getOffsetAt(sel.getStartPosition());
        let head = this.model.getOffsetAt(sel.getEndPosition());
        if (sel.getDirection() === this.monaco.SelectionDirection.RTL) [anchor, head] = [head, anchor];
        this.awareness.setLocalStateField('selection', {
            anchor: Y.createRelativePositionFromTypeIndex(this.ytext, anchor),
            head: Y.createRelativePositionFromTypeIndex(this.ytext, head),
        });
    };

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.disposables.forEach(d => d.dispose());
        this.ytext.unobserve(this.ytextObserver);
        this.doc.off('beforeAllTransactions', this.beforeTransaction);
        this.awareness?.off('change', this.rerender);
    }
}
