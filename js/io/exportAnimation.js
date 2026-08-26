// Export/import Diagram Animation's own reveal sequence as its own JSON
// file — separate from the project's own JSON export (which already
// carries `animationSteps` for free, like every other project field, via
// core/project.js's validateProject). This is for moving/reusing just the
// animation definition on its own — backing it up separately, or
// reapplying it after re-importing the *same* diagram into a different
// browser/device. Import matches purely by id: a step whose targetId
// doesn't exist in the current diagram is skipped (reported in the
// returned counts) rather than guessed at, since ids are diagram-specific
// and can't be meaningfully remapped onto a different diagram's content.
import { downloadJSON, sanitizeFilename } from '../utils/download.js';
import { createAnimationStep, ANIMATION_REVEAL_MODES } from '../core/project.js';

const KIND = 'sdb-diagram-animation';

export function exportAnimation(steps, projectName, nodesById, edgesById) {
  const payload = {
    formatVersion: 1,
    kind: KIND,
    projectName,
    exportedAt: new Date().toISOString(),
    steps: steps.map((s) => ({
      targetType: s.targetType,
      targetId: s.targetId,
      revealMode: s.revealMode,
      delayMs: s.delayMs,
      // Human-readable only — never read back on import, purely so the
      // downloaded file itself is legible if someone opens it directly.
      targetLabel: s.targetType === 'node' ? (nodesById.get(s.targetId)?.text || '') : (edgesById.get(s.targetId)?.label || ''),
    })),
  };
  downloadJSON(payload, `${sanitizeFilename(projectName)}-animation.json`);
}

function stepFromImportedRaw(raw) {
  return createAnimationStep(raw.targetType, raw.targetId, {
    revealMode: ANIMATION_REVEAL_MODES.includes(raw.revealMode) ? raw.revealMode : 'click',
    delayMs: Number.isFinite(raw.delayMs) && raw.delayMs > 0 ? raw.delayMs : 2000,
  });
}

/**
 * @param {string} text
 * @param {Set<string>} existingNodeIds
 * @param {Set<string>} existingEdgeIds
 * @returns {{ok:true, steps:object[], appliedCount:number, skippedCount:number}|{ok:false, error:string}}
 */
export function parseAnimationFile(text, existingNodeIds, existingEdgeIds) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.kind !== KIND || !Array.isArray(parsed.steps)) {
    return { ok: false, error: 'Not a diagram animation file.' };
  }
  let skippedCount = 0;
  const steps = [];
  for (const raw of parsed.steps) {
    const validShape = raw && typeof raw === 'object' && (raw.targetType === 'node' || raw.targetType === 'edge') && typeof raw.targetId === 'string';
    const idSet = validShape ? (raw.targetType === 'node' ? existingNodeIds : existingEdgeIds) : null;
    if (!validShape || !idSet.has(raw.targetId)) {
      skippedCount += 1;
      continue;
    }
    steps.push(stepFromImportedRaw(raw));
  }
  return { ok: true, steps, appliedCount: steps.length, skippedCount };
}
