// Snapshot-based undo/redo. Pure, DOM-free, unit-testable.
// See ARCHITECTURE.md "Undo/redo" for the rationale.
const DEFAULT_LIMIT = 50;

export class History {
  constructor(limit = DEFAULT_LIMIT) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.current = null;
  }

  init(state) {
    this.current = structuredClone(state);
    this.undoStack = [];
    this.redoStack = [];
  }

  /** Record `state` as the new current snapshot, pushing the previous one onto the undo stack. */
  commit(state) {
    if (this.current) {
      this.undoStack.push(this.current);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.current = structuredClone(state);
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    this.redoStack.push(this.current);
    this.current = this.undoStack.pop();
    return structuredClone(this.current);
  }

  redo() {
    if (!this.canRedo()) return null;
    this.undoStack.push(this.current);
    this.current = this.redoStack.pop();
    return structuredClone(this.current);
  }
}
