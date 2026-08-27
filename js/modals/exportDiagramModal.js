// "Export Diagram" — whole-canvas exports to external tools, alongside the
// existing JSON/PNG/PDF exports (io/fileIO.js, io/exportImage.js,
// io/exportPdf.js) and the sequence-diagram-only Mermaid/PlantUML exports
// (modals/subDiagramModal.js). Seven targets:
//   - Mermaid flowchart text (io/exportFlowchartMermaid.js) — copy + open
//     Mermaid Live Editor, same "copy then open the provider in a new tab"
//     pattern modals/generateDesignModal.js#openProvider already uses.
//   - draw.io / diagrams.net XML (io/exportDrawIO.js) — downloaded as a
//     .drawio file (draw.io only imports files, not pasted text).
//   - "Lucidchart-compatible" — the *same* draw.io XML, since Lucidchart's
//     own importer accepts draw.io files; there's no Lucidchart equivalent
//     of Mermaid Live's "open with content pre-loaded" URL scheme (it only
//     accepts file uploads), so this offers a download + a link to
//     Lucidchart itself rather than a direct pre-loaded editor link.
//   - Terraform / Pulumi / CloudFormation (io/exportTerraform.js,
//     io/exportPulumi.js, io/exportCloudFormation.js) — the same
//     best-effort, curated AWS-component-to-resource mapping in three
//     syntaxes; no "open provider" link for any of these three since
//     there's no equivalent web target. See exportTerraform.js's header
//     comment for the curation philosophy all three share.
//   - Kubernetes manifests (io/exportKubernetes.js) — deliberately the
//     narrowest of the four IaC exports: only the explicit "Pod" component
//     maps to a Deployment+Service pair, since a generic labeled box has no
//     unambiguous Kubernetes resource kind the way an AWS component does.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { buildFlowchartMermaid } from '../io/exportFlowchartMermaid.js';
import { buildDrawIOXml } from '../io/exportDrawIO.js';
import { buildTerraform } from '../io/exportTerraform.js';
import { buildPulumi } from '../io/exportPulumi.js';
import { buildCloudFormation } from '../io/exportCloudFormation.js';
import { buildKubernetesManifests } from '../io/exportKubernetes.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';
import { showToast } from '../utils/toast.js';

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    showToast('Could not copy automatically — select the text and copy it manually.', 'error');
    return false;
  }
}

function openInNewTab(url) {
  window.open(url, '_blank', 'noopener');
}

export function openExportDiagramModal() {
  openModal({
    title: 'Export Diagram',
    className: 'export-diagram-modal',
    render: (body) => {
      body.appendChild(el('p', { class: 'modal-hint', text: 'Send the whole diagram to another tool. Best-effort — each format has its own shape/style vocabulary, so this isn\'t always a lossless round-trip.' }));

      body.appendChild(buildSection({
        title: 'Mermaid Flowchart',
        description: 'A text-based diagram format — paste it into Mermaid Live Editor or anywhere else that renders Mermaid.',
        buttons: [
          { text: '📋 Copy as Mermaid', onClick: async () => {
            const state = store.getState();
            await copyToClipboard(buildFlowchartMermaid({ nodes: state.nodes, edges: state.edges }));
            showToast('Mermaid flowchart text copied to clipboard.', 'success', 2000);
          } },
          { text: '🔗 Open Mermaid Live Editor', onClick: async () => {
            const state = store.getState();
            const copied = await copyToClipboard(buildFlowchartMermaid({ nodes: state.nodes, edges: state.edges }));
            openInNewTab('https://mermaid.live/');
            if (copied) showToast('Copied — paste it into the editor that just opened.', 'success', 3000);
          } },
        ],
      }));

      body.appendChild(buildSection({
        title: 'draw.io / diagrams.net',
        description: 'Downloads a .drawio file — open it with File → Open File... in draw.io, or just drag it onto the canvas there.',
        buttons: [
          { text: '⬇️ Download .drawio file', onClick: () => downloadDrawIO('drawio') },
          { text: '🔗 Open draw.io', onClick: () => {
            downloadDrawIO('drawio');
            openInNewTab('https://app.diagrams.net/');
            showToast('File downloaded — use File → Open File... in the tab that just opened to load it.', 'success', 4000);
          } },
        ],
      }));

      body.appendChild(buildSection({
        title: 'Lucidchart',
        description: 'Lucidchart only imports files (it has no "open with pasted content" link like Mermaid Live) — downloads the same draw.io-format XML, which Lucidchart\'s own importer accepts.',
        buttons: [
          { text: '⬇️ Download for Lucidchart', onClick: () => downloadDrawIO('lucidchart') },
          { text: '🔗 Open Lucidchart', onClick: () => {
            downloadDrawIO('lucidchart');
            openInNewTab('https://lucid.app/');
            showToast('File downloaded — in Lucidchart, use File → Import to load it.', 'success', 4000);
          } },
        ],
      }));

      body.appendChild(buildSection({
        title: 'Terraform (AWS)',
        description: 'Best-effort resource skeleton for the AWS components on the canvas — a starting point for `terraform apply`, not a finished config. Only common AWS building blocks are mapped; anything else is listed in a comment instead of silently dropped.',
        buttons: [
          { text: '📋 Copy as Terraform', onClick: async () => {
            const state = store.getState();
            await copyToClipboard(buildTerraform(state.nodes, state.edges));
            showToast('Terraform skeleton copied to clipboard.', 'success', 2000);
          } },
          { text: '⬇️ Download .tf file', onClick: () => {
            const state = store.getState();
            const blob = new Blob([buildTerraform(state.nodes, state.edges)], { type: 'text/plain' });
            downloadBlob(blob, `${sanitizeFilename(state.name)}.tf`);
          } },
        ],
      }));

      body.appendChild(buildSection({
        title: 'Pulumi (AWS, TypeScript)',
        description: 'Same best-effort AWS mapping as Terraform above, as a Pulumi TypeScript program skeleton instead of HCL.',
        buttons: [
          { text: '📋 Copy as Pulumi', onClick: async () => {
            const state = store.getState();
            await copyToClipboard(buildPulumi(state.nodes, state.edges));
            showToast('Pulumi program skeleton copied to clipboard.', 'success', 2000);
          } },
          { text: '⬇️ Download index.ts', onClick: () => {
            const state = store.getState();
            const blob = new Blob([buildPulumi(state.nodes, state.edges)], { type: 'text/plain' });
            downloadBlob(blob, `${sanitizeFilename(state.name)}-pulumi.ts`);
          } },
        ],
      }));

      body.appendChild(buildSection({
        title: 'AWS CloudFormation',
        description: 'Same best-effort AWS mapping again, as a CloudFormation YAML template skeleton.',
        buttons: [
          { text: '📋 Copy as CloudFormation', onClick: async () => {
            const state = store.getState();
            await copyToClipboard(buildCloudFormation(state.nodes, state.edges));
            showToast('CloudFormation template copied to clipboard.', 'success', 2000);
          } },
          { text: '⬇️ Download .yaml file', onClick: () => {
            const state = store.getState();
            const blob = new Blob([buildCloudFormation(state.nodes, state.edges)], { type: 'text/yaml' });
            downloadBlob(blob, `${sanitizeFilename(state.name)}-cloudformation.yaml`);
          } },
        ],
      }));

      body.appendChild(buildSection({
        title: 'Kubernetes manifests',
        description: 'Narrower than the cloud-provider exports above: only a "Pod" component (Containers & Orchestration category) becomes a Deployment + Service pair — a generic labeled box could be a Deployment, a StatefulSet, a CronJob, or nothing at all, so this doesn\'t guess. Everything else recognized in that category is listed in a comment instead.',
        buttons: [
          { text: '📋 Copy as YAML', onClick: async () => {
            const state = store.getState();
            await copyToClipboard(buildKubernetesManifests(state.nodes));
            showToast('Kubernetes manifests copied to clipboard.', 'success', 2000);
          } },
          { text: '⬇️ Download .yaml file', onClick: () => {
            const state = store.getState();
            const blob = new Blob([buildKubernetesManifests(state.nodes)], { type: 'text/yaml' });
            downloadBlob(blob, `${sanitizeFilename(state.name)}-k8s.yaml`);
          } },
        ],
      }));
    },
  });
}

function downloadDrawIO(suffix) {
  const state = store.getState();
  const xml = buildDrawIOXml({ nodes: state.nodes, edges: state.edges });
  const blob = new Blob([xml], { type: 'application/xml' });
  downloadBlob(blob, `${sanitizeFilename(state.name)}-${suffix}.drawio`);
}

function buildSection({ title, description, buttons }) {
  const section = el('div', { class: 'export-diagram-section' });
  section.appendChild(el('h3', { text: title }));
  section.appendChild(el('p', { class: 'export-diagram-section-desc', text: description }));
  const row = el('div', { class: 'export-diagram-section-actions' });
  for (const btn of buttons) {
    row.appendChild(el('button', { type: 'button', class: 'btn', text: btn.text, onClick: btn.onClick }));
  }
  section.appendChild(row);
  return section;
}
