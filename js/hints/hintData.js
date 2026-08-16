// Short guided-tour hints shown once (in order), each dismissible forever.
// Add a new hint any time by appending an object here — no other code
// needs to change.
export const HINTS = [
  { id: 'hint-sidebar-search', target: '.sidebar-search input', placement: 'right', text: 'Search the component library, or browse the categories below — click any category to expand it.' },
  { id: 'hint-sidebar-drag', target: '.sidebar-categories', placement: 'right', text: 'Drag any component onto the canvas. On touch (or if you just want it centered), a single tap drops it in the middle of the view.' },
  { id: 'hint-layers-patterns', target: '.sidebar-categories', placement: 'right', text: 'Tip: the "Layers & Roles" category (Controller, Service, DAL, ...) can be dragged onto a component to attach it there. "Design Patterns" drops a whole ready-made cluster (MVC, CQRS, API Gateway, ...) at once.' },
  { id: 'hint-canvas-pan-zoom', target: '.canvas-viewport', placement: 'top', text: 'Drag empty canvas to select, Ctrl/Cmd + scroll (or the zoom buttons) to zoom, and scroll to pan.' },
  { id: 'hint-nav-tools', target: '.toolbar-row-main', placement: 'bottom', text: '🖱️ Select and ✋ Hand switch how dragging behaves — Hand pans the canvas no matter what you drag over, without moving anything (shortcuts: H / V, or just hold Space).' },
  { id: 'hint-node-connect', target: '.toolbar-row-main', placement: 'bottom', text: 'Select a component to reveal small dots on its edges — drag from a dot to another component to draw a connector.' },
  { id: 'hint-toolbar-style', target: '.toolbar-row-main', placement: 'bottom', text: 'Selecting a component or connector reveals its style controls (colors, shape, text, arrows and more) in a small card next to it — click 📌 on it to pin it to the top of the screen instead.' },
  { id: 'hint-node-info', target: '.toolbar-row-main', placement: 'bottom', text: 'Click the ⓘ button on any component to add notes, labels and sub-components. Components with extra info show a small dot badge.' },
  { id: 'hint-autosave', target: '.toolbar-row-main', placement: 'bottom', text: 'Your diagram autosaves in this browser as you work. Use "Save As" for named versions, or export to JSON/PNG/PDF any time.' },
];
