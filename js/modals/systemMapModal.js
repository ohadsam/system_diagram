// "🗺️ System Map" — a visual graph of every saved project and the
// cross-project links between them (core/project.js's `links` field),
// for when one diagram is best understood alongside another it relates to
// (a system diagram and a separate sequence diagram detailing one of its
// flows, or a service's own DB schema diagram) — see core/systemMap.js for
// the pure circle-layout math this renders. Clicking a project node loads
// it, same no-confirm convention modals/loadProjectModal.js's own "Load"
// button already uses (unlike the wizard-style "replace the canvas" flows,
// loading a saved project here is itself the explicit action).
import { openModal } from './modal.js';
import { el, clear, svgEl } from '../utils/dom.js';
import * as store from '../core/store.js';
import { listSavedProjects, loadNamedProject } from '../io/projects.js';
import { computeSystemMapLayout } from '../core/systemMap.js';
import { addProjectLink, removeProjectLink } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';

function buildMapSvg(projects, currentProjectId, api) {
  const size = 400;
  const layout = computeSystemMapLayout(projects, { centerX: size / 2, centerY: size / 2, radius: size / 2 - 60 });
  const svg = svgEl('svg', { class: 'system-map-svg', viewBox: `0 0 ${size} ${size}`, width: '100%', height: size });
  const nodesById = new Map(layout.nodes.map((n) => [n.id, n]));

  for (const link of layout.links) {
    const from = nodesById.get(link.fromId);
    const to = nodesById.get(link.toId);
    if (!from || !to) continue;
    svg.appendChild(svgEl('line', { class: 'system-map-link', x1: from.x, y1: from.y, x2: to.x, y2: to.y }));
    if (link.label) {
      const linkLabel = svgEl('text', { class: 'system-map-link-label', x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, 'text-anchor': 'middle' });
      linkLabel.textContent = link.label;
      svg.appendChild(linkLabel);
    }
  }

  for (const node of layout.nodes) {
    const group = svgEl('g', { class: `system-map-node${node.id === currentProjectId ? ' is-current' : ''}`, tabindex: '0', role: 'button' });
    group.appendChild(svgEl('circle', { cx: node.x, cy: node.y, r: 26 }));
    const label = svgEl('text', { x: node.x, y: node.y + 42, 'text-anchor': 'middle' });
    label.textContent = node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name;
    group.appendChild(label);
    if (node.id !== currentProjectId) {
      const activate = () => {
        const result = loadNamedProject(node.id);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        store.loadProject(result.project);
        showToast(`Loaded "${result.project.name}".`, 'success');
        api.close();
      };
      group.addEventListener('click', activate);
      group.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    }
    svg.appendChild(group);
  }

  return svg;
}

export function openSystemMapModal() {
  openModal({
    title: '🗺️ System Map',
    className: 'system-map-modal',
    render: (body, api) => {
      const renderBody = () => {
        clear(body);
        const state = store.getState();
        const savedProjects = listSavedProjects();
        const isCurrentSaved = savedProjects.some((p) => p.id === state.id);
        // The current project's own `links` come from the live in-memory
        // state, not whatever was persisted the last time it was saved —
        // addProjectLink/removeProjectLink only dispatch to the live store,
        // so a link added since the last save would otherwise not show up
        // here until the user re-saves.
        const allProjects = isCurrentSaved
          ? savedProjects.map((p) => (p.id === state.id ? { ...p, links: state.links || [] } : p))
          : [...savedProjects, { id: state.id, name: `${state.name} (unsaved)`, links: state.links || [] }];

        body.appendChild(el('p', {
          class: 'modal-hint',
          text: 'Every saved diagram, and how they relate to each other. Click a diagram to open it. Save this one first if you want to link it to another.',
        }));

        if (allProjects.length <= 1 && !(state.links || []).length) {
          body.appendChild(el('p', { class: 'system-map-empty', text: 'Save a second diagram to start building a map between them.' }));
        } else {
          body.appendChild(buildMapSvg(allProjects, state.id, api));
        }

        body.appendChild(el('h3', { text: 'Link this diagram to another' }));
        const otherSaved = savedProjects.filter((p) => p.id !== state.id);
        if (!otherSaved.length) {
          body.appendChild(el('p', { class: 'system-map-empty', text: 'No other saved diagrams yet — use "Save As" on another diagram first.' }));
        } else {
          const select = el('select', { class: 'system-map-target-select' },
            otherSaved.map((p) => el('option', { value: p.id, text: p.name })));
          const labelInput = el('input', { type: 'text', class: 'system-map-label-input', placeholder: 'Label (optional), e.g. "sequence diagram"' });
          const row = el('div', { class: 'system-map-add-row' }, [
            select,
            labelInput,
            el('button', {
              type: 'button', class: 'btn btn-secondary btn-sm', text: '🔗 Add Link',
              onClick: () => {
                addProjectLink(select.value, labelInput.value);
                renderBody();
              },
            }),
          ]);
          body.appendChild(row);
        }

        const currentLinks = state.links || [];
        if (currentLinks.length) {
          const byId = new Map(savedProjects.map((p) => [p.id, p.name]));
          const list = el('div', { class: 'system-map-link-list' });
          for (const link of currentLinks) {
            const targetName = byId.get(link.to) || '(deleted diagram)';
            list.appendChild(el('div', { class: 'system-map-link-row' }, [
              el('span', { text: link.label ? `${targetName} — ${link.label}` : targetName }),
              el('button', {
                type: 'button', class: 'btn btn-sm', text: '✕', title: 'Remove link',
                onClick: () => { removeProjectLink(link.id); renderBody(); },
              }),
            ]));
          }
          body.appendChild(list);
        }
      };

      renderBody();
    },
  });
}
