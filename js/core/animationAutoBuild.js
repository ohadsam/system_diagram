// Pure helper for offering a ready-made "walkthrough" Diagram Animation
// right after an AI-generation flow (Generate Design from Spec, AI Quick
// Start, Import from Image — see modals/autoAnimationPrompt.js for the
// small confirmation UI that calls this) creates a fresh diagram. Reveals
// every node, then every edge, in the exact order they appear in the
// freshly-generated project's own `nodes`/`edges` arrays — the order an
// AI naturally lists things in already reads as a narrative (gateway,
// service, database, then the connections between them), so no smarter
// heuristic is needed here.
import { createAnimation, createAnimationStep } from './project.js';

export const AUTO_ANIMATION_MIN_DELAY_MS = 1000;
export const AUTO_ANIMATION_MAX_DELAY_MS = 30000;
export const AUTO_ANIMATION_DEFAULT_DELAY_MS = 3000;

/**
 * @param {{nodes: object[], edges: object[]}} project
 * @param {{revealMode?: 'auto'|'click', delayMs?: number, name?: string}} [opts]
 */
export function buildAutoWalkthroughAnimation(project, opts = {}) {
  const revealMode = opts.revealMode === 'click' ? 'click' : 'auto';
  const delayMs = Number.isFinite(opts.delayMs)
    ? Math.min(AUTO_ANIMATION_MAX_DELAY_MS, Math.max(AUTO_ANIMATION_MIN_DELAY_MS, opts.delayMs))
    : AUTO_ANIMATION_DEFAULT_DELAY_MS;
  const stepOverrides = { revealMode, delayMs };

  const steps = [
    ...(project.nodes || []).map((n) => createAnimationStep({ targetType: 'node', targetId: n.id }, stepOverrides)),
    ...(project.edges || []).map((e) => createAnimationStep({ targetType: 'edge', targetId: e.id }, stepOverrides)),
  ];
  return createAnimation(opts.name || 'Walkthrough', { steps, autoFocus: true });
}
