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

  /** Read-only view of the whole undo/redo stack as one chronological list —
   * for a visual history timeline (modals/historyTimelineModal.js), not for
   * mutation. `entries[currentIndex]` is always `this.current`. */
  getTimeline() {
    return {
      entries: [...this.undoStack, this.current, ...this.redoStack.slice().reverse()],
      currentIndex: this.undoStack.length,
    };
  }

  /** Moves `current` directly to `targetIndex` in the same chronological
   * list `getTimeline()` describes, via the same push/pop mechanics
   * undo()/redo() already use one step at a time — so a jump of N steps is
   * exactly N ordinary undos or redos collapsed into one call, not a new
   * traversal mechanism. Returns the snapshot now current, or `null` if
   * `targetIndex` is out of range or already current (a no-op). */
  jumpTo(targetIndex) {
    const { entries, currentIndex } = this.getTimeline();
    if (targetIndex < 0 || targetIndex >= entries.length || targetIndex === currentIndex) return null;
    if (targetIndex < currentIndex) {
      for (let i = 0; i < currentIndex - targetIndex; i++) {
        this.redoStack.push(this.current);
        this.current = this.undoStack.pop();
      }
    } else {
      for (let i = 0; i < targetIndex - currentIndex; i++) {
        this.undoStack.push(this.current);
        this.current = this.redoStack.pop();
      }
    }
    return structuredClone(this.current);
  }
}
