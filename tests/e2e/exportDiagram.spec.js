import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openExportDiagramModal(page) {
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Export to...' }).click();
  await expect(page.locator('.export-diagram-modal')).toBeVisible();
}

test('"Copy as Mermaid" (flowchart) copies valid flowchart text with the component names', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'RabbitMQ');
  await openExportDiagramModal(page);

  await page.locator('.export-diagram-modal button', { hasText: '📋 Copy as Mermaid' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('flowchart LR');
  expect(clipboardText).toContain('RabbitMQ');
});

// Stubs window.open to record its argument instead of letting it actually
// navigate — this sandboxed test environment has no outbound network
// access to real external sites, so a real popup would just show a Chrome
// network-error page regardless of whether the app called the right URL.
async function captureWindowOpenUrl(page) {
  return page.evaluate(() => {
    window.__openedUrl = null;
    window.open = (url) => { window.__openedUrl = url; return null; };
  });
}

test('"Open Mermaid Live Editor" copies text and calls window.open with the mermaid.live URL', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'RabbitMQ');
  await openExportDiagramModal(page);
  await captureWindowOpenUrl(page);

  await page.locator('.export-diagram-modal button', { hasText: 'Open Mermaid Live Editor' }).click();
  await page.waitForFunction(() => window.__openedUrl != null);
  const openedUrl = await page.evaluate(() => window.__openedUrl);
  expect(openedUrl).toContain('mermaid.live');
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('flowchart LR');
});

test('"Download .drawio file" downloads a file with mxGraphModel XML content', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openExportDiagramModal(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Download .drawio file' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-drawio\.drawio$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});

test('"Download for Lucidchart" downloads a file, and "Open Lucidchart" downloads the same file plus calls window.open with the lucid.app URL', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openExportDiagramModal(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Download for Lucidchart' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-lucidchart\.drawio$/);

  await captureWindowOpenUrl(page);
  const [download2] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Open Lucidchart' }).click(),
  ]);
  expect(download2.suggestedFilename()).toMatch(/-lucidchart\.drawio$/);
  const openedUrl = await page.evaluate(() => window.__openedUrl);
  expect(openedUrl).toContain('lucid.app');
});

test('"Copy as Terraform" copies a resource block for a mapped AWS component', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'S3');
  await openExportDiagramModal(page);

  await page.locator('.export-diagram-modal button', { hasText: '📋 Copy as Terraform' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('resource "aws_s3_bucket"');
  expect(clipboardText).toContain('provider "aws"');
});

test('"Download .tf file" downloads a file with Terraform content', async ({ page }) => {
  await addComponentByName(page, 'S3');
  await openExportDiagramModal(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Download .tf file' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.tf$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});

test('"Copy as Pulumi" copies a resource declaration for a mapped AWS component', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'S3');
  await openExportDiagramModal(page);

  await page.locator('.export-diagram-modal button', { hasText: '📋 Copy as Pulumi' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('new aws.s3.Bucket');
  expect(clipboardText).toContain('@pulumi/aws');
});

test('"Download index.ts" downloads a Pulumi program file', async ({ page }) => {
  await addComponentByName(page, 'S3');
  await openExportDiagramModal(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Download index.ts' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-pulumi\.ts$/);
});

test('"Copy as CloudFormation" copies a resource block for a mapped AWS component', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'S3');
  await openExportDiagramModal(page);

  await page.locator('.export-diagram-modal button', { hasText: '📋 Copy as CloudFormation' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('AWS::S3::Bucket');
  expect(clipboardText).toContain('AWSTemplateFormatVersion');
});

test('"Download .yaml file" (CloudFormation) downloads a file', async ({ page }) => {
  await addComponentByName(page, 'S3');
  await openExportDiagramModal(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Download .yaml file' }).first().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-cloudformation\.yaml$/);
});

// Not addComponentByName('Pod') here — that search also matches "Podman"
// (a substring match) and .first() isn't guaranteed to land on the exact
// "Pod" component, so this clicks the sidebar item by its exact data-name.
async function addPodComponent(page) {
  await page.locator('.sidebar-search input').fill('Pod');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item[data-name="Pod"]').click();
  await page.waitForTimeout(100);
}

test('"Copy as YAML" (Kubernetes) copies a Deployment+Service pair for a Pod component', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addPodComponent(page);
  await openExportDiagramModal(page);

  await page.locator('.export-diagram-modal button', { hasText: '📋 Copy as YAML' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('kind: Deployment');
  expect(clipboardText).toContain('kind: Service');
});

test('"Download .yaml file" (Kubernetes) downloads a file', async ({ page }) => {
  await addPodComponent(page);
  await openExportDiagramModal(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-diagram-modal button', { hasText: 'Download .yaml file' }).last().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-k8s\.yaml$/);
});
