// Single source of truth for the app version, shown in the "What's New"
// modal (see io/whatsNew.js). Bump APP_VERSION and add an entry here with
// every user-facing fix or feature — the modal shows entries newer than
// whatever version the visitor last saw.
export const APP_VERSION = '1.2.0';

export const VERSION_HISTORY = [
  {
    version: '1.2.0',
    date: '2026-08-14',
    highlights: [
      'New "What\'s New" screen (this one!) that appears once after each update.',
      'New "State Machines" component category: states, transitions and conditions, plus ready-made templates (traffic light, order lifecycle, TCP states, and more).',
      'Zoom in/out/reset now also works from the keyboard (Ctrl/Cmd + "+"/"-"/"0"), alongside the existing buttons and Ctrl/Cmd+scroll.',
      'Select multiple components and connectors together to edit, duplicate, or delete them as one — plus a new Group/Ungroup action.',
      'New "🪄 Magic Arrow" — an auto-routed connector that finds its own path between two components, automatically avoiding every other component in the way.',
      'Confirmed: deleting a component always removes every connector attached to it, with no leftovers.',
    ],
  },
];
