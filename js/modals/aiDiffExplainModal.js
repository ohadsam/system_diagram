// "Explain this diff with AI" — for modals/diagramCompareModal.js. Thin
// wrapper over the shared single-step aiAskModal.js.
import { buildDiffExplainPrompt } from '../io/aiDiffExplain.js';
import { openAiAskModal } from './aiAskModal.js';

export function openAiDiffExplainModal({ diff, leftLabel, rightLabel, allNodesById }) {
  openAiAskModal({
    title: '💬 Explain this diff with AI',
    hint: "Open your AI (copies the prompt and opens a new tab) — or send it directly. Paste its reply below, or it'll appear here automatically for a direct/local send.",
    prompt: buildDiffExplainPrompt({ diff, leftLabel, rightLabel, allNodesById }),
  });
}
