// Pure(ish) DOM builder/updater for a single node. Drag/resize/connect
// gestures are wired by nodeInteractions.js; simple clicks (select, rename,
// row edit, info/menu buttons) are wired here and dispatch to the store
// directly since they involve no pointer-move gesture state.
import * as store from '../core/store.js';
import { el, clear, svgEl } from '../utils/dom.js';
import { hasSuggestions } from './suggestions.js';
import { formatMonthlyCost } from '../core/cost.js';
import { computeShrinkThumbnail } from './shrinkThumbnail.js';

let handlers = {
  onSelect: () => {},
  onOpenDetails: () => {},
  onContextMenu: () => {},
};

// Shared across every node instance — a mouse/touch interaction always
// focuses its target as a side effect, right after its own pointerdown
// handler already ran `onSelect` (possibly additively, possibly to
// deselect). The `focus` listener below must not re-run `onSelect`
// (non-additively) in that case — only for a *keyboard* Tab landing on a
// node with no preceding pointerdown at all.
let recentPointerdown = false;

export function configureNodeHandlers(next) {
  handlers = { ...handlers, ...next };
}

const SIDES = ['top', 'right', 'bottom', 'left'];
const HANDLES = ['nw', 'ne', 'se', 'sw'];

export function createNodeEl(node) {
  const root = el('div', {
    class: 'node',
    'data-node-id': node.id,
    'data-shape': node.shape,
    tabIndex: 0,
    role: 'group',
    'aria-label': node.text || 'component',
  });

  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.conn-point, .resize-handle, .node-info-btn, .node-menu-btn, .node-suggestion-badge, .row-item, .node-add-row')) return;
    // A right-click's own pointerdown (button 2) fires before its
    // 'contextmenu' event — on a node that's already part of a multi-
    // -selection, it must not collapse that selection first, or a
    // context-menu action meant to act on the whole group (e.g. Diagram
    // Animation's "Add Selection to Animation", or "Group & Shrink") would
    // only ever see the one right-clicked item. Right-clicking something
    // *not* already selected still selects just it, same as before.
    if (e.button === 2 && root.classList.contains('selected')) {
      // Still must set the guard below — a right-click also shifts native
      // DOM focus to this element if it wasn't already focused (browsers do
      // this for any focusable element regardless of which mouse button was
      // pressed), which fires this node's own 'focus' handler right after.
      // Without `recentPointerdown` set here, that handler would see it as
      // a genuine keyboard-driven focus change and call onSelect(id, false)
      // — silently collapsing the very multi-selection this early return
      // exists to preserve, but *only* for whichever member wasn't already
      // focused (i.e. not the last one clicked) — the reason this bug
      // stayed invisible until a menu item was right-clicked on a node
      // other than the last-selected one.
      recentPointerdown = true;
      setTimeout(() => { recentPointerdown = false; }, 0);
      return;
    }
    recentPointerdown = true;
    setTimeout(() => { recentPointerdown = false; }, 0);
    handlers.onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey, e);
  });
  root.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    handlers.onContextMenu(node.id, e);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlers.onOpenDetails(node.id);
  });
  // Tab-focusing a node also selects it — otherwise there is no way to
  // select a component at all without a mouse/touch click, which would
  // make every keyboard-only editing action (arrow-key nudge, the 'C'
  // keyboard-connect gesture, Delete) unreachable purely by keyboard. Guard
  // against `recentPointerdown` so a plain/modifier click's own focus side
  // effect never re-runs (or reverses) the pointerdown handler's own
  // select/deselect/toggle decision above.
  root.addEventListener('focus', () => {
    if (recentPointerdown) return;
    handlers.onSelect(node.id, false);
  });

  const body = el('div', { class: 'node-body' });
  root.appendChild(body);

  // Double-click anywhere on the node's face renames it, not just the exact
  // label text — .node-standard/.node-icon/.node-subchips all set
  // `pointer-events: none` (see node.css) so single-click/drag-select isn't
  // eaten by them, which as a side effect makes dblclick on that empty
  // space fall through to .node-body instead of the label — this handler
  // catches that fallthrough case. A dblclick landing directly on the label
  // (or an external label, or a "rows" row) is already handled by that
  // element's own listener with stopPropagation, so this never double-fires.
  body.addEventListener('dblclick', (e) => {
    if (e.target.closest('.node-label, .node-external-label, .row-text')) return;
    const label = body.querySelector('.node-label') || root.querySelector('.node-external-label');
    if (!label) return;
    e.stopPropagation();
    startInlineEdit(label, label.textContent, (value) => renameNode({ id: root.dataset.nodeId }, value));
  });

  const badge = el('span', { class: 'node-badge', title: 'Has notes, labels or sub-components' }, '●');
  root.appendChild(badge);

  const replicationBadge = el('span', { class: 'node-replication-badge', title: 'Part of a live replication pair', 'aria-hidden': 'true' }, '🔁');
  root.appendChild(replicationBadge);

  // UML "destroy" marker (lifeline shape only) — an X at node.destroyOffset,
  // hidden via CSS unless .has-destroy-marker is set (updateNodeEl below).
  const destroyMarker = el('div', { class: 'lifeline-destroy-marker', 'aria-hidden': 'true' }, '✕');
  root.appendChild(destroyMarker);

  // UML activation bars (lifeline shape only) — rebuilt on every update
  // since the count varies (updateNodeEl below); wired for drag-to-move/
  // -resize via delegation in nodeInteractions.js rather than per-bar
  // listeners, so a rebuild never leaves a bar's handlers stale.
  const activationsLayer = el('div', { class: 'lifeline-activations' });
  root.appendChild(activationsLayer);

  // UML combined-fragment operator tag (alt/opt/loop/par/critical/break/ref)
  // — a small pentagon label at the box's top-left corner, hidden via CSS
  // unless .has-fragment-tag is set (updateNodeEl below). Only the six
  // Fragment shapes (data/categories/sequence-templates.js) ever set
  // node.fragmentType.
  const fragmentTag = el('div', { class: 'fragment-tag', 'aria-hidden': 'true' });
  root.appendChild(fragmentTag);

  const points = el('div', { class: 'node-connection-points' });
  for (const side of SIDES) {
    const point = el('button', {
      class: `conn-point conn-${side}`,
      type: 'button',
      'data-side': side,
      'aria-label': `Draw connector from ${side}`,
      title: 'Drag to connect',
    });
    points.appendChild(point);
  }
  root.appendChild(points);

  const handlesWrap = el('div', { class: 'node-resize-handles' });
  for (const h of HANDLES) {
    handlesWrap.appendChild(el('button', { class: `resize-handle rh-${h}`, type: 'button', 'data-handle': h, 'aria-label': `Resize ${h}`, tabIndex: -1 }));
  }
  root.appendChild(handlesWrap);

  const infoBtn = el('button', {
    class: 'node-info-btn',
    type: 'button',
    title: 'Open details (notes, labels, sub-components)',
    'aria-label': 'Open details',
    text: 'ⓘ',
    onClick: (e) => {
      e.stopPropagation();
      handlers.onOpenDetails(node.id);
    },
  });
  root.appendChild(infoBtn);

  const suggestionBadge = el('button', {
    class: 'node-suggestion-badge',
    type: 'button',
    title: 'Suggestions available (sub-components and/or flow diagrams) — click to view them in the details panel',
    'aria-label': 'View suggestions',
    text: '💡',
    onClick: (e) => {
      e.stopPropagation();
      handlers.onOpenDetails(node.id);
    },
  });
  root.appendChild(suggestionBadge);

  // Ambient "Check Diagram" indicator (io/uiPrefs.js#inlineLintBadges) — same
  // rule-based findings the 🔍 Check Diagram modal computes, surfaced right
  // on the node(s) involved. Hidden unless updateNodeEl is passed a non-empty
  // `lintMessages` list (canvas.js#render, only when the pref is on).
  const lintBadge = el('span', { class: 'node-lint-badge', 'aria-hidden': 'true' }, '⚠️');
  root.appendChild(lintBadge);

  const menuBtn = el('button', {
    class: 'node-menu-btn',
    type: 'button',
    title: 'Edit & more options',
    'aria-label': 'Edit and more options',
    text: '⋮',
    onClick: (e) => {
      e.stopPropagation();
      handlers.onSelect(node.id, false);
      handlers.onContextMenu(node.id, e, true);
    },
  });
  root.appendChild(menuBtn);

  updateNodeEl(root, node, { selected: false });
  return root;
}

export function updateNodeEl(rootEl, node, { selected = false, replicated = false, replicationFrozen = false, lintMessages = null, shrinkThumbnail = null } = {}) {
  rootEl.dataset.shape = node.shape;
  rootEl.style.left = `${node.x}px`;
  rootEl.style.top = `${node.y}px`;
  rootEl.style.width = `${node.w}px`;
  rootEl.style.height = `${node.h}px`;
  rootEl.style.zIndex = String(node.zIndex || 1);
  rootEl.classList.toggle('selected', !!selected);
  rootEl.classList.toggle('is-replicated', !!replicated && !node.replicationExcluded);

  const replicationBadgeEl = rootEl.querySelector('.node-replication-badge');
  if (replicationBadgeEl) {
    const frozen = !!replicationFrozen;
    replicationBadgeEl.textContent = frozen ? '❄️' : '🔁';
    replicationBadgeEl.title = frozen ? 'Part of a replication pair — frozen, changes here stay local' : 'Part of a live replication pair';
  }

  const hasInfo = !!(node.notes?.trim() || node.labels?.length || (node.subComponents?.length && node.shape !== 'rows'));
  rootEl.classList.toggle('has-info', hasInfo);
  rootEl.classList.toggle('has-suggestions', hasSuggestions(node));

  const hasLintFindings = !!(lintMessages && lintMessages.length);
  rootEl.classList.toggle('has-lint-findings', hasLintFindings);
  const lintBadgeEl = rootEl.querySelector('.node-lint-badge');
  if (lintBadgeEl) lintBadgeEl.title = hasLintFindings ? lintMessages.join('\n') : '';
  rootEl.setAttribute('aria-label', node.text || 'component');

  const body = rootEl.querySelector('.node-body');
  body.style.background = node.fill;
  body.style.borderColor = node.stroke;
  body.style.borderWidth = `${node.strokeWidth}px`;
  body.style.borderStyle = node.borderStyle || 'solid';
  body.style.color = '#1F2937';
  body.style.fontSize = `${node.fontSize}px`;
  body.style.textAlign = node.textAlign;
  // Only rect/rounded actually use a plain CSS border-radius (see
  // core/project.js#createNode's cornerRadius comment for why every other
  // shape ignores this) — clearing the inline property for the rest falls
  // back to their own shape-specific css/node.css rule rather than fighting it.
  body.style.borderRadius = Number.isFinite(node.cornerRadius) && (node.shape === 'rect' || node.shape === 'rounded')
    ? `${node.cornerRadius}px`
    : '';
  // An opt-in *stronger* shadow on top of `.node-body`'s own baseline
  // `box-shadow: var(--shadow-sm)` (css/node.css). Set as a custom property
  // rather than `box-shadow` directly: `.node-body` isn't the only rule
  // that draws a shadow there — `:hover`/`.selected` layer their own ring/
  // elevation on top (css/node.css) — and an inline `box-shadow` would beat
  // all of those class rules outright, silently hiding e.g. the selection
  // ring on a selected node with drop shadow on. Every one of those rules
  // instead reads `var(--node-extra-shadow, <its own baseline>)`, so
  // removing the property (rather than setting 'none') falls back to
  // whichever baseline is active instead of erasing it.
  if (node.dropShadow) {
    body.style.setProperty('--node-extra-shadow', 'var(--shadow-lg)');
  } else {
    body.style.removeProperty('--node-extra-shadow');
  }
  // Deliberately on `.node-body`, not `.node` — see core/project.js's
  // `opacity` field comment for why this has to compose independently of
  // Focus Mode/Diagram Animation's own class-based opacity on the outer
  // element rather than fight over the same property.
  body.style.opacity = Number.isFinite(node.opacity) ? String(node.opacity / 100) : '';
  // Same "custom property with a per-rule fallback" composition as
  // --node-extra-shadow above: removing the property (rather than setting
  // rotate(0deg) directly) lets the "note" shape's own CSS rule fall back
  // to its baked-in -1deg cosmetic tilt when the user hasn't set an
  // explicit rotation, instead of this always overriding it to upright.
  if (Number.isFinite(node.rotation) && node.rotation !== 0) {
    body.style.setProperty('--node-rotation', `${node.rotation}deg`);
  } else {
    body.style.removeProperty('--node-rotation');
  }
  // Also exposed as custom properties, read only by the diamond/hexagon
  // border fix below (css/node.css) — a plain CSS `border` doesn't follow
  // clip-path's polygon outline (it's still a rectangular border box
  // underneath, just cropped unevenly by the clip), so those two shapes
  // fake a border with two nested clipped layers instead and need the
  // fill/stroke colors and width available to a CSS rule, not just inline
  // JS-set border-* properties.
  body.style.setProperty('--node-fill', node.fill);
  body.style.setProperty('--node-stroke', node.stroke);
  body.style.setProperty('--node-border-width', `${node.strokeWidth}px`);
  // Also set on rootEl, not just body — the cuboid shape's pseudo-3D
  // faces (css/node.css) live on `.node` itself (not `.node-body`, which
  // clips them via its own `overflow: hidden`), and a custom property set
  // via inline style only cascades to *descendants* of the element it's
  // set on, not to that element's own siblings-under-a-different-parent —
  // same "set on rootEl too" pattern the destroy-marker below already uses.
  rootEl.style.setProperty('--node-fill', node.fill);
  rootEl.style.setProperty('--node-stroke', node.stroke);
  rootEl.style.setProperty('--node-border-width', `${node.strokeWidth}px`);

  const hasDestroyMarker = node.shape === 'lifeline' && Number.isFinite(node.destroyOffset);
  rootEl.classList.toggle('has-destroy-marker', hasDestroyMarker);
  if (hasDestroyMarker) {
    // Set on rootEl (not body) so it also cascades to .lifeline-destroy-marker,
    // a sibling of .node-body under root — see createNodeEl above.
    rootEl.style.setProperty('--destroy-y', `${node.h * node.destroyOffset}px`);
  }

  const hasFragmentTag = !!node.fragmentType;
  rootEl.classList.toggle('has-fragment-tag', hasFragmentTag);
  if (hasFragmentTag) {
    const tag = rootEl.querySelector('.fragment-tag');
    tag.textContent = node.fragmentType;
    // Set directly rather than via the --node-stroke CSS var (only defined
    // on .node-body, not this element — see the fixed --destroy-y bug
    // above for the same pitfall) — simpler than duplicating the var here.
    tag.style.background = node.stroke;
  }

  const activationsLayer = rootEl.querySelector('.lifeline-activations');
  clear(activationsLayer);
  if (node.shape === 'lifeline') {
    for (const act of node.activations || []) {
      const bar = el('div', {
        class: 'lifeline-activation',
        'data-activation-id': act.id,
        title: 'Drag to move, drag an end to resize, right-click to remove',
      });
      bar.style.top = `${node.h * act.startOffset}px`;
      bar.style.height = `${Math.max(0, node.h * (act.endOffset - act.startOffset))}px`;
      bar.appendChild(el('div', { class: 'activation-handle', 'data-edge': 'start' }));
      bar.appendChild(el('div', { class: 'activation-handle', 'data-edge': 'end' }));
      activationsLayer.appendChild(bar);
    }
  }

  // Skip rebuilding whichever part currently has a live inline rename
  // (startInlineEdit) in it — this whole function runs on every store
  // change anywhere in the app (any other node moving, an autosave tick,
  // ...), not just changes to this node, so without this guard a
  // concurrent unrelated dispatch would silently destroy the in-progress
  // <input> (and its unsaved text) out from under the user. The
  // colors/size/position updates above still apply either way; only the
  // content rebuild that would tear out the live <input> is skipped.
  const activeInlineEdit = rootEl.querySelector('.inline-edit-input');
  const editingInternalLabel = !!activeInlineEdit && body.contains(activeInlineEdit);
  const editingExternalLabel = !!activeInlineEdit && !editingInternalLabel;

  if (!editingInternalLabel) {
    clear(body);
    if (shrinkThumbnail) {
      body.appendChild(buildShrinkThumbnailBody(node, shrinkThumbnail));
    } else if (node.shape === 'rows') {
      body.appendChild(buildRowsBody(node));
    } else {
      body.appendChild(buildStandardBody(node));
    }
  }

  if (!editingExternalLabel) {
    updateExternalLabel(rootEl, node);
  }
}

const OUTSIDE_POSITIONS = ['above', 'below'];

function renameNode(node, value) {
  store.dispatch((draft) => {
    const n = draft.nodes.find((x) => x.id === node.id);
    if (n) n.text = value;
  });
}

/** A node's icon is either a user-uploaded image/SVG (`iconImage`, set via
 * the style editor's "Upload Icon" — see toolbar/styleEditor.js) or the
 * plain emoji `icon` field every component starts with; `iconImage` wins
 * when both are present. Returns null when no icon should render at all. */
function buildIconEl(node) {
  if (node.iconVisible === false) return null;
  if (node.iconImage) return el('img', { class: 'node-icon node-icon-image', src: node.iconImage, alt: '', draggable: false });
  if (node.icon) return el('div', { class: 'node-icon', text: node.icon });
  return null;
}

/** "Group & Shrink" anchor content: a small live composite of every member's
 * icon+color, scaled and arranged to preserve their real relative layout
 * (canvas/shrinkThumbnail.js), instead of the anchor's own normal face —
 * this is what actually gives an at-a-glance "here's what's grouped in
 * here" indication (see docs/ARCHITECTURE.md's "Group & Shrink miniature"
 * section for why the earlier "pristine node, frame only" design didn't).
 * Every piece is `pointer-events: none` (css/node.css), same as
 * `.node-standard`'s own icon/label, so drag/select/dblclick-rename still
 * land on the node itself rather than being eaten by this decorative
 * content. Purely visual/derived — nothing here is persisted. */
function buildShrinkThumbnailBody(node, { members, edges }) {
  const wrap = el('div', { class: 'node-shrink-thumbnail', title: `${members.length} components grouped — click the group frame's 🔍 to view them at full size` });
  const { boxes, lines } = computeShrinkThumbnail(members, edges, node.w, node.h);
  const svg = svgEl('svg', { class: 'node-shrink-thumbnail-svg', viewBox: `0 0 ${node.w} ${node.h}`, preserveAspectRatio: 'none' });
  for (const line of lines) {
    svg.appendChild(svgEl('line', { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2, class: 'node-shrink-thumb-edge' }));
  }
  for (const box of boxes) {
    svg.appendChild(svgEl('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 2, class: 'node-shrink-thumb-box', style: `fill:${box.fill};` }));
    if (box.icon) {
      const fontSize = Math.max(5, Math.min(box.h * 0.6, box.w * 0.6, 14));
      const icon = svgEl('text', {
        x: box.x + box.w / 2, y: box.y + box.h / 2 + fontSize * 0.35, 'text-anchor': 'middle',
        class: 'node-shrink-thumb-icon', style: `font-size:${fontSize}px;`,
      });
      icon.textContent = box.icon;
      svg.appendChild(icon);
    }
  }
  wrap.appendChild(svg);
  return wrap;
}

function buildStandardBody(node) {
  const position = node.textPosition || 'center';
  const wrap = el('div', { class: `node-standard pos-${position}` });
  const iconEl = buildIconEl(node);
  if (iconEl) wrap.appendChild(iconEl);

  if (!OUTSIDE_POSITIONS.includes(position)) {
    const label = el('div', { class: 'node-label', title: 'Double-click to rename' });
    label.textContent = node.text;
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineEdit(label, node.text, (value) => renameNode(node, value));
    });
    wrap.appendChild(label);
  }

  if (node.labels?.length) {
    wrap.appendChild(buildLabelChips(node));
  }

  if (Number.isFinite(node.monthlyCost)) {
    wrap.appendChild(el('div', { class: 'node-cost', title: 'Estimated monthly cost', text: `💲 ${formatMonthlyCost(node.monthlyCost)}/mo` }));
  }

  if (node.subComponents?.length) {
    wrap.appendChild(buildSubComponentsDisplay(node));
  }
  return wrap;
}

/** Small tag chips for node.labels (capacity/SLA/free-form notes like "10K
 * RPS" or "99.9% SLA") — set via the details panel's Labels field
 * (panel/detailsPanel.js#renderLabels). Kept visually distinct from
 * buildSubComponentsDisplay's chips (.node-subchip): labels describe the
 * whole node, sub-components are parts inside it. */
function buildLabelChips(node) {
  const wrap = el('div', { class: 'node-labels' });
  for (const label of node.labels.slice(0, 4)) {
    wrap.appendChild(el('span', { class: 'node-label-chip', text: label }));
  }
  if (node.labels.length > 4) wrap.appendChild(el('span', { class: 'node-label-chip more', text: `+${node.labels.length - 4}` }));
  return wrap;
}

function buildSubComponentsDisplay(node) {
  if (node.subComponentsDisplay === 'full') {
    const list = el('div', { class: 'node-subcomponents-full' });
    for (const sc of node.subComponents) {
      list.appendChild(el('div', { class: 'node-subcomponent-row', text: `${sc.icon || ''} ${sc.name}`.trim() }));
    }
    return list;
  }
  const chips = el('div', { class: 'node-subchips' });
  for (const sc of node.subComponents.slice(0, 4)) {
    chips.appendChild(el('span', { class: 'node-subchip', text: `${sc.icon || ''} ${sc.name}`.trim() }));
  }
  if (node.subComponents.length > 4) chips.appendChild(el('span', { class: 'node-subchip more', text: `+${node.subComponents.length - 4}` }));
  return chips;
}

/** For textPosition 'above'/'below': the label must live outside .node-body
 * (which has overflow:hidden to respect clip-path shapes) as a direct child
 * of the node root, or it would be clipped — see docs/ARCHITECTURE.md. */
function updateExternalLabel(rootEl, node) {
  const position = node.textPosition || 'center';
  let labelEl = rootEl.querySelector('.node-external-label');
  if (!OUTSIDE_POSITIONS.includes(position)) {
    labelEl?.remove();
    return;
  }
  if (!labelEl) {
    labelEl = el('div', { class: 'node-external-label', title: 'Double-click to rename' });
    labelEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    rootEl.appendChild(labelEl);
  }
  labelEl.classList.toggle('pos-above', position === 'above');
  labelEl.classList.toggle('pos-below', position === 'below');
  labelEl.textContent = node.text;
  labelEl.ondblclick = (e) => {
    e.stopPropagation();
    startInlineEdit(labelEl, node.text, (value) => renameNode(node, value));
  };
}

function buildRowsBody(node) {
  const wrap = el('div', { class: 'node-rows' });
  const header = el('div', { class: 'node-rows-header' });
  const rowsIconEl = buildIconEl(node);
  if (rowsIconEl) header.appendChild(rowsIconEl);
  const label = el('span', { class: 'node-label', text: node.text, title: 'Double-click to rename' });
  label.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    startInlineEdit(label, node.text, (value) => {
      store.dispatch((draft) => {
        const n = draft.nodes.find((x) => x.id === node.id);
        if (n) n.text = value;
      });
    });
  });
  header.appendChild(label);
  wrap.appendChild(header);

  const list = el('div', { class: 'node-rows-list' });
  (node.rows || []).forEach((row, idx) => {
    const item = el('div', { class: 'row-item' });
    const text = el('span', { class: 'row-text', text: row, title: 'Double-click to rename' });
    text.addEventListener('pointerdown', (e) => e.stopPropagation());
    text.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineEdit(text, row, (value) => {
        store.dispatch((draft) => {
          const n = draft.nodes.find((x) => x.id === node.id);
          if (n) n.rows[idx] = value;
        });
      });
    });
    const del = el('button', {
      class: 'row-delete',
      type: 'button',
      text: '×',
      'aria-label': 'Remove row',
      onClick: (e) => {
        e.stopPropagation();
        store.dispatch((draft) => {
          const n = draft.nodes.find((x) => x.id === node.id);
          if (n) n.rows.splice(idx, 1);
        });
      },
    });
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    item.appendChild(text);
    item.appendChild(del);
    list.appendChild(item);
  });
  wrap.appendChild(list);

  const addBtn = el('button', {
    class: 'node-add-row',
    type: 'button',
    text: '+ Add row',
    onClick: (e) => {
      e.stopPropagation();
      store.dispatch((draft) => {
        const n = draft.nodes.find((x) => x.id === node.id);
        if (n) n.rows.push(`Row ${n.rows.length + 1}`);
      });
    },
  });
  addBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.appendChild(addBtn);
  return wrap;
}

/** Swaps `labelEl` for a text `<input>` pre-filled with `currentValue`,
 * committing the trimmed result to `onCommit` on Enter/blur (a no-op if
 * unchanged/empty) or discarding on Escape — the shared "click text to
 * rename it in place" mechanism used for node labels, sub-component rows,
 * and (see canvas.js#renderGroupBackgrounds) a group's own name. Exported
 * so canvas.js can reuse the exact same interaction/edge-cases rather than
 * re-implementing them for a group label. */
export function startInlineEdit(labelEl, currentValue, onCommit) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit-input';
  input.value = currentValue;
  labelEl.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    // Restore the DOM *before* committing, not after: onCommit() dispatches
    // synchronously, which synchronously re-renders every node (see
    // updateNodeEl's "skip while an inline edit is live" guard) — if the
    // <input> were still in the DOM at that point, that guard would (wrongly)
    // still think this label is mid-edit and skip rebuilding it with the
    // freshly-committed text, leaving the stale pre-edit label visible.
    input.replaceWith(labelEl);
    if (commit && input.value.trim() && input.value !== currentValue) onCommit(input.value.trim());
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
    e.stopPropagation();
  });
  input.addEventListener('pointerdown', (e) => e.stopPropagation());
  input.addEventListener('blur', () => finish(true));
}

export const NODE_HANDLE_IDS = HANDLES;
export const NODE_SIDE_IDS = SIDES;
