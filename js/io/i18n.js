// Minimal, curated localization for the app's own chrome — the toolbar
// dropdown group labels, undo/redo/select/hand-tool labels, the sidebar
// search box, and the "Cancel" button shared by every confirm/dismiss
// dialog (`modals/confirmModal.js`). Deliberately NOT a full deep translation:
// the ~200 predefined component names/descriptions (js/data/categories/*)
// and help.html are a much larger, separate content-translation project
// and stay in English regardless of the chosen language — see
// io/uiPrefs.js#DEFAULT_UI_PREFS's `language` field comment.
//
// `dir` (ltr/rtl) is applied to <html> alongside `lang`, which is enough to
// get most of the layout mirroring for free: flexbox's `row` axis is
// direction-aware by spec, so a `direction: rtl` ancestor already reverses
// most toolbar/sidebar/modal flex layouts without any CSS of our own. The
// exceptions — fixed/absolute-positioned chrome using literal `left`/
// `right` (the sidebar drawer, floating buttons, toasts) — get explicit
// `[dir="rtl"]` overrides in their own CSS files.
import { getUiPrefs, saveUiPrefs, onUiPrefsChange, LANGUAGES } from './uiPrefs.js';

export const RTL_LANGUAGES = ['he'];

const STRINGS = {
  en: {
    'toolbar.file': 'File',
    'toolbar.file.title': 'File: new, save, load, duplicate, import/export, backup',
    'toolbar.create': 'Create',
    'toolbar.create.title': 'Create: custom component, generated design, replication, defaults',
    'toolbar.tools': 'Tools',
    'toolbar.tools.title': 'Tools: grid, AI Design Review',
    'toolbar.help': 'Help',
    'toolbar.help.title': "Help: user guide, hints, what's new",
    'toolbar.undo': 'Undo',
    'toolbar.redo': 'Redo',
    'toolbar.selectTool': 'Select tool',
    'toolbar.handTool': 'Hand tool',
    'toolbar.language': 'Language',
    'sidebar.search.placeholder': 'Search components…',
    'sidebar.popularOnly': 'Popular only',
    'common.cancel': 'Cancel',
  },
  he: {
    'toolbar.file': 'קובץ',
    'toolbar.file.title': 'קובץ: חדש, שמירה, טעינה, ייצוא/ייבוא, גיבוי',
    'toolbar.create': 'יצירה',
    'toolbar.create.title': 'יצירה: רכיב מותאם אישית, עיצוב שנוצר, שכפול, ברירות מחדל',
    'toolbar.tools': 'כלים',
    'toolbar.tools.title': 'כלים: רשת, סקירת AI',
    'toolbar.help': 'עזרה',
    'toolbar.help.title': 'עזרה: מדריך למשתמש, טיפים, מה חדש',
    'toolbar.undo': 'בטל',
    'toolbar.redo': 'בצע שוב',
    'toolbar.selectTool': 'כלי בחירה',
    'toolbar.handTool': 'כלי יד (הזזה)',
    'toolbar.search.placeholder': 'חיפוש בלוח...',
    'toolbar.language': 'שפה',
    'sidebar.search.placeholder': 'חיפוש רכיבים...',
    'sidebar.popularOnly': 'פופולריים בלבד',
    'common.cancel': 'ביטול',
  },
};

const listeners = new Set();

export function getLanguage() {
  return getUiPrefs().language;
}

export function isRtl(lang = getLanguage()) {
  return RTL_LANGUAGES.includes(lang);
}

/** Translates `key` for the current language, falling back to English and
 * then to the key itself — never throws, never renders blank chrome over a
 * lookup miss (e.g. a key added to one language's table but not the
 * other's, or a stale key from an older build). */
export function t(key) {
  const lang = getLanguage();
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}

export function setLanguage(lang) {
  if (!LANGUAGES.includes(lang)) return;
  saveUiPrefs({ language: lang });
}

/** Applies `lang`/`dir` to <html> — call once at startup and again on every
 * change (io/uiPrefs.js#onUiPrefsChange already fires for this, same as
 * every other persisted UI preference). */
export function applyLanguageToDocument(lang = getLanguage()) {
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
}

/** Fires on every language change — callers rebuild whatever text they
 * rendered with `t()` (see toolbar.js), same "listen once wherever you last
 * used a still-live value" contract onUiPrefsChange already establishes. */
export function onLanguageChange(fn) {
  const wrapped = (prefs) => fn(prefs.language);
  return onUiPrefsChange(wrapped);
}

applyLanguageToDocument();
onUiPrefsChange((prefs) => applyLanguageToDocument(prefs.language));
