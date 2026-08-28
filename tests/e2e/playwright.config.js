import { defineConfig, devices } from '@playwright/test';
import { APP_VERSION } from '../../js/version.js';

// A fresh Playwright browser context starts with literally empty
// localStorage — indistinguishable, by io/firstVisitDefaults.js's own
// "nothing at all in storage" check, from a real brand-new visitor. Every
// test in this suite predating the Basic/Advanced/Custom feature-level
// system (core/featureLevels.js) was written assuming the toolbar's full,
// pre-existing button set is visible, so without this default `storageState`
// every one of them would silently start in simplified "Basic" mode instead
// and fail to find whatever Tools/Create button it goes looking for.
//
// Pre-seeding just the one-time "already decided" flag neutralizes that
// bootstrap entirely — io/featureLevelPrefs.js's own pure fallback default
// is 'advanced' (show everything) anyway. But seeding *any* key at all also
// changes what io/whatsNew.js's own, unrelated "brand-new visitor" check
// sees: `listKeysWithPrefix('').length === 0` was true against a truly
// empty browser, so every test used to correctly get `show: false` from
// checkWhatsNew() — once this config seeds one key, that's no longer empty,
// and checkWhatsNew() instead reads it as "a returning visitor with prior
// data but no tracked version" and pops the blocking "What's New" `<dialog>`
// in front of everything, which is exactly what broke this whole suite the
// first time this config was added (every test's `dismissHints` helper
// timed out clicking a hint bubble covered by that dialog). So
// `lastSeenVersion` has to be seeded too, to the current version, so
// checkWhatsNew() also sees "already up to date" — same "treat the test
// environment as a settled returning visitor across every such feature"
// intent as the firstVisitDefaultsApplied flag above, just for a second,
// unrelated onboarding mechanism this batch didn't touch but still
// shares the same signal.
//
// Tests that specifically exercise first-visit behavior (basic mode,
// compact sidebar, the progressive-unlock suggestion banner) override this
// back to empty with their own `test.use({ storageState: ... })` — see
// tests/e2e/featureLevels.spec.js.
const RETURNING_VISITOR_STORAGE_STATE = {
  cookies: [],
  origins: [
    {
      origin: 'http://localhost:4173',
      localStorage: [
        { name: 'sdb:v1:firstVisitDefaultsApplied', value: 'true' },
        { name: 'sdb:v1:lastSeenVersion', value: JSON.stringify(APP_VERSION) },
      ],
    },
  ],
};

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    storageState: RETURNING_VISITOR_STORAGE_STATE,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'python3 -m http.server 4173',
    cwd: '../../',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
