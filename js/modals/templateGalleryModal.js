// "🖼️ Template Gallery" — a browsable grid of Reference Architecture and
// Design Pattern blueprints (schema.js#definePattern) with a small preview
// thumbnail for each, instead of scanning two flat, text-only sidebar
// categories one row at a time. Sequence-diagram templates deliberately
// stay out of this gallery — they already have their own richer sidebar
// hover-preview (sidebar/patternPreview.js) and dedicated wizard/import
// flow (modals/sequenceDiagramModal.js), so a second, more generic browsing
// UI for them would be redundant rather than additive.
import { openModal } from './modal.js';
import { el, clear, svgEl } from '../utils/dom.js';
import { getComponentsForCategory, getComponentById } from '../data/index.js';
import { computePatternThumbnailLayout } from '../core/patternThumbnailLayout.js';
import { instantiatePatternAtCenter } from '../canvas/canvas.js';

const GALLERY_CATEGORIES = [
  { id: 'reference-architectures', label: 'Reference Architectures' },
  { id: 'design-patterns', label: 'Design Patterns' },
];

function buildThumbnail(def) {
  const layout = computePatternThumbnailLayout(def.pattern);
  if (!layout.boxes.length) return el('div', { class: 'template-gallery-thumb-empty' });
  const svg = svgEl('svg', {
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    class: 'template-gallery-thumb-svg',
  });
  for (const edge of layout.edges) {
    svg.appendChild(svgEl('line', { x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2, class: 'template-gallery-thumb-edge' }));
  }
  for (const box of layout.boxes) {
    svg.appendChild(svgEl('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 4, class: 'template-gallery-thumb-node' }));
    const comp = getComponentById(box.defId);
    const icon = svgEl('text', { x: box.cx, y: box.cy + 4, 'text-anchor': 'middle', class: 'template-gallery-thumb-icon' });
    icon.textContent = comp?.icon || '◻️';
    svg.appendChild(icon);
  }
  return svg;
}

function buildCard(def, api) {
  const card = el('button', { type: 'button', class: 'template-gallery-card' });
  card.appendChild(buildThumbnail(def));
  card.appendChild(el('span', { class: 'template-gallery-card-name', text: `${def.icon} ${def.name}` }));
  if (def.description) card.appendChild(el('span', { class: 'template-gallery-card-desc', text: def.description }));
  card.addEventListener('click', () => {
    instantiatePatternAtCenter(def.id);
    api.close();
  });
  return card;
}

export function openTemplateGalleryModal() {
  let query = '';
  let activeCategory = 'all';

  openModal({
    title: '🖼️ Template Gallery',
    className: 'template-gallery-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Browse Reference Architectures and Design Patterns visually and drop one in with one click. Looking for a sequence-diagram template instead? Those have their own preview in the sidebar\'s "Sequence Diagram Templates" category.',
      }));

      const searchInput = el('input', {
        type: 'search', class: 'template-gallery-search', placeholder: 'Search templates…',
        onInput: (e) => { query = e.target.value; renderGrid(); },
      });
      body.appendChild(searchInput);

      const tabs = el('div', { class: 'template-gallery-tabs' });
      const allTab = el('button', { type: 'button', class: 'template-gallery-tab', text: 'All' });
      tabs.appendChild(allTab);
      for (const cat of GALLERY_CATEGORIES) {
        tabs.appendChild(el('button', { type: 'button', class: 'template-gallery-tab', text: cat.label, onClick: () => { activeCategory = cat.id; renderGrid(); } }));
      }
      allTab.addEventListener('click', () => { activeCategory = 'all'; renderGrid(); });
      body.appendChild(tabs);

      const grid = el('div', { class: 'template-gallery-grid' });
      body.appendChild(grid);

      const updateTabs = () => {
        const buttons = tabs.querySelectorAll('.template-gallery-tab');
        buttons.forEach((btn, i) => {
          const isActive = (i === 0 && activeCategory === 'all') || (i > 0 && GALLERY_CATEGORIES[i - 1].id === activeCategory);
          btn.classList.toggle('active', isActive);
        });
      };

      const renderGrid = () => {
        updateTabs();
        clear(grid);
        const q = query.trim().toLowerCase();
        const categories = activeCategory === 'all' ? GALLERY_CATEGORIES : GALLERY_CATEGORIES.filter((c) => c.id === activeCategory);
        const defs = categories
          .flatMap((cat) => getComponentsForCategory(cat.id))
          .filter((def) => !q || def.name.toLowerCase().includes(q) || (def.description || '').toLowerCase().includes(q));
        if (!defs.length) {
          grid.appendChild(el('p', { class: 'sidebar-empty', text: 'No templates match.' }));
          return;
        }
        for (const def of defs) grid.appendChild(buildCard(def, api));
      };

      renderGrid();
    },
  });
}
