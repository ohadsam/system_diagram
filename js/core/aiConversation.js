// "🗨️ AI Conversation" — a multi-turn companion to io/aiEditDesign.js's
// one-shot "Edit with AI": same prepare/hand-off/paste-back mechanism (see
// docs/SPEC.md 4.12/4.13 for why — no mainstream LLM offers key-free API
// access from a static page), but this module additionally threads the
// FULL prior transcript into every prompt it builds.
//
// That's the only honest way a stateless AI — a browser chat tab, or an AI
// CLI tool run fresh each time from a terminal — can stay "aware" of
// everything already discussed: this app has no server to push a live
// message to a running process, so instead every message this app hands
// the AI already contains everything it would otherwise need to remember.
// See docs/AI_INTEGRATION.md's "Continuing the Conversation" section for
// the externally-facing version of this same protocol, written for an AI
// CLI tool reading cold rather than for this app's own code.
import { nextId } from './id.js';
import { extractPatchJSON, normalizePatch, summarizeCurrentProject, buildPatchRules, EXAMPLE_PATCH_JSON } from '../io/aiEditDesign.js';

const MESSAGE_LIMIT = 4000;
const PROJECT_JSON_LIMIT = 20000;
// Keeps a very long-running conversation's prompt from growing without
// bound — only the most recent turns are replayed verbatim; the diagram's
// own *current* state (always attached in full below) is what actually
// matters for continuity, not every early message once a design has moved
// well past them.
const MAX_TRANSCRIPT_TURNS_IN_PROMPT = 20;

/** One entry in a conversation — either the human's own message or the
 * AI's reply. `patchApplied` is purely a transcript-display flag (was a
 * diagram update accepted from this specific AI turn?), not the update
 * itself — the update always comes from the *current* live project, which
 * is re-attached fresh on every subsequent prompt, so there's nothing to
 * gain (and real localStorage bloat to risk) from also freezing a copy of
 * the diagram inside every single turn. */
export function createTurn(role, message, { patchApplied = false } = {}) {
  return {
    id: nextId('turn'),
    role, // 'user' | 'ai'
    message: (message || '').trim(),
    patchApplied,
    timestamp: new Date().toISOString(),
  };
}

/** Builds the next prompt to hand to an AI — everything discussed so far,
 * the diagram's current state, and the new message — so the reply can
 * continue the conversation with full context despite the AI itself never
 * having been "kept open" between turns. */
export function buildConversationPrompt({ turns = [], newMessage = '', project }) {
  const lines = [];
  lines.push("You're in an ongoing conversation about the system design diagram below, in System Design Diagram Builder's own JSON format. This app has no backend and can't keep a live connection to you open, so every message you receive (including this one) already contains the whole conversation so far and the diagram's current state — you don't need to remember anything between messages, and shouldn't assume you do.");
  lines.push('');

  const recentTurns = turns.slice(-MAX_TRANSCRIPT_TURNS_IN_PROMPT);
  if (recentTurns.length) {
    lines.push('--- CONVERSATION SO FAR ---');
    for (const turn of recentTurns) {
      const who = turn.role === 'ai' ? 'AI' : 'You (the user)';
      const suffix = turn.patchApplied ? ' (a diagram update from this reply was applied)' : '';
      lines.push(`[${who}]: ${turn.message}${suffix}`);
    }
    lines.push('--- END CONVERSATION ---');
    lines.push('');
  }

  lines.push("Here is the diagram's CURRENT state (a trimmed projection — some cosmetic fields are omitted; reflects any updates applied earlier in this conversation):");
  lines.push('```json');
  const currentJSON = summarizeCurrentProject(project);
  lines.push(currentJSON.length > PROJECT_JSON_LIMIT ? currentJSON.slice(0, PROJECT_JSON_LIMIT) + ' /* truncated */' : currentJSON);
  lines.push('```');
  lines.push('');
  lines.push('New message from the user:');
  lines.push('--- MESSAGE START ---');
  lines.push((newMessage || '').trim().slice(0, MESSAGE_LIMIT) || '(no message given — use your best judgement)');
  lines.push('--- MESSAGE END ---');
  lines.push('');
  lines.push("Reply with a short message continuing the conversation (this is what's shown to the user, so make it a real reply, not just a description of the JSON below).");
  lines.push('If your reply proposes a change to the diagram, ALSO include exactly one JSON code block — after your message, not instead of it — containing a PATCH object with exactly this shape (a real, complete example, not just a fragment):');
  lines.push('```json');
  lines.push(EXAMPLE_PATCH_JSON);
  lines.push('```');
  lines.push("If you're not proposing a diagram change (e.g. just answering a question), don't include a JSON block at all.");
  lines.push('');
  lines.push('Patch rules (only apply these if you do include one):');
  lines.push(...buildPatchRules());
  return lines.join('\n');
}

/**
 * Splits a raw AI reply into its plain-language message and (if present) a
 * patch. Never throws. The message is everything in the reply outside the
 * fenced ```json block, if any — this is what's shown as the AI's own
 * transcript turn, so a reply that's pure prose (no diagram change) still
 * renders naturally instead of showing an error.
 * @returns {{message: string, patch: object|null}}
 */
export function extractConversationReply(text) {
  const raw = (text || '').trim();
  if (!raw) return { message: '', patch: null };

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!fenced) return { message: raw, patch: null };

  const outsideFence = (raw.slice(0, fenced.index) + raw.slice(fenced.index + fenced[0].length)).trim();
  const extracted = extractPatchJSON(fenced[1]);
  const patch = extracted.ok ? normalizePatch(extracted.data) : null;
  // A reply that's purely a JSON block (no surrounding prose) still needs
  // *something* to show as its own transcript turn.
  const message = outsideFence || (patch ? '(proposed a diagram update — see below)' : raw);
  return { message, patch };
}
