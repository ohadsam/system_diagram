// Headless equivalent of panel/aiReviewPanel.js's "💡 Suggestions" send
// flow, for io/autoSuggestWatcher.js's background auto-trigger — same
// prompt builder and parser, but calls the configured automatic mode
// (Local AI, or the first configured Direct API provider) directly rather
// than through utils/aiProviderActions.js's UI-oriented button row, since
// there is no panel open (or even necessarily instantiated yet) for a
// background check to render into. Text-only: no diagram-image capture,
// since that's an extra async html2canvas pass not worth paying for an
// unattended background check the user didn't explicitly ask for this time.
import * as store from '../core/store.js';
import { buildSuggestionsPrompt, extractSuggestionsArray } from './aiReview.js';
import { sendPromptAutomatic } from './aiAutoSend.js';

/** @returns {Promise<{ok:true, data:object[]}|{ok:false, error:string}>} */
export async function runAutomaticSuggestions() {
  const state = store.getState();
  const componentNames = [...new Set(state.nodes.map((n) => n.text).filter(Boolean))];
  const prompt = buildSuggestionsPrompt({
    projectName: state.name,
    nodeCount: state.nodes.length,
    edgeCount: state.edges.length,
    componentNames,
    hasSequenceDiagram: state.nodes.some((n) => n.shape === 'lifeline'),
  });

  const sendResult = await sendPromptAutomatic({ prompt });
  if (!sendResult.ok) return sendResult;
  return extractSuggestionsArray(sendResult.text);
}
