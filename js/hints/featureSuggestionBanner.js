// A small, dismissible progressive-unlock nudge — separate from both the
// sequential coach-mark hints (hints.js) and the "getting started"
// checklist (onboardingChecklistWidget.js): those cover *this app's UI*,
// while this is specifically about someone who started in Basic mode
// (core/featureLevels.js) and has now used the app enough sessions that
// they might want to see what's hidden. Fires at most once per session,
// at most once per milestone ever (see io/usageStats.js), and never once
// dismissed forever.
import { el } from '../utils/dom.js';
import { getDueSuggestionMilestone } from '../core/featureLevels.js';
import { getUsageStats, markSuggestionShown, dismissSuggestionForever } from '../io/usageStats.js';
import { getFeatureLevelPrefs } from '../io/featureLevelPrefs.js';
import { openDefaultSettingsModal } from '../modals/defaultSettingsModal.js';

export function maybeShowFeatureSuggestionBanner() {
  const prefs = getFeatureLevelPrefs();
  const stats = getUsageStats();
  const milestone = getDueSuggestionMilestone({
    featureMode: prefs.featureMode,
    sessionCount: stats.sessionCount,
    suggestionsShownAtSessions: stats.suggestionsShownAtSessions,
    suggestionDismissedForever: stats.suggestionDismissedForever,
  });
  if (milestone === null) return;
  // Recorded the instant it's shown, not on dismiss — so a milestone never
  // fires twice even if the tab closes before any button is clicked.
  markSuggestionShown(milestone);
  showBanner();
}

function showBanner() {
  const card = el('div', { class: 'feature-suggestion-banner' });
  card.appendChild(el('button', {
    type: 'button', class: 'feature-suggestion-close', 'aria-label': 'Dismiss', title: 'Dismiss',
    text: '✕',
    onClick: () => card.remove(),
  }));
  card.appendChild(el('p', { class: 'feature-suggestion-text', text: '🧩 Getting comfortable here? This app has a lot more tools available — AI helpers, diagram-specific wizards, analysis and more — currently hidden by your "Basic" feature level.' }));
  const actions = el('div', { class: 'feature-suggestion-actions' });
  actions.appendChild(el('button', {
    type: 'button', class: 'btn-link', text: "Don't ask again",
    onClick: () => { dismissSuggestionForever(); card.remove(); },
  }));
  actions.appendChild(el('button', { type: 'button', class: 'btn-link', text: 'Not now', onClick: () => card.remove() }));
  actions.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary btn-sm', text: '⚙️ Show me',
    onClick: () => { card.remove(); openDefaultSettingsModal({ scrollToFeatureLevel: true }); },
  }));
  card.appendChild(actions);
  document.body.appendChild(card);
}
