import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function selectFirstNode(page) {
  await page.locator('.node').first().click();
}

test('style preset buttons apply a full look in one click (fill, border, shadow)', async ({ page }) => {
  // Nginx Web Server has no shape override (defaults to 'rounded') — unlike
  // a database component (cylinder), which fakes its outline via
  // pseudo-elements and has no real .node-body border-color to assert on
  // (see css/node.css's own comment on that shape's `border: none !important`).
  await addComponentByName(page, 'Nginx Web Server');
  await selectFirstNode(page);

  await page.locator('.style-preset-row button', { hasText: 'Highlighted' }).click();
  const body = page.locator('.node-body').first();
  await expect(body).toHaveCSS('border-color', 'rgb(245, 158, 11)');
  await expect(body).toHaveCSS('background-color', 'rgb(254, 243, 199)');
  await expect(body).toHaveCSS('box-shadow', /rgba/); // dropShadow: true sets a real shadow, not "none"

  await page.locator('.style-preset-row button', { hasText: 'Deprecated' }).click();
  await expect(body).toHaveCSS('border-color', 'rgb(148, 163, 184)');
  await expect(body).toHaveCSS('opacity', '0.6');
});

test('corner radius field only shows for rect/rounded shapes', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await selectFirstNode(page);
  await expect(page.locator('input[data-focus-key="cornerRadius"]')).toBeVisible();

  // Anchored to the start: a plain 'Shape' substring match (case-insensitive)
  // also matches the Text Position field, whose own option labels include
  // "Above shape"/"Below shape".
  await page.locator('.field', { hasText: /^Shape/ }).locator('select').selectOption('circle');
  await expect(page.locator('input[data-focus-key="cornerRadius"]')).toBeHidden();

  await page.locator('.field', { hasText: /^Shape/ }).locator('select').selectOption('rect');
  await expect(page.locator('input[data-focus-key="cornerRadius"]')).toBeVisible();
});

test('setting corner radius changes the rendered border-radius', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await selectFirstNode(page);
  await page.locator('input[data-focus-key="cornerRadius"]').fill('30');
  await page.locator('input[data-focus-key="cornerRadius"]').dispatchEvent('input');
  await expect(page.locator('.node-body').first()).toHaveCSS('border-radius', '30px');
});

test('border style select changes the rendered border-style', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await selectFirstNode(page);
  await page.locator('.field', { hasText: 'Border style' }).locator('select').selectOption('dashed');
  await expect(page.locator('.node-body').first()).toHaveCSS('border-style', 'dashed');
});

test('drop shadow checkbox toggles a stronger box-shadow, without hiding the selection ring', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await selectFirstNode(page);
  const body = page.locator('.node-body').first();
  // `.node-body` has `transition: box-shadow 0.1s` (css/node.css) — poll via
  // toHaveCSS (auto-retrying) rather than a one-shot getComputedStyle() read,
  // which can catch a mid-transition frame right after the click.
  const baseline = await body.evaluate((el) => getComputedStyle(el).boxShadow);
  // The node is selected, so the baseline already includes the selection
  // ring (css/node.css's `.node.selected .node-body` rule) — asserting that
  // ring survives is exactly what catches the "inline box-shadow clobbers
  // the class-based ring" bug this test was written for.
  expect(baseline).toMatch(/79, 70, 229/);

  const checkbox = page.locator('.field-checkbox', { hasText: 'Drop shadow' }).locator('input[type="checkbox"]');
  await checkbox.check();
  await expect(async () => {
    const withShadow = await body.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(withShadow).not.toEqual(baseline);
    expect(withShadow).toMatch(/79, 70, 229/); // selection ring still present
  }).toPass();

  await checkbox.uncheck();
  await expect(async () => {
    const backToBaseline = await body.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(backToBaseline).toEqual(baseline);
  }).toPass();
});

test('opacity field changes the rendered opacity, independent of Focus Mode', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');
  await selectFirstNode(page);
  await page.locator('input[data-focus-key="opacity"]').fill('50');
  await page.locator('input[data-focus-key="opacity"]').dispatchEvent('input');
  await expect(page.locator('.node-body').first()).toHaveCSS('opacity', '0.5');
});

test('size preset buttons set width and height together', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');
  await selectFirstNode(page);
  await page.locator('.style-size-preset-row button', { hasText: 'L' }).click();
  await expect(page.locator('input[data-focus-key="w"]')).toHaveValue('220');
  await expect(page.locator('input[data-focus-key="h"]')).toHaveValue('120');
});

test('applying a style preset to a multi-selection updates every selected node in one undo step', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await page.mouse.click(600, 300); // deselect, so the next add doesn't land on top of the first
  await addComponentByName(page, 'RabbitMQ');
  await page.locator('.canvas-viewport').click({ position: { x: 50, y: 50 } }); // deselect before marquee/ctrl-click
  const nodes = page.locator('.node');
  await nodes.nth(0).click();
  await nodes.nth(1).click({ modifiers: ['Control'] });
  await expect(page.locator('.toolbar-selection-count')).toHaveText('2 selected');

  await page.locator('.style-preset-row button', { hasText: 'Primary' }).click();
  await expect(page.locator('.node-body').nth(0)).toHaveCSS('border-color', 'rgb(79, 70, 229)');
  await expect(page.locator('.node-body').nth(1)).toHaveCSS('border-color', 'rgb(79, 70, 229)');

  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.node-body').nth(0)).not.toHaveCSS('border-color', 'rgb(79, 70, 229)');
});
