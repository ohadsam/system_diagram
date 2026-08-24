// "AI Design Review" — prepares a review request for a well-known LLM chat,
// deliberately NOT a live API integration. No mainstream LLM provider
// offers anonymous, key-free API access (that's a constraint of the
// providers, not something a client-only app can work around), and
// scraping Google's embedded AI search results is neither technically
// feasible from a static page (CORS) nor allowed (their Terms of Service).
// So instead: build a ready-to-paste review prompt, export the diagram as
// an image, and open the provider's own web chat (the user's own
// already-logged-in session — no key, no config) in a new tab. The
// response comes back into the app only if the user pastes it into the
// side panel (panel/aiReviewPanel.js) — there is no automatic round trip.
export const AI_PROVIDERS = [
  { id: 'claude', name: 'Claude', icon: '🟠', url: 'https://claude.ai/new' },
  { id: 'chatgpt', name: 'ChatGPT', icon: '🟢', url: 'https://chatgpt.com/' },
  { id: 'gemini', name: 'Gemini', icon: '🔵', url: 'https://gemini.google.com/app' },
  { id: 'copilot', name: 'Copilot', icon: '🟣', url: 'https://copilot.microsoft.com/' },
];

const SPEC_TEXT_LIMIT = 12000;

export function buildReviewPrompt({ projectName, nodeCount, edgeCount, componentNames = [], specText = '', hasSequenceDiagram = false }) {
  const lines = [];
  if (hasSequenceDiagram) {
    lines.push(`Please review this sequence/communication-flow diagram (attached as an image), titled "${projectName || 'Untitled Diagram'}" — vertical lifelines per participant, with numbered messages between them in top-to-bottom time order.`);
  } else {
    lines.push(`Please review this system design / architecture diagram (attached as an image), titled "${projectName || 'Untitled Diagram'}".`);
  }
  lines.push(`It has ${nodeCount} component${nodeCount === 1 ? '' : 's'} and ${edgeCount} connector${edgeCount === 1 ? '' : 's'}.`);
  if (componentNames.length) {
    lines.push(`Components: ${componentNames.join(', ')}.`);
  }
  lines.push('');
  if (hasSequenceDiagram) {
    lines.push('Act as a senior engineer reviewing this interaction flow. Please:');
    lines.push('1. Summarize the flow in your own words, in call order.');
    lines.push('2. Call out anything missing or out of order — a response with no matching call, an unhandled error/timeout/retry path, an obvious race condition, or a step that seems to happen before its precondition is met.');
    lines.push('3. Flag any participant taking on too much responsibility, or a call that should be async/fire-and-forget but is drawn as a blocking round-trip (or vice versa).');
    lines.push('4. Suggest concrete improvements — missing steps to add, calls to reorder or parallelize, or a cleaner way to structure the interaction.');
  } else {
    lines.push('Act as a senior system design reviewer. Please:');
    lines.push('1. Summarize what you understand the system does.');
    lines.push('2. Call out strengths of this design.');
    lines.push('3. Call out risks, gaps or anti-patterns — scalability, reliability, security, cost, maintainability.');
    lines.push('4. Suggest concrete, prioritized improvements or alternative approaches.');
  }
  if (specText.trim()) {
    lines.push('');
    lines.push("Also compare the diagram against this product/requirements spec below — point out anything the diagram doesn't cover, and anything in the diagram not called for by the spec:");
    lines.push('--- SPEC START ---');
    lines.push(specText.trim().slice(0, SPEC_TEXT_LIMIT));
    lines.push('--- SPEC END ---');
  }
  lines.push('');
  lines.push("(I'm attaching the diagram as an image in this same message — let me know if it didn't come through.)");
  return lines.join('\n');
}
