// Parses Mermaid `sequenceDiagram` text back into an intermediate,
// DOM-free structure that canvas.js#createSequenceDiagramFromMermaid then
// turns into real lifeline nodes + message edges (+ activations, destroy
// markers, and alt/opt/loop/par fragment boxes). The inverse of
// io/exportSequenceMermaid.js — best-effort, not a guaranteed round-trip:
// Mermaid supports constructs this app doesn't (nested `alt`/`else`
// branches, `Note over`, `box` groupings, loops around a single
// participant) which are read but reduced to what the app *can* represent,
// same spirit as the export side's own "best-effort" comment.
function arrowStyle(token) {
  if (token === '->>' || token === '->') return 'sync';
  if (token === '-)' || token === '--)') return 'async';
  return 'return'; // -->>, -->, -x, --x
}

const FRAGMENT_KEYWORDS = new Set(['alt', 'opt', 'loop', 'par', 'critical', 'break']);

/**
 * @param {string} text raw pasted Mermaid source
 * @returns {{participants: {id:string, label:string}[], events: object[]}|null}
 *   null if no participants and no messages were found anywhere in the text
 *   (nothing worth creating a diagram from).
 */
export function parseSequenceMermaid(text) {
  const participants = [];
  const byId = new Map();
  const events = [];

  const ensureParticipant = (id, label) => {
    if (byId.has(id)) return byId.get(id);
    const p = { id, label: label || id };
    byId.set(id, p);
    participants.push(p);
    return p;
  };

  const lines = String(text ?? '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^sequenceDiagram\b/i.test(line)) continue;
    if (/^title\b/i.test(line) || /^autonumber\b/i.test(line)) continue;
    if (/^(else|and)\b/i.test(line)) continue; // no branch-divider concept here — see file header

    let m;
    if ((m = line.match(/^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i))) {
      ensureParticipant(m[2], m[3]?.trim());
      continue;
    }
    if ((m = line.match(/^activate\s+(\S+)$/i))) {
      events.push({ kind: 'activate', id: ensureParticipant(m[1]).id });
      continue;
    }
    if ((m = line.match(/^deactivate\s+(\S+)$/i))) {
      events.push({ kind: 'deactivate', id: ensureParticipant(m[1]).id });
      continue;
    }
    if ((m = line.match(/^destroy\s+(\S+)$/i))) {
      events.push({ kind: 'destroy', id: ensureParticipant(m[1]).id });
      continue;
    }
    if ((m = line.match(/^(alt|opt|loop|par|critical|break)\b\s*(.*)$/i))) {
      const type = m[1].toLowerCase();
      if (FRAGMENT_KEYWORDS.has(type)) {
        events.push({ kind: 'fragmentStart', type, label: m[2]?.trim() || '' });
        continue;
      }
    }
    if (/^end$/i.test(line)) {
      events.push({ kind: 'fragmentEnd' });
      continue;
    }
    // Message: "A->>B: some text", "A-)B+: text" (activation shorthand
    // +/- suffixes on the participant token are stripped, not modeled).
    if ((m = line.match(/^(\S+?)\s*(-->>|--x|--\)|->>|-x|-\)|-->|->)\s*(\S+?)\+?\s*:\s*(.*)$/))) {
      const fromId = m[1].replace(/[+-]$/, '');
      const toId = m[3].replace(/[+-]$/, '');
      events.push({
        kind: 'message',
        from: ensureParticipant(fromId).id,
        to: ensureParticipant(toId).id,
        label: m[4]?.trim() || '',
        style: arrowStyle(m[2]),
      });
    }
  }

  if (!participants.length) return null;
  return { participants, events };
}
