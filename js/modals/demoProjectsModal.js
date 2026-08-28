// "🎓 Demo Projects" (Create menu) — a picker for the ready-made example
// diagrams in core/demoProjects.js, one per diagram "kind" this app
// supports plus a combo showing two kinds together. Loading one is a full
// project switch (canvas.js#loadDemoProject → store.loadProject), same as
// Load/New/Generate Design — so it asks for confirmation first if the
// canvas isn't already empty, exactly like Generate Design/AI Quick Start
// do before replacing a non-empty canvas. "🧹 Clear Canvas" sits right
// here too for convenience once a demo's been explored — it's the same
// existing action as everywhere else, no separate "this is a demo"
// tracking needed.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { DEMO_PROJECTS } from '../core/demoProjects.js';
import { loadDemoProject, clearCanvas } from '../canvas/canvas.js';
import { confirmAction } from './confirmModal.js';

function buildRow(demo, api) {
  const row = el('div', { class: 'demo-projects-row' });
  row.appendChild(el('span', { class: 'demo-projects-row-icon', text: demo.icon }));
  const info = el('div', { class: 'demo-projects-row-info' });
  info.appendChild(el('span', { class: 'demo-projects-row-name', text: demo.name }));
  info.appendChild(el('span', { class: 'demo-projects-row-desc', text: demo.description }));
  row.appendChild(info);
  row.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-primary demo-projects-row-load',
    text: 'Load',
    onClick: async () => {
      const currentHasContent = store.getState().nodes.length > 0;
      if (currentHasContent) {
        const proceed = await confirmAction({
          title: 'Replace the current canvas?',
          message: `This loads "${demo.name}" in place of what's on the canvas now. If you want to keep your current diagram, use "Save As" first — undo (Ctrl/Cmd+Z) can also bring it right back.`,
          confirmLabel: 'Replace',
          danger: false,
        });
        if (!proceed) return;
      }
      loadDemoProject(demo.id);
      api.close();
    },
  }));
  return row;
}

export function openDemoProjectsModal() {
  openModal({
    title: '🎓 Demo Projects',
    className: 'demo-projects-modal',
    render: (body, api) => {
      body.appendChild(el('p', { class: 'demo-projects-intro', text: 'Ready-made example diagrams showing off different diagram kinds this app supports — pick one to load it onto the canvas.' }));
      const list = el('div', { class: 'demo-projects-list' });
      for (const demo of DEMO_PROJECTS) list.appendChild(buildRow(demo, api));
      body.appendChild(list);
      body.appendChild(el('button', {
        type: 'button',
        class: 'btn demo-projects-clear-btn',
        text: '🧹 Clear Canvas',
        title: 'Clear the canvas back to blank (works the same whether or not a demo is currently loaded)',
        onClick: () => clearCanvas(),
      }));
    },
  });
}
