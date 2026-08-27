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

const SUGGESTION_CATEGORIES = ['component', 'pricing', 'improvement'];

/** Distinct from Review/Explain above: instead of a free-form critique to
 * paste back and read, asks for a strict, parseable JSON array so
 * panel/aiReviewPanel.js can render actionable suggestion cards (a
 * missing component with a one-click "add", pricing notes, other
 * improvements) — this is what makes "automatic suggestions" through the
 * Direct API / Local AI send buttons actually work, rather than just
 * dumping another block of prose. Kept self-sufficient from the text
 * summary alone (component names/counts): Local AI mode never attaches
 * the diagram image (text-only), so the image — sent along for a
 * Direct-mode call — is treated as a bonus, never a requirement. */
export function buildSuggestionsPrompt({ projectName, nodeCount, edgeCount, componentNames = [], specText = '', hasSequenceDiagram = false }) {
  const lines = [];
  lines.push(`Here is a ${hasSequenceDiagram ? 'sequence/communication-flow' : 'system design / architecture'} diagram titled "${projectName || 'Untitled Diagram'}" (a diagram image may also be attached to this message — use it if present).`);
  lines.push(`It has ${nodeCount} component${nodeCount === 1 ? '' : 's'} and ${edgeCount} connector${edgeCount === 1 ? '' : 's'}.`);
  if (componentNames.length) {
    lines.push(`Components: ${componentNames.join(', ')}.`);
  }
  lines.push('');
  lines.push('Suggest concrete, specific improvements to this design. Respond with ONLY a JSON array (no prose before or after, no markdown code fence) of 3 to 8 objects, each shaped exactly like:');
  lines.push('{"category": "component", "title": "short label", "detail": "one or two plain sentences"}');
  lines.push('');
  lines.push('Use these three categories, and cover more than one where relevant:');
  lines.push('- "component": a specific, nameable missing or complementary component/service worth adding (e.g. "Redis Cache", "Dead Letter Queue", "Web Application Firewall") — a real thing with a real name, not a vague concept.');
  lines.push('- "pricing": a cost/pricing consideration or optimization worth knowing about, specific to what\'s actually in this diagram.');
  lines.push('- "improvement": any other concrete design improvement, risk, or best practice (reliability, security, scalability, maintainability).');
  lines.push("Base every suggestion on the actual components and structure above — skip generic advice that doesn't apply to this specific diagram.");
  if (specText.trim()) {
    lines.push('');
    lines.push("Also weigh this product/requirements spec — call out missing components or considerations the spec implies but the diagram doesn't yet cover:");
    lines.push('--- SPEC START ---');
    lines.push(specText.trim().slice(0, SPEC_TEXT_LIMIT));
    lines.push('--- SPEC END ---');
  }
  return lines.join('\n');
}

/** Pulls a suggestions array out of raw AI response text — the same
 * three-candidate strategy as io/aiGenerateDesign.js#extractProjectJSON
 * (direct JSON.parse, a ```json fenced block, then the first-`[`-to-
 * last-`]` substring), but for a JSON *array* of suggestion objects
 * rather than a single project object. Never throws; drops malformed
 * entries instead of failing the whole batch, and defaults an
 * unrecognized/missing category to "improvement" so a slightly-off AI
 * response still renders instead of being discarded whole. */
export function extractSuggestionsArray(text) {
  if (!text || !text.trim()) return { ok: false, error: "There's no response text to read yet." };

  const candidates = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = text.indexOf('[');
  const last = text.lastIndexOf(']');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!Array.isArray(parsed)) continue;
      const items = parsed
        .filter((item) => item && typeof item.title === 'string' && item.title.trim())
        .map((item) => ({
          category: SUGGESTION_CATEGORIES.includes(item.category) ? item.category : 'improvement',
          title: item.title.trim(),
          detail: typeof item.detail === 'string' ? item.detail.trim() : '',
        }));
      if (items.length) return { ok: true, data: items };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, error: "Couldn't find a valid suggestions list in that text — make sure you copied the AI's whole reply." };
}

const SECURITY_SEVERITIES = ['high', 'medium', 'low'];

/** A focused variant of Suggestions above, asking specifically about
 * security rather than general design improvements — public/internet
 * exposure, missing encryption, missing auth boundaries, no WAF/firewall
 * in front of a public endpoint, secrets handling, missing audit logging.
 * Same strict-JSON-array shape as buildSuggestionsPrompt (so the same
 * kind of parsing/rendering can apply), but tagged by severity rather
 * than category, and — unlike Suggestions — offered even in hand-off-only
 * setups: a security review is worth the copy/paste round trip the way
 * Review/Explain already are; only Suggestions' whole point requires
 * skipping it. */
export function buildSecurityPrompt({ projectName, nodeCount, edgeCount, componentNames = [], specText = '', hasSequenceDiagram = false }) {
  const lines = [];
  lines.push(`Here is a ${hasSequenceDiagram ? 'sequence/communication-flow' : 'system design / architecture'} diagram titled "${projectName || 'Untitled Diagram'}" (a diagram image may also be attached to this message — use it if present).`);
  lines.push(`It has ${nodeCount} component${nodeCount === 1 ? '' : 's'} and ${edgeCount} connector${edgeCount === 1 ? '' : 's'}.`);
  if (componentNames.length) {
    lines.push(`Components: ${componentNames.join(', ')}.`);
  }
  lines.push('');
  lines.push('Act as a security reviewer. Respond with ONLY a JSON array (no prose before or after, no markdown code fence) of 3 to 10 objects, each shaped exactly like:');
  lines.push('{"severity": "high", "title": "short label", "detail": "one or two plain sentences, ending with a concrete recommendation"}');
  lines.push('');
  lines.push('Use "high"/"medium"/"low" for severity. Focus specifically on security, not general design advice:');
  lines.push('- Components exposed directly to the public internet with no gateway, firewall, or WAF in front of them.');
  lines.push('- Missing encryption at rest or in transit where sensitive data is implied.');
  lines.push('- Missing or unclear authentication/authorization boundaries between components.');
  lines.push('- Secrets/credentials handling (hardcoded-looking config, no secrets manager where one is implied).');
  lines.push('- Missing audit logging or monitoring on security-relevant paths.');
  lines.push("Only report what this specific diagram's components and structure actually suggest — don't pad the list with generic security advice that doesn't apply here.");
  if (specText.trim()) {
    lines.push('');
    lines.push('Also weigh this product/requirements spec for any security-relevant requirement (compliance, data sensitivity) the diagram may not be meeting:');
    lines.push('--- SPEC START ---');
    lines.push(specText.trim().slice(0, SPEC_TEXT_LIMIT));
    lines.push('--- SPEC END ---');
  }
  return lines.join('\n');
}

/** Same three-candidate parsing strategy as extractSuggestionsArray, for
 * buildSecurityPrompt's `{severity, title, detail}` shape instead of
 * `{category, title, detail}` — kept as its own function rather than a
 * parameterized shared one since the two field names/valid-value sets
 * differ and a shared version would need to take both as parameters
 * anyway, adding a layer of indirection for two ~20-line functions. */
export function extractSecurityFindings(text) {
  if (!text || !text.trim()) return { ok: false, error: "There's no response text to read yet." };

  const candidates = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = text.indexOf('[');
  const last = text.lastIndexOf(']');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!Array.isArray(parsed)) continue;
      const items = parsed
        .filter((item) => item && typeof item.title === 'string' && item.title.trim())
        .map((item) => ({
          severity: SECURITY_SEVERITIES.includes(item.severity) ? item.severity : 'medium',
          title: item.title.trim(),
          detail: typeof item.detail === 'string' ? item.detail.trim() : '',
        }));
      if (items.length) return { ok: true, data: items };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, error: "Couldn't find a valid findings list in that text — make sure you copied the AI's whole reply." };
}

/** Same "prepare & hand off" shape as buildReviewPrompt above (see this
 * file's header comment for why), but asking for a plain-language summary
 * instead of a critique — for someone who wants to understand what a
 * diagram represents (onboarding a new team member, documenting a design,
 * or just checking a generated/imported diagram reads the way you meant)
 * rather than get feedback on it. */
export function buildExplainPrompt({ projectName, nodeCount, edgeCount, componentNames = [], specText = '', hasSequenceDiagram = false }) {
  const lines = [];
  if (hasSequenceDiagram) {
    lines.push(`Please explain this sequence/communication-flow diagram (attached as an image), titled "${projectName || 'Untitled Diagram'}" — vertical lifelines per participant, with numbered messages between them in top-to-bottom time order.`);
  } else {
    lines.push(`Please explain this system design / architecture diagram (attached as an image), titled "${projectName || 'Untitled Diagram'}".`);
  }
  lines.push(`It has ${nodeCount} component${nodeCount === 1 ? '' : 's'} and ${edgeCount} connector${edgeCount === 1 ? '' : 's'}.`);
  if (componentNames.length) {
    lines.push(`Components: ${componentNames.join(', ')}.`);
  }
  lines.push('');
  if (hasSequenceDiagram) {
    lines.push('Write a plain-language walkthrough for someone unfamiliar with this flow. Please:');
    lines.push('1. Describe the overall interaction in one or two sentences — what triggers it, and what the end result is.');
    lines.push("2. Walk through the numbered messages in order, explaining what's happening and why at each step, in everyday language rather than restating the labels.");
    lines.push("3. Call out any participant whose role isn't obvious from its name.");
  } else {
    lines.push('Write a plain-language explanation for someone unfamiliar with this system. Please:');
    lines.push('1. Describe what the system does and who/what it serves, in one or two sentences.');
    lines.push('2. Walk through the major components and how data/requests flow between them, grouped by area if that helps (e.g. "the request path", "the data layer").');
    lines.push("3. Call out any component whose role isn't obvious from its name.");
  }
  lines.push('4. Keep it to plain language a non-specialist stakeholder could follow — save critique/recommendations for a separate review, this is purely "what is this and how does it work".');
  if (specText.trim()) {
    lines.push('');
    lines.push('For context, here is the product/requirements spec this diagram is meant to implement — feel free to reference it, but the explanation should describe the diagram itself:');
    lines.push('--- SPEC START ---');
    lines.push(specText.trim().slice(0, SPEC_TEXT_LIMIT));
    lines.push('--- SPEC END ---');
  }
  lines.push('');
  lines.push("(I'm attaching the diagram as an image in this same message — let me know if it didn't come through.)");
  return lines.join('\n');
}
