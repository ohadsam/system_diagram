// Pure timing math for io/exportAnimationVideo.js, split out so the "how
// long does each step hold on screen" rule is unit-testable without
// touching MediaRecorder/canvas capture at all. A 'click' step has no
// meaningful screen-time for an unattended video recording (nobody's
// there to click) — CLICK_STEP_DWELL_MS stands in for it, the same fixed
// pace a presenter would realistically click through it at by hand.
export const CLICK_STEP_DWELL_MS = 2000;

export function computeStepDurationMs(step, clickDwellMs = CLICK_STEP_DWELL_MS) {
  return step.revealMode === 'auto' ? step.delayMs : clickDwellMs;
}

export function computeTotalDurationMs(steps, clickDwellMs = CLICK_STEP_DWELL_MS) {
  return steps.reduce((sum, step) => sum + computeStepDurationMs(step, clickDwellMs), 0);
}
