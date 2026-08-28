// Builds the "grade my practice interview" prompt for Interview Mode
// (modals/interviewModeModal.js) — same "prepare & hand off" shape as
// io/aiReview.js's other prompt builders (no live API call baked in here;
// utils/aiProviderActions.js supplies the hand-off/direct/local send UI on
// top of whatever text this returns).
const SPEC_TEXT_LIMIT = 12000;

export function buildGradingPrompt({ promptTitle, promptText, diagramDescription }) {
  const lines = [];
  lines.push('I just practiced a system design interview question. Please grade my design.');
  lines.push('');
  lines.push(`Question: "${promptTitle}"`);
  lines.push(promptText);
  lines.push('');
  lines.push("Here's a plain-text description of the diagram I built:");
  lines.push('--- DIAGRAM START ---');
  lines.push((diagramDescription || '(empty — no components on the canvas)').trim().slice(0, SPEC_TEXT_LIMIT));
  lines.push('--- DIAGRAM END ---');
  lines.push('');
  lines.push('Act as a system design interviewer giving feedback after the interview. Please:');
  lines.push('1. Give an overall letter grade (A-F) or score out of 10 for how well this design answers the question.');
  lines.push('2. Call out what the design handles well.');
  lines.push("3. Call out what's missing or weak — scalability, reliability, data consistency, or requirements the question implies but the design doesn't address.");
  lines.push('4. Suggest the 2-3 highest-value follow-up questions a real interviewer would probably ask next, given what was (and wasn\'t) covered.');
  return lines.join('\n');
}
