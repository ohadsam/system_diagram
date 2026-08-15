// Single source of truth for the app version, shown in the "What's New"
// modal (see io/whatsNew.js). Bump APP_VERSION and add an entry here with
// every user-facing fix or feature — the modal shows entries newer than
// whatever version the visitor last saw.
export const APP_VERSION = '1.3.0';

export const VERSION_HISTORY = [
  {
    version: '1.3.0',
    date: '2026-08-15',
    highlights: [
      'New "Duplicate Project" (📄) — clone the whole diagram into a new, independent project in one click; the original stays exactly as it was.',
      'New "Duplicate entire canvas" (right-click the canvas) — copies every component and connector in place, within the same project.',
      'New "🤖 AI Design Review" panel — prepares a review prompt and your diagram as an image, then opens Claude/ChatGPT/Gemini/Copilot\'s own website (no API key or setup needed) so you can paste them in and get a review; optionally attach a spec file to compare against, and paste the AI\'s reply back into the panel to keep it with your project.',
    ],
  },
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
