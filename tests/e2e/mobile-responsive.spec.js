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

  // The contextual style-editor row's field grid can otherwise take up
  // most of a 390px-tall viewport (see docs/ARCHITECTURE.md "Contextual
  // style-editor row") — collapsing it via the header's › toggle should
  // free up most of that space for the canvas underneath.
  test('collapsing the contextual row on mobile frees up most of the canvas height', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    await page.locator('.node').first().click();
    const expandedHeight = await page.locator('.toolbar-row-context').evaluate((elRef) => elRef.getBoundingClientRect().height);

    await page.locator('.toolbar-context-collapse-toggle').click();
    const collapsedHeight = await page.locator('.toolbar-row-context').evaluate((elRef) => elRef.getBoundingClientRect().height);

    expect(collapsedHeight).toBeLessThan(expandedHeight * 0.3);
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  // Regression: the contextual row header's selection-summary text is
  // `white-space: nowrap` + `text-overflow: ellipsis`, but a flex item's
  // default `min-width: auto` refuses to shrink below its content's
  // intrinsic width, silently defeating that ellipsis — both the summary
  // span itself AND its `.toolbar-context-header` parent (also a flex
  // item, stretched cross-axis by the column-direction `.toolbar-row-
  // context`) need an explicit `min-width: 0`. A long component name
  // pushed the whole row wider than the viewport before this was fixed.
  test('a long component name truncates in the contextual row header instead of overflowing', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    const label = page.locator('.node-label').first();
    await label.click();
    await label.dblclick();
    await page.locator('.inline-edit-input').fill('A Very Long Component Name That Should Truncate Nicely In The Header');
    await page.locator('.inline-edit-input').press('Enter');

    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
    const summaryWidth = await page.locator('.toolbar-context-summary').evaluate((elRef) => elRef.getBoundingClientRect().width);
    expect(summaryWidth).toBeLessThan(390);
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

  // Regression: a toolbar dropdown panel (js/toolbar/toolbarDropdown.js)
  // positioned with CSS `position: absolute; left: 0` relative to its
  // trigger could render partly off the right edge of a narrow viewport
  // once the toolbar wrapped its trigger onto a row where it sits further
  // right than the panel is wide — fixed by positioning with `position:
  // fixed` and JS-computed, viewport-clamped coordinates instead (same
  // approach as canvas/contextMenu.js).
  test('every toolbar dropdown panel stays fully within the viewport', async ({ page }) => {
    for (const label of ['File', 'Create', 'Tools', 'Help']) {
      await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: label }).click();
      const rect = await page.evaluate((lbl) => {
        const trigger = [...document.querySelectorAll('.toolbar-dropdown-trigger')].find((b) => b.textContent.includes(lbl));
        return trigger.parentElement.querySelector('.toolbar-dropdown-panel').getBoundingClientRect();
      }, label);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(390);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(844);
      await page.keyboard.press('Escape');
    }
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  // Regression: #canvas-viewport had no `touch-action` set, so a
  // single-finger touch-drag pan (canvas.js#beginPan, driven entirely by
  // pointer events) could be arbitrated by the browser as a native
  // scroll/pan gesture running in parallel with the JS `transform`-based
  // pan — the two fighting over the same GPU-composited layer is a known
  // cause of content flickering/vanishing mid-gesture on mobile Chrome/
  // Safari. `touch-action: none` is the fix; this locks in that it stays
  // set (see css/canvas.css for the full explanation).
  test('the canvas viewport opts out of native touch gestures so the custom pan/drag owns them', async ({ page }) => {
    const touchAction = await page.locator('#canvas-viewport').evaluate((el) => getComputedStyle(el).touchAction);
    expect(touchAction).toBe('none');
  });

  test('the canvas search box does not force horizontal overflow at mobile width', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    await page.locator('.toolbar-canvas-search input').fill('Redis');
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  test('the project tab strip does not force horizontal overflow once 2 tabs are open', async ({ page }) => {
    await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'File' }).click();
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Open in New Tab' }).click();
    await page.locator('.add-tab-modal button', { hasText: '🆕 New blank diagram' }).click();
    await expect(page.locator('.project-tab')).toHaveCount(2);
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  test('the Outline panel opens as a slide-over drawer without horizontal overflow', async ({ page }) => {
    await addComponentOnMobile(page, 'Redis');
    await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'Tools' }).click();
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Outline' }).click();
    await expect(page.locator('#outline-panel')).toHaveClass(/open/);
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
  });

  test('Presenter Mode hides the toolbar/sidebar without leaving any horizontal overflow behind', async ({ page }) => {
    await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'Tools' }).click();
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Presenter Mode' }).click();
    await expect(page.locator('.kiosk-exit-btn')).toBeVisible();
    const info = await scrollWidthInfo(page);
    expect(info.scroll).toBeLessThanOrEqual(info.inner);
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
