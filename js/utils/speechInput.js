// Voice dictation for a text field — a thin wrapper over the browser's
// native SpeechRecognition API (no library, no server: this is the
// browser doing the transcription itself, same "runs entirely on-device"
// spirit as Local AI mode, just via a different Web API). DOM-touching
// (creates real elements, drives a real textarea), so — like hints.js and
// every other DOM-only module in this app — it gets e2e coverage rather
// than a node:test unit test; see tests/unit/storage.test.mjs's header
// comment for why that split exists.
import { el } from './dom.js';
import { showToast } from './toast.js';

export function isSpeechRecognitionSupported() {
  return typeof (window.SpeechRecognition || window.webkitSpeechRecognition) === 'function';
}

/**
 * Wraps `textarea` with a floating 🎙️ mic button that appends dictated
 * text to whatever's already there (never replaces it), dispatching a real
 * `input` event afterward so every existing `onInput` handler on the
 * textarea fires exactly as if the user had typed it. Returns a wrapper
 * element to append in the textarea's place — or the bare `textarea`
 * itself, unchanged, when the browser has no SpeechRecognition support at
 * all, so every call site can do `body.appendChild(attachSpeechToTextarea(textarea))`
 * unconditionally without an extra feature-detection branch of its own.
 */
export function attachSpeechToTextarea(textarea, { lang } = {}) {
  if (!isSpeechRecognitionSupported()) return textarea;

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let recognizing = false;

  const button = el('button', {
    type: 'button',
    class: 'speech-input-btn',
    title: 'Dictate by voice',
    'aria-label': 'Dictate by voice',
    text: '🎙️',
    onClick: () => {
      if (recognizing) { recognition?.stop(); return; }
      recognition = new Recognition();
      recognition.lang = lang || document.documentElement.lang || 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        recognizing = true;
        button.classList.add('speech-input-recording');
        button.title = 'Listening… click to stop';
      };
      recognition.onerror = () => {
        showToast('Voice dictation failed — check microphone permission and try again.', 'error');
      };
      recognition.onend = () => {
        recognizing = false;
        button.classList.remove('speech-input-recording');
        button.title = 'Dictate by voice';
      };
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results).map((r) => r[0].transcript).join(' ').trim();
        if (!transcript) return;
        const needsSpace = textarea.value && !/[\s\n]$/.test(textarea.value);
        textarea.value += (needsSpace ? ' ' : '') + transcript;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      };
      recognition.start();
    },
  });

  return el('div', { class: 'speech-input-wrap' }, [textarea, button]);
}
