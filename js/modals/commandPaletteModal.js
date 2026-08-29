// "⌘ Quick Actions" (Ctrl/Cmd+K) — a searchable list of every major app
// action *and* every library component ("add redis", "export", "arrange",
// ...), opened from a toolbar button or the keyboard shortcut. When exactly
// one component is selected on the canvas, results relevant to *that*
// component (its curated companions/sub-components/patterns, plus
// duplicate/delete) are shown first under their own heading, ahead of the
// general action/component list — see buildContextualCommands below.
// Picking a component-adding result reuses the exact same
// canvas.js#addComponentAtCenter / #addRelatedComponent paths the
// sidebar/Smart-Suggestions banner already use, so the same "✨ Smart
// Suggestions" follow-up banner offering what to add/connect next appears
// afterward — no separate "what now?" mechanism needed, this one already
// existed and just needed to be reachable from here too.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { createEmptyProject } from '../core/project.js';
import { ALL_COMPONENTS, getRelatedComponents, getRelatedLayers, getRelatedPatterns } from '../data/index.js';
import { componentMatches } from '../sidebar/search.js';
import { filterCommands } from '../toolbar/commandPalette.js';
import {
  deleteSelection, duplicateSelection, autoArrangeAll, distributeSequenceDiagram, duplicateProjectAsNew,
  addRelatedComponent, addLayerToNode, instantiatePatternNearNode, instantiatePatternAtCenter, addComponentAtCenter,
  resolveComponentDef, clearCanvas, setFocusMode, addCommentAtCenter,
} from '../canvas/canvas.js';
import * as viewport from '../canvas/viewport.js';
import { openSaveAsModal } from './saveAsModal.js';
import { openLoadProjectModal } from './loadProjectModal.js';
import { openCustomComponentModal } from './customComponentModal.js';
import { openCustomShapeModal } from './customShapeModal.js';
import { openDefaultSettingsModal } from './defaultSettingsModal.js';
import { openBackupModal } from './backupModal.js';
import { openReplicationModal } from './replicationModal.js';
import { openSequenceDiagramModal } from './sequenceDiagramModal.js';
import { openImportSequenceMermaidModal } from './importSequenceMermaidModal.js';
import { openExportDiagramModal } from './exportDiagramModal.js';
import { openShareLinkModal } from './shareLinkModal.js';
import { openVersionHistoryModal } from './versionHistoryModal.js';
import { openPresentationsModal } from './presentationsModal.js';
import { openDiagramLintModal } from './diagramLintModal.js';
import { openCostBreakdownModal } from './costBreakdownModal.js';
import { openScaleDiagramModal } from './scaleDiagramModal.js';
import { openDiagramThemeModal } from './diagramThemeModal.js';
import { openBlastRadiusModal } from './blastRadiusModal.js';
import { openInterviewModeModal } from './interviewModeModal.js';
import { openImportFromUrlModal } from './importFromUrlModal.js';
import { openSystemMapModal } from './systemMapModal.js';
import { openExportPosterModal } from './exportPosterModal.js';
import { openReviewStatusModal } from './reviewStatusModal.js';
import { getUiPrefs, saveUiPrefs } from '../io/uiPrefs.js';
import { setMinimapVisible } from '../canvas/minimap.js';
import { openGenerateDesignModal } from './generateDesignModal.js';
import { confirmAction } from './confirmModal.js';
import { exportProjectToFile } from '../io/fileIO.js';
import { exportPNG } from '../io/exportImage.js';
import { exportPDF } from '../io/exportPdf.js';
import { showToast } from '../utils/toast.js';
import { resetHints } from '../hints/hints.js';
import { toggleAiReviewPanel } from '../panel/aiReviewPanel.js';
import { toggleAiChatPanel } from '../panel/aiChatPanel.js';
import { openGlobalSearchModal } from './globalSearchModal.js';
import { openAddTabModal } from './addTabModal.js';
import { openHistoryTimelineModal } from './historyTimelineModal.js';
import { openQuickStartModal } from './quickStartModal.js';
import { openImportFromImageModal } from './importFromImageModal.js';
import { openAiEditModal } from './aiEditModal.js';
import { openAiConversationModal } from './aiConversationModal.js';
import { openCliSetupModal } from './cliSetupModal.js';
import { openC4ContextModal } from './c4ContextModal.js';
import { openImportSqlModal } from './importSqlModal.js';
import { openTemplateGalleryModal } from './templateGalleryModal.js';
import { openCollaborationModal } from './collaborationModal.js';
import { openCommentsListModal } from './commentsListModal.js';
import { toggleOutlinePanel } from '../panel/outlinePanel.js';
import { toggleAnimationPanel } from '../panel/animationPanel.js';
import { openAiLayoutModal } from './aiLayoutModal.js';
import { openDiagramDescriptionModal } from './diagramDescriptionModal.js';
import { openWhatsNewModal } from './whatsNewModal.js';
import { openDemoProjectsModal } from './demoProjectsModal.js';
import { setFlowSimulationEnabled } from '../canvas/canvas.js';
import { toggleKioskMode } from '../core/kioskMode.js';
import { setScene3DActive } from '../core/scene3dMode.js';
import { getLanguage, setLanguage, t } from '../io/i18n.js';
import { LANGUAGES } from '../io/uiPrefs.js';

const MAX_COMPONENT_RESULTS = 8;
const MAX_RELATED_PER_KIND = 3;

function buildAppCommands() {
  return [
    { id: 'new', label: '🆕 New diagram', keywords: ['new', 'blank', 'start'], run: async () => {
      const ok = await confirmAction({ title: 'Start a new diagram?', message: 'This clears the canvas. Undo (Ctrl/Cmd+Z) can bring it back.', confirmLabel: 'Start new', danger: false });
      if (ok) store.loadProject(createEmptyProject());
    } },
    { id: 'save-as', label: '💾 Save As', keywords: ['save', 'checkpoint', 'name'], run: openSaveAsModal },
    { id: 'load', label: '📂 Load', keywords: ['load', 'open', 'projects'], run: openLoadProjectModal },
    { id: 'duplicate-project', label: '📄 Duplicate Project', keywords: ['duplicate', 'copy', 'clone', 'project'], run: duplicateProjectAsNew },
    { id: 'export-json', label: '⬇️ Export JSON', keywords: ['export', 'json', 'download'], run: () => exportProjectToFile(store.getState()) },
    { id: 'export-png', label: '🖼️ Export PNG', keywords: ['export', 'png', 'image', 'picture'], run: async () => {
      showToast('Rendering PNG…', 'info', 1500);
      const result = await exportPNG(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    } },
    { id: 'export-pdf', label: '📄 Export PDF', keywords: ['export', 'pdf', 'print', 'document'], run: async () => {
      showToast('Rendering PDF…', 'info', 1500);
      const result = await exportPDF(store.getState().name);
      if (!result.ok) showToast(result.error, 'error');
    } },
    { id: 'export-to', label: '🌐 Export to... (Mermaid/draw.io/Lucidchart)', keywords: ['export', 'mermaid', 'drawio', 'lucidchart', 'flowchart'], run: openExportDiagramModal },
    { id: 'share', label: '🔗 Share', keywords: ['share', 'link', 'url'], run: openShareLinkModal },
    { id: 'version-history', label: '📸 Version History', keywords: ['version', 'history', 'snapshot', 'save version', 'revert', 'compare'], run: openVersionHistoryModal },
    { id: 'presentations', label: '🎬 Presentations', keywords: ['presentation', 'slideshow', 'slides', 'pptx', 'powerpoint'], run: openPresentationsModal },
    { id: 'backup', label: '🗄️ Backup & Restore', keywords: ['backup', 'restore'], run: openBackupModal },
    { id: 'check-diagram', label: '🔍 Check Diagram', keywords: ['lint', 'check', 'validate', 'issues'], run: openDiagramLintModal },
    { id: 'cost-breakdown', label: '💰 Cost Breakdown', keywords: ['cost', 'price', 'budget', 'monthly', 'total'], run: openCostBreakdownModal },
    { id: 'ai-review', label: '🤖 AI Design Review', keywords: ['ai', 'review', 'feedback'], run: toggleAiReviewPanel },
    { id: 'ai-chat', label: '🤖 AI Chat', keywords: ['ai', 'chat', 'direct', 'local', 'live', 'conversation'], run: toggleAiChatPanel },
    { id: 'generate-design', label: '🧠 Generate Design from Spec', keywords: ['ai', 'generate', 'spec'], run: openGenerateDesignModal },
    { id: 'sequence-diagram', label: '🔀 Sequence Diagram wizard', keywords: ['sequence', 'lifeline', 'uml'], run: openSequenceDiagramModal },
    { id: 'import-mermaid', label: '📥 Import from Mermaid', keywords: ['import', 'mermaid', 'sequence'], run: openImportSequenceMermaidModal },
    { id: 'replicate', label: '🔁 Replicate', keywords: ['replicate', 'mirror', 'ha', 'active-active', 'high availability'], run: openReplicationModal },
    { id: 'auto-arrange', label: '🗺️ Auto-arrange', keywords: ['arrange', 'layout', 'tidy', 'order', 'sort'], run: autoArrangeAll },
    { id: 'distribute', label: '↔️ Distribute Evenly', keywords: ['distribute', 'space', 'even'], run: distributeSequenceDiagram },
    { id: 'scale', label: '📐 Scale Diagram', keywords: ['scale', 'resize'], run: openScaleDiagramModal },
    { id: 'diagram-theme', label: '🎨 Diagram Theme', keywords: ['theme', 'recolor', 'palette', 'color'], run: openDiagramThemeModal },
    { id: 'add-comment', label: '💬 Add Comment', keywords: ['comment', 'annotation', 'note', 'pin'], run: addCommentAtCenter },
    { id: 'toggle-grid', label: '▦ Toggle Grid', keywords: ['grid', 'toggle', 'background'], run: () => document.querySelector('.canvas-viewport')?.classList.toggle('show-grid') },
    {
      id: 'toggle-minimap', label: '🧭 Toggle Minimap', keywords: ['minimap', 'overview', 'map'],
      run: () => {
        const next = !getUiPrefs().showMinimap;
        saveUiPrefs({ showMinimap: next });
        setMinimapVisible(next);
        document.querySelector('#toolbar button[title^="Minimap"]')?.classList.toggle('active', next);
      },
    },
    {
      id: 'toggle-focus-mode', label: '🔦 Toggle Focus Mode', keywords: ['focus', 'dim', 'spotlight', 'highlight'],
      run: () => {
        const next = !getUiPrefs().focusMode;
        saveUiPrefs({ focusMode: next });
        setFocusMode(next);
        document.querySelector('#toolbar button[title^="Focus Mode"]')?.classList.toggle('active', next);
      },
    },
    { id: 'new-component', label: '🧩 New Component', keywords: ['custom component', 'new component', 'create component'], run: () => openCustomComponentModal({}) },
    { id: 'new-shape', label: '✏️ New Custom Shape', keywords: ['custom shape', 'new shape'], run: openCustomShapeModal },
    { id: 'default-settings', label: '🎛️ Default Settings', keywords: ['settings', 'defaults', 'preferences'], run: openDefaultSettingsModal },
    { id: 'clear-canvas', label: '🧹 Clear Canvas', keywords: ['clear', 'delete all', 'wipe', 'empty'], run: clearCanvas },
    { id: 'undo', label: '↩️ Undo', keywords: ['undo'], run: store.undo },
    { id: 'redo', label: '↪️ Redo', keywords: ['redo'], run: store.redo },
    { id: 'zoom-in', label: '➕ Zoom In', keywords: ['zoom', 'in'], run: () => viewport.zoomTo(viewport.getViewport().zoom + 0.1) },
    { id: 'zoom-out', label: '➖ Zoom Out', keywords: ['zoom', 'out'], run: () => viewport.zoomTo(viewport.getViewport().zoom - 0.1) },
    { id: 'zoom-reset', label: '🔄 Reset Zoom', keywords: ['zoom', 'reset', '100%'], run: () => viewport.zoomTo(1) },
    { id: 'show-hints', label: '💡 Show Hints Again', keywords: ['hints', 'tour', 'help', 'guide'], run: resetHints },
    { id: 'global-search', label: '🔎 Search All Projects', keywords: ['search', 'all', 'projects', 'find'], run: openGlobalSearchModal },
    { id: 'add-tab', label: '🗂️ Open in New Tab...', keywords: ['tab', 'new tab', 'open'], run: openAddTabModal },
    { id: 'history-timeline', label: '🕘 Undo History', keywords: ['undo', 'redo', 'history', 'timeline'], run: openHistoryTimelineModal },
    { id: 'quick-start', label: '🪄 AI Quick Start', keywords: ['ai', 'quick start', 'onboarding', 'describe'], run: openQuickStartModal },
    { id: 'import-from-image', label: '🖼️ Import from Image', keywords: ['ai', 'import', 'image', 'screenshot', 'sketch'], run: openImportFromImageModal },
    { id: 'ai-edit', label: '💬 Edit with AI', keywords: ['ai', 'edit', 'patch', 'change'], run: openAiEditModal },
    { id: 'ai-conversation', label: '🗨️ AI Conversation', keywords: ['ai', 'conversation', 'chat', 'cli', 'continue', 'transcript'], run: openAiConversationModal },
    { id: 'c4-context', label: '🧩 C4 Context Diagram', keywords: ['c4', 'context', 'model'], run: openC4ContextModal },
    { id: 'import-sql', label: '📥 Import from SQL', keywords: ['import', 'sql', 'ddl', 'er diagram', 'entity'], run: openImportSqlModal },
    { id: 'template-gallery', label: '🖼️ Template Gallery', keywords: ['template', 'gallery', 'reference architecture', 'pattern'], run: openTemplateGalleryModal },
    { id: 'demo-projects', label: '🎓 Demo Projects', keywords: ['demo', 'example', 'sample', 'showcase', 'tutorial'], run: openDemoProjectsModal },
    { id: 'collaborate', label: '🤝 Collaborate', keywords: ['collaborate', 'live', 'realtime', 'webrtc', 'peer'], run: openCollaborationModal },
    { id: 'comments-list', label: '💬 Comments', keywords: ['comments', 'pins', 'unresolved'], run: openCommentsListModal },
    { id: 'outline', label: '📋 Outline', keywords: ['outline', 'toc', 'table of contents', 'list'], run: toggleOutlinePanel },
    { id: 'ai-beautify-layout', label: '🪄 AI Beautify Layout', keywords: ['ai', 'layout', 'beautify', 'reposition', 'arrange'], run: openAiLayoutModal },
    { id: 'describe-diagram', label: '📃 Describe Diagram', keywords: ['describe', 'summary', 'plain text', 'accessible'], run: openDiagramDescriptionModal },
    {
      id: 'presenter-mode', label: '🖥️ Presenter Mode', keywords: ['presenter', 'kiosk', 'full screen', 'clean'],
      run: toggleKioskMode,
    },
    { id: 'diagram-animation', label: '🎞️ Diagram Animation', keywords: ['animation', 'reveal', 'playback', 'sequence'], run: toggleAnimationPanel },
    {
      id: 'flow-simulation', label: '💫 Flow Simulation', keywords: ['flow', 'simulation', 'traffic', 'dots'],
      run: () => {
        const next = !getUiPrefs().flowSimulation;
        saveUiPrefs({ flowSimulation: next });
        setFlowSimulationEnabled(next);
        document.querySelector('#toolbar button[title^="Flow Simulation"]')?.classList.toggle('active', next);
      },
    },
    {
      id: 'scene3d', label: '🧊 3D Presentation', keywords: ['3d', 'presentation', 'scene', 'cable', 'video'],
      run: () => {
        if (store.getState().nodes.length < 1) { showToast('Add at least one component first.', 'error'); return; }
        setScene3DActive(true);
      },
    },
    {
      id: 'language-toggle', label: `🌐 ${t('toolbar.language')}`, keywords: ['language', 'hebrew', 'rtl', 'english'],
      run: () => {
        const nextIndex = (LANGUAGES.indexOf(getLanguage()) + 1) % LANGUAGES.length;
        setLanguage(LANGUAGES[nextIndex]);
        window.location.reload();
      },
    },
    { id: 'whats-new', label: "🆕 What's New", keywords: ["what's new", 'changelog', 'version', 'updates'], run: () => openWhatsNewModal() },
    { id: 'interview-mode', label: '🎓 Interview Mode', keywords: ['interview', 'practice', 'system design', 'timer', 'grading'], run: () => openInterviewModeModal() },
    { id: 'import-url', label: '🔗 Import from URL/Gist', keywords: ['import', 'url', 'gist', 'github', 'link'], run: () => openImportFromUrlModal() },
    { id: 'system-map', label: '🗺️ System Map', keywords: ['system map', 'projects', 'graph', 'link'], run: () => openSystemMapModal() },
    { id: 'export-poster', label: '🧩 Export PDF (Poster)', keywords: ['pdf', 'poster', 'print', 'tile', 'pages'], run: () => openExportPosterModal() },
    { id: 'review-status', label: '📝 Review Status', keywords: ['review', 'status', 'draft', 'approved', 'approval'], run: () => openReviewStatusModal() },
    { id: 'feature-level', label: '🧩 Feature Level Settings', keywords: ['feature level', 'basic', 'advanced', 'custom', 'hide', 'show', 'simplify', 'toolbar'], run: () => openDefaultSettingsModal({ scrollToFeatureLevel: true }) },
    { id: 'ai-cli-integration', label: '🤖 AI / CLI Integration', keywords: ['ai', 'cli', 'agent', 'integration', 'api', 'llms.txt', 'claude code', 'share link'], run: () => window.open('docs/AI_INTEGRATION.md', '_blank', 'noopener') },
    { id: 'cli-setup', label: '🖥️ Working with CLI', keywords: ['cli', 'address', 'url', 'setup', 'agent', 'claude code'], run: openCliSetupModal },
  ];
}

function buildContextualCommands(nodeId) {
  const state = store.getState();
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node) return [];
  const def = resolveComponentDef(node.defId);
  if (!def) return [];

  const commands = [];
  getRelatedComponents(def.id).slice(0, MAX_RELATED_PER_KIND).forEach((rel, idx) => {
    commands.push({ id: `rel-comp-${rel.id}`, label: `${rel.icon} + Add ${rel.name}`, keywords: [rel.name, 'add', 'related'], run: () => addRelatedComponent(rel.id, nodeId, idx) });
  });
  getRelatedLayers(def.id).slice(0, MAX_RELATED_PER_KIND).forEach((rel) => {
    commands.push({ id: `rel-layer-${rel.id}`, label: `${rel.icon} ↳ Attach ${rel.name}`, keywords: [rel.name, 'attach', 'layer', 'sub-component'], run: () => addLayerToNode(rel.id, nodeId) });
  });
  getRelatedPatterns(def.id).slice(0, 2).forEach((rel) => {
    commands.push({ id: `rel-pattern-${rel.id}`, label: `${rel.icon} Add "${rel.name}" nearby`, keywords: [rel.name, 'pattern', 'sequence'], run: () => instantiatePatternNearNode(rel.id, nodeId) });
  });
  commands.push({ id: 'ctx-blast-radius', label: `🎯 Blast Radius of ${def.name}`, keywords: ['blast', 'radius', 'impact', 'failure', 'dependency'], run: () => openBlastRadiusModal(nodeId) });
  commands.push({ id: 'ctx-duplicate', label: `📄 Duplicate ${def.name}`, keywords: ['duplicate', 'copy'], run: duplicateSelection });
  commands.push({ id: 'ctx-delete', label: `🗑️ Delete ${def.name}`, keywords: ['delete', 'remove'], run: deleteSelection });
  return commands;
}

function componentToCommand(def) {
  const label = `${def.icon || '▪️'} + Add ${def.name}`;
  if (def.kind === 'pattern') {
    return { id: `add-${def.id}`, label, run: () => instantiatePatternAtCenter(def.id) };
  }
  if (def.kind === 'layer' && store.getSelection().nodeIds.length === 1) {
    return { id: `add-${def.id}`, label, run: () => addLayerToNode(def.id, store.getSelection().nodeIds[0]) };
  }
  return { id: `add-${def.id}`, label, run: () => addComponentAtCenter(def.id) };
}

export function openCommandPaletteModal() {
  const selection = store.getSelection();
  const contextNodeId = selection.nodeIds.length === 1 && !selection.edgeIds.length ? selection.nodeIds[0] : null;
  const contextDef = contextNodeId ? resolveComponentDef(store.getState().nodes.find((n) => n.id === contextNodeId)?.defId) : null;
  const contextualCommands = contextNodeId ? buildContextualCommands(contextNodeId) : [];
  const appCommands = buildAppCommands();

  let query = '';
  let results = [];
  let activeIndex = 0;
  let listEl;
  let inputEl;

  const api = openModal({
    title: '⌘ Quick Actions',
    className: 'command-palette-modal',
    render: (body) => {
      inputEl = el('input', {
        type: 'text',
        class: 'command-palette-input',
        placeholder: 'Type a component name or an action (e.g. "add redis", "arrange", "export")…',
        onInput: (e) => { query = e.target.value; activeIndex = 0; renderResults(); },
        onKeydown: (e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, results.length - 1); renderResults(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderResults(); }
          else if (e.key === 'Enter') { e.preventDefault(); runResult(activeIndex); }
        },
      });
      body.appendChild(inputEl);
      listEl = el('div', { class: 'command-palette-list' });
      body.appendChild(listEl);
      renderResults();
      setTimeout(() => inputEl.focus(), 0);
    },
  });

  function computeResults() {
    const q = query.trim();
    const matchedContextual = filterCommands(contextualCommands, q);
    const matchedApp = filterCommands(appCommands, q);
    const matchedComponents = q
      ? ALL_COMPONENTS.filter((c) => componentMatches(c, q)).slice(0, MAX_COMPONENT_RESULTS).map(componentToCommand)
      : [];
    const sections = [];
    if (matchedContextual.length) sections.push({ heading: `For "${contextDef?.name || 'this component'}"`, commands: matchedContextual });
    if (matchedComponents.length) sections.push({ heading: 'Add a component', commands: matchedComponents });
    if (matchedApp.length) sections.push({ heading: 'Actions', commands: matchedApp });
    return sections;
  }

  function runResult(index) {
    const cmd = results[index];
    if (!cmd) return;
    api.close();
    cmd.run();
  }

  function renderResults() {
    clear(listEl);
    const sections = computeResults();
    results = sections.flatMap((s) => s.commands);
    if (activeIndex >= results.length) activeIndex = Math.max(0, results.length - 1);

    if (!results.length) {
      listEl.appendChild(el('p', { class: 'command-palette-empty', text: 'No matching actions or components.' }));
      return;
    }

    let flatIndex = 0;
    for (const section of sections) {
      listEl.appendChild(el('div', { class: 'command-palette-heading', text: section.heading }));
      for (const cmd of section.commands) {
        const idx = flatIndex;
        const item = el('button', {
          type: 'button',
          class: `command-palette-item${idx === activeIndex ? ' is-active' : ''}`,
          text: cmd.label,
          onClick: () => runResult(idx),
          onMouseEnter: (e) => {
            activeIndex = idx;
            listEl.querySelectorAll('.command-palette-item.is-active').forEach((n) => n.classList.remove('is-active'));
            e.currentTarget.classList.add('is-active');
          },
        });
        listEl.appendChild(item);
        flatIndex += 1;
      }
    }
  }
}
