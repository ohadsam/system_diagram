// Export/import Diagram Animation's own animations collection as its own
// JSON file — separate from the project's own JSON export (which already
// carries `animations`/`activeAnimationId` for free, like every other
// project field, via core/project.js's validateProject). This is for
// moving/reusing just the animation definitions on their own — backing them
// up separately, or reapplying them after re-importing the *same* diagram
// into a different browser/device. Import matches purely by id: a target
// whose id doesn't exist in the current diagram is skipped (reported in the
// returned counts) rather than guessed at, since ids are diagram-specific
// and can't be meaningfully remapped onto a different diagram's content.
// Every id in the file (step ids, animation ids) is ignored on import —
// fresh ones are always assigned, same as a project's own JSON import.
import { downloadJSON, sanitizeFilename } from '../utils/download.js';
import { createAnimation, createAnimationStep, ANIMATION_REVEAL_MODES, ANIMATION_ENTRANCE_STYLES } from '../core/project.js';

const KIND = 'sdb-diagram-animation';
const FORMAT_VERSION = 2;

export function exportAnimation(animations, projectName, nodesById, edgesById) {
  const targetLabel = (t) => (t.targetType === 'node' ? (nodesById.get(t.targetId)?.text || '') : (edgesById.get(t.targetId)?.label || ''));
  const activeAnimation = animations.find((a) => a.steps.length) || animations[0];
  const payload = {
    formatVersion: FORMAT_VERSION,
    kind: KIND,
    projectName,
    exportedAt: new Date().toISOString(),
    // Best-effort only: re-selected by matching *name* on import, since a
    // fresh id is always assigned to every animation on the way back in
    // (see the header comment) — a name collision or a renamed animation
    // just falls back to the first one, same as no match at all.
    activeAnimationName: activeAnimation?.name ?? null,
    animations: animations.map((a) => ({
      name: a.name,
      autoFocus: a.autoFocus,
      steps: a.steps.map((s) => ({
        targets: s.targets.map((t) => ({
          targetType: t.targetType,
          targetId: t.targetId,
          // Human-readable only — never read back on import, purely so the
          // downloaded file itself is legible if someone opens it directly.
          targetLabel: targetLabel(t),
        })),
        revealMode: s.revealMode,
        delayMs: s.delayMs,
        entranceStyle: s.entranceStyle,
        hideAfterMs: s.hideAfterMs,
        notes: s.notes,
      })),
    })),
  };
  downloadJSON(payload, `${sanitizeFilename(projectName)}-animation.json`);
}

/** Validates one imported step's targets against the *current* diagram,
 * returning `{ step, appliedCount, skippedCount }` (step is null if every
 * target was dropped). Shared by the v2 and legacy-v1 import paths below. */
function stepFromImportedRaw(raw, existingNodeIds, existingEdgeIds) {
  if (!raw || typeof raw !== 'object') return { step: null, appliedCount: 0, skippedCount: 1 };
  const rawTargets = Array.isArray(raw.targets) ? raw.targets : [];
  let skippedCount = 0;
  const targets = [];
  for (const t of rawTargets) {
    const validShape = t && typeof t === 'object' && (t.targetType === 'node' || t.targetType === 'edge') && typeof t.targetId === 'string';
    const idSet = validShape ? (t.targetType === 'node' ? existingNodeIds : existingEdgeIds) : null;
    if (!validShape || !idSet.has(t.targetId)) { skippedCount += 1; continue; }
    targets.push({ targetType: t.targetType, targetId: t.targetId });
  }
  if (!targets.length) return { step: null, appliedCount: 0, skippedCount };
  const step = createAnimationStep(targets, {
    revealMode: ANIMATION_REVEAL_MODES.includes(raw.revealMode) ? raw.revealMode : 'click',
    delayMs: Number.isFinite(raw.delayMs) && raw.delayMs > 0 ? raw.delayMs : 2000,
    entranceStyle: ANIMATION_ENTRANCE_STYLES.includes(raw.entranceStyle) ? raw.entranceStyle : 'fade',
    hideAfterMs: Number.isFinite(raw.hideAfterMs) && raw.hideAfterMs > 0 ? raw.hideAfterMs : 0,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
  });
  return { step, appliedCount: targets.length, skippedCount };
}

function animationFromImportedRaw(raw, existingNodeIds, existingEdgeIds) {
  let appliedCount = 0;
  let skippedCount = 0;
  const steps = [];
  for (const rawStep of Array.isArray(raw.steps) ? raw.steps : []) {
    const result = stepFromImportedRaw(rawStep, existingNodeIds, existingEdgeIds);
    appliedCount += result.appliedCount;
    skippedCount += result.skippedCount;
    if (result.step) steps.push(result.step);
  }
  const animation = createAnimation(raw.name, { steps, autoFocus: raw.autoFocus === true });
  return { animation, appliedCount, skippedCount };
}

/**
 * @param {string} text
 * @param {Set<string>} existingNodeIds
 * @param {Set<string>} existingEdgeIds
 * @returns {{ok:true, animations:object[], activeAnimationId:string|null, appliedCount:number, skippedCount:number}|{ok:false, error:string}}
 */
export function parseAnimationFile(text, existingNodeIds, existingEdgeIds) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.kind !== KIND) {
    return { ok: false, error: 'Not a diagram animation file.' };
  }

  // Legacy v1 files: one flat `steps` array, each a single {targetType,
  // targetId} pair rather than today's {targets: [...]} — wrapped into one
  // "Animation 1" on import, same migration core/project.js#validateProject
  // applies to an old project's own `animationSteps` field.
  if (!Array.isArray(parsed.animations) && Array.isArray(parsed.steps)) {
    const legacySteps = parsed.steps.map((s) => (
      s && typeof s === 'object' ? { ...s, targets: [{ targetType: s.targetType, targetId: s.targetId }] } : s
    ));
    const { animation, appliedCount, skippedCount } = animationFromImportedRaw(
      { name: 'Animation 1', steps: legacySteps },
      existingNodeIds, existingEdgeIds,
    );
    return { ok: true, animations: [animation], activeAnimationId: animation.id, appliedCount, skippedCount };
  }

  if (!Array.isArray(parsed.animations)) {
    return { ok: false, error: 'Not a diagram animation file.' };
  }
  let appliedCount = 0;
  let skippedCount = 0;
  const animations = [];
  for (const raw of parsed.animations) {
    if (!raw || typeof raw !== 'object') continue;
    const result = animationFromImportedRaw(raw, existingNodeIds, existingEdgeIds);
    appliedCount += result.appliedCount;
    skippedCount += result.skippedCount;
    animations.push(result.animation);
  }
  const active = animations.find((a) => a.name === parsed.activeAnimationName) || animations[0];
  return { ok: true, animations, activeAnimationId: active?.id ?? null, appliedCount, skippedCount };
}
