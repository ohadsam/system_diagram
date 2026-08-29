// "🖥️ Working with CLI" — answers the one question docs/AI_INTEGRATION.md
// itself can't: an AI CLI tool has no built-in way to discover *this*
// app's address on its own. There's no API, no registry, no DNS trick that
// hands a generic CLI tool a URL it was never told.
//
// A second, easy-to-miss gap sits right behind the first one: even once a
// CLI tool has the bare address, a plain domain doesn't tell it *which
// file* to read either. There's no universal browser-like convention that
// makes a CLI check `/llms.txt` on its own just because it was handed a
// URL — some newer tools might, most won't. So the reliable, primary thing
// this modal hands over is a ready-made **prompt that already names the
// exact file** (`<address>llms.txt`), not the bare address by itself —
// the address alone is offered too, but only as a secondary fallback for
// someone who wants to build their own request. This modal computes that
// address live from `window.location` (core/appUrl.js) rather than
// guessing it, so either way it's guaranteed correct.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { computeAppBaseUrl } from '../core/appUrl.js';
import { showToast } from '../utils/toast.js';

export function openCliSetupModal() {
  const baseUrl = computeAppBaseUrl(window.location.href);
  const isFileProtocol = window.location.protocol === 'file:';

  openModal({
    title: '🖥️ Working with CLI',
    className: 'cli-setup-modal',
    render: (body) => {
      body.appendChild(el('p', { class: 'modal-hint', text: "This app has no server and no API — an AI CLI tool (Claude Code, or any other) can't discover it on its own. A bare web address doesn't solve that by itself either: there's no standard way for a CLI to know it should check “/llms.txt” just because it was handed a domain. So give it the ready-made prompt below — it already names the exact file to fetch — and it can read this app's own integration guide and hand you back a diagram, all without you copying JSON by hand." }));

      if (isFileProtocol) {
        body.appendChild(el('p', { class: 'ai-edit-warning' }, [
          el('span', { text: "⚠️ You're opening this app directly from a local file — a CLI tool can't fetch a file:// address over the network. Serve this folder with a local web server (e.g. " }),
          el('code', { text: 'npx serve' }),
          el('span', { text: ' or ' }),
          el('code', { text: 'python3 -m http.server' }),
          el('span', { text: ') and use that server\'s own http://localhost address instead.' }),
        ]));
      }

      body.appendChild(el('h3', { class: 'modal-subheading', text: '1. Give your CLI tool this exact prompt' }));
      body.appendChild(el('p', { class: 'modal-hint', text: 'This is the reliable way to point a CLI tool here — it already spells out the specific file to fetch, not just a bare address it would have to guess a path for:' }));
      const promptArea = el('textarea', { class: 'ai-review-prompt cli-setup-prompt', rows: 3, readOnly: true });
      promptArea.value = `Read ${baseUrl}llms.txt (or ${baseUrl}docs/AI_INTEGRATION.md) and follow its instructions to build me a system design diagram for: <describe your system here>`;
      body.appendChild(promptArea);
      const promptActions = el('div', { class: 'field-row' });
      promptActions.appendChild(el('button', {
        type: 'button', class: 'btn btn-primary', text: '📋 Copy prompt',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(promptArea.value);
            showToast('Prompt copied to clipboard.', 'success', 1800);
          } catch {
            showToast('Could not copy automatically — select the text and copy it manually.', 'error');
          }
        },
      }));
      body.appendChild(promptActions);

      body.appendChild(el('h3', { class: 'modal-subheading', text: '2. Just need the bare address?' }));
      body.appendChild(el('p', { class: 'modal-hint', text: "For building your own request, or a CLI tool that already knows to check a domain's own llms.txt on its own — most don't, so prefer the prompt above unless you have a specific reason not to:" }));
      const urlRow = el('div', { class: 'field-row' });
      const urlField = el('input', { type: 'text', class: 'cli-setup-url', readOnly: true });
      urlField.value = baseUrl;
      urlRow.appendChild(urlField);
      urlRow.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary', text: '📋 Copy',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(baseUrl);
            showToast('Address copied to clipboard.', 'success', 1800);
          } catch {
            showToast('Could not copy automatically — select the text and copy it manually.', 'error');
          }
        },
      }));
      body.appendChild(urlRow);

      body.appendChild(el('h3', { class: 'modal-subheading', text: '3. Bring its reply back here' }));
      body.appendChild(el('p', { class: 'modal-hint' }, [
        el('span', { text: 'Once it hands you a diagram — a clickable share link, or JSON to paste — use ' }),
        el('strong', { text: '🧠 Generate Design from Spec' }),
        el('span', { text: ' or ' }),
        el('strong', { text: '🪄 AI Quick Start' }),
        el('span', { text: "'s last step (Create menu), or " }),
        el('strong', { text: '⬆️ Import JSON' }),
        el('span', { text: ' (File menu) for a saved file. Already have an ongoing conversation going? ' }),
        el('strong', { text: '🗨️ AI Conversation' }),
        el('span', { text: "'s prompt embeds the whole thing so the CLI stays aware of everything discussed so far, across as many rounds as you like — see its own guide section below for exactly how a CLI should reply to keep it going." }),
      ]));

      body.appendChild(el('h3', { class: 'modal-subheading', text: 'Full reference' }));
      const linksRow = el('div', { class: 'field-row' });
      linksRow.appendChild(el('button', { type: 'button', class: 'btn', text: '📄 Open AI_INTEGRATION.md', onClick: () => window.open('docs/AI_INTEGRATION.md', '_blank', 'noopener') }));
      linksRow.appendChild(el('button', { type: 'button', class: 'btn', text: '📄 Open llms.txt', onClick: () => window.open('llms.txt', '_blank', 'noopener') }));
      body.appendChild(linksRow);
    },
  });
}
