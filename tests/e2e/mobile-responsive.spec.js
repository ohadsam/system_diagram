import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

// Regression coverage for two real mobile-layout bugs found by direct DOM
// measurement (not visual guessing — see docs/AI_AGENT_GUIDE.md "Common
// pitfalls" for why fullPage screenshots misled the first investigation):
// (1) a toolbar group with several full-text buttons didn't wrap and forced
// the whole page into horizontal scroll; (2) the sidebar/details/AI-review
// drawers used position:fixed with a hardcoded top offset that assumed a
// single-row toolbar, so once the toolbar wrapped onto multiple rows (which
// happens well before the 900px breakpoint) the drawer rendered starting
// partway *through* the toolbar instead of below it.

async function scrollWidthInfo(page) {
  return page.evaluate(() => ({ inner: window.innerWidth, scroll: document.documentElement.scrollWidth }));
}

// On a mobile-width viewport the sidebar is a closed, off-screen drawer by
// default — addComponentByName()'s search box lives inside it, so it must
// be opened first here (unlike on desktop, where the sidebar is always
// visible and addComponentByName() works as-is).
async function addComponentOnMobile(page, name) {
  await page.locator('.sidebar-toggle-btn').click();
  await addComponentByName(page, name);
}

test.describe('mobile viewport (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await dismissHints(page);
  });

  test('the toolbar never forces horizontal page scroll, even with every button group present', async ({ page }) => {
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  test('the toolbar still does not overflow once a component is selected (context row showing)', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    await page.locator('.node').first().click();
    await expect(page.locator('.toolbar-row-context')).toBeVisible();
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  test('the sidebar drawer renders fully below the toolbar, not overlapping it', async ({ page }) => {
    await page.locator('.sidebar-toggle-btn').click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    const rects = await page.evaluate(() => {
      const toolbar = document.getElementById('toolbar').getBoundingClientRect();
      const sidebar = document.getElementById('sidebar').getBoundingClientRect();
      return { toolbarBottom: toolbar.bottom, sidebarTop: sidebar.top, sidebarWidth: sidebar.width };
    });
    expect(rects.sidebarTop).toBeGreaterThanOrEqual(rects.toolbarBottom - 1); // -1: subpixel rounding tolerance
    expect(rects.sidebarWidth).toBeGreaterThan(250); // should be its full min(85vw,320px) width, not squashed
  });

  test('the sidebar still opens below the toolbar even with the context row also showing', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    await page.locator('.node').first().click();
    await expect(page.locator('.toolbar-row-context')).toBeVisible();
    await page.locator('.sidebar-toggle-btn').click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    const rects = await page.evaluate(() => {
      const toolbar = document.getElementById('toolbar').getBoundingClientRect();
      const sidebar = document.getElementById('sidebar').getBoundingClientRect();
      return { toolbarBottom: toolbar.bottom, sidebarTop: sidebar.top };
    });
    expect(rects.sidebarTop).toBeGreaterThanOrEqual(rects.toolbarBottom - 1);
  });

  test('the details panel drawer renders fully below the toolbar, not overlapping it', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    await page.locator('.node-info-btn').click();
    await expect(page.locator('#details-panel')).toHaveClass(/open/);
    const rects = await page.evaluate(() => {
      const toolbar = document.getElementById('toolbar').getBoundingClientRect();
      const panel = document.getElementById('details-panel').getBoundingClientRect();
      return { toolbarBottom: toolbar.bottom, panelTop: panel.top };
    });
    expect(rects.panelTop).toBeGreaterThanOrEqual(rects.toolbarBottom - 1);
  });
});

test.describe('tablet viewport (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('no horizontal overflow at tablet width either', async ({ page }) => {
    await page.goto('/index.html');
    await dismissHints(page);
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });
});
