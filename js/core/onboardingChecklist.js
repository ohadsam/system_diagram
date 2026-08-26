// A lightweight "getting started" checklist — deliberately separate from
// the sequential coach-mark hints (hints/hintData.js): hints point at one
// specific control at a time and are dismissed one-by-one as they're seen,
// while this is a standing, at-a-glance progress card a new user can check
// in on any time ("what haven't I tried yet?"). Every step's completion is
// derived from state that already exists elsewhere (current canvas, saved
// projects) rather than a new "did the user do X" event ledger — simpler,
// and self-correcting (e.g. deleting every comment un-checks that step,
// exactly as it should) instead of a one-way flag that can drift from
// reality. Pure/DOM-free — hints/onboardingChecklistWidget.js renders it.
export const ONBOARDING_STEPS = [
  { id: 'add-component', label: 'Add your first component', check: (ctx) => ctx.nodeCount > 0 },
  { id: 'connect', label: 'Connect two components with an arrow', check: (ctx) => ctx.edgeCount > 0 },
  { id: 'save', label: 'Save a named version ("Save As")', check: (ctx) => ctx.savedProjectCount > 0 },
  { id: 'comment', label: 'Leave a comment on the diagram', check: (ctx) => ctx.commentCount > 0 },
];

/**
 * @param {{nodeCount: number, edgeCount: number, savedProjectCount: number, commentCount: number}} ctx
 * @returns {{steps: {id: string, label: string, done: boolean}[], doneCount: number, total: number, allDone: boolean}}
 */
export function computeOnboardingProgress(ctx) {
  const steps = ONBOARDING_STEPS.map((step) => ({ id: step.id, label: step.label, done: !!step.check(ctx) }));
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, allDone: doneCount === steps.length };
}
