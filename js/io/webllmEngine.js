// In-browser LLM inference for "Local AI" mode — the one AI-assisted
// sending mode with no key, no account, and no server at all: a small
// open model (Llama/Qwen, see io/aiProviderKeys.js#LOCAL_MODEL_CHOICES)
// runs entirely inside this browser tab via WebGPU, using the vendored
// @mlc-ai/web-llm engine (see vendor/VENDOR.md for exactly what's vendored
// and what genuinely can't be: the model weights and WASM runtime, fetched
// from Hugging Face / GitHub on first use and cached by the browser after
// that — this is the one feature in this app that needs a connection the
// first time, even though the app as a whole works offline).
//
// Loaded as a real ES module (`import()` of a local vendor path), unlike
// this app's other vendored libraries (html2canvas/jsPDF/PptxGenJS), which
// are classic UMD `<script>` tags loaded via utils/loadScript.js — WebLLM
// ships only as an ES module, so a plain dynamic import is both simpler
// and the only option.
//
// WebGPU is required (no WASM-only fallback here — CPU inference for a
// model this size would be impractically slow for an interactive tool).
// Chrome/Edge 113+, Chrome for Android 121+, Safari 26+, and Firefox 141+
// on Windows support it as of this writing; everywhere else, or with it
// disabled, `isWebGpuSupported()` returns false and callers should point
// the user at Copy/Paste or Direct API mode instead.

const VENDOR_PATH = new URL('../../vendor/web-llm.min.js', import.meta.url).href;

let modulePromise = null;
let enginePromise = null;
let currentModelId = null;

export function isWebGpuSupported() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

function loadWebLlmModule() {
  if (!modulePromise) modulePromise = import(VENDOR_PATH);
  return modulePromise;
}

/** Creates (or reuses/reloads) the shared engine instance for `modelId`,
 * reporting download/init progress via `onProgress({ progress, text })` —
 * WebLLM's own callback shape, passed through unchanged. Resolves once the
 * model is fully loaded and ready to generate.
 *
 * On failure, resets `enginePromise`/`currentModelId` back to null rather
 * than leaving the rejected promise cached — this is a multi-GB network
 * download, where a transient failure (dropped connection, one bad byte)
 * is a real, expected possibility, and without this reset every retry
 * after the first failure would immediately re-reject with the exact same
 * cached error forever, with no way to recover short of reloading the
 * whole page. */
async function ensureEngine(modelId, onProgress) {
  const webllm = await loadWebLlmModule();
  if (enginePromise && currentModelId === modelId) return enginePromise;

  const previousEnginePromise = enginePromise;
  currentModelId = modelId;

  enginePromise = (previousEnginePromise
    ? previousEnginePromise.then((engine) => engine.reload(modelId, undefined, { initProgressCallback: onProgress }).then(() => engine))
    : webllm.CreateMLCEngine(modelId, { initProgressCallback: onProgress })
  ).catch((err) => {
    currentModelId = null;
    enginePromise = null;
    throw err;
  });

  return enginePromise;
}

/** Settings' "⬇️ Preload model" button — downloads/initializes a model
 * ahead of time so the first real "Send" isn't a surprise multi-GB wait.
 * Same {ok, error} contract as io/aiDirectCall.js#sendPromptDirect, for
 * the settings UI's error toast to reuse unchanged. */
export async function preloadLocalModel(modelId, onProgress) {
  if (!isWebGpuSupported()) return { ok: false, error: "This browser doesn't support WebGPU — try Chrome or Edge on desktop, or use Copy/Paste or Direct API mode instead." };
  try {
    await ensureEngine(modelId, onProgress);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Couldn't load the model: ${err.message || err}` };
  }
}

/**
 * @param {{modelId: string, prompt: string, onProgress?: (report: {progress:number, text:string}) => void}} input
 * @returns {Promise<{ok:true, text:string}|{ok:false, error:string}>}
 */
export async function generateLocal({ modelId, prompt, onProgress } = {}) {
  if (!isWebGpuSupported()) return { ok: false, error: "This browser doesn't support WebGPU — try Chrome or Edge on desktop, or use Copy/Paste or Direct API mode instead." };
  let engine;
  try {
    engine = await ensureEngine(modelId, onProgress);
  } catch (err) {
    return { ok: false, error: `Couldn't load the model: ${err.message || err}` };
  }
  try {
    const reply = await engine.chat.completions.create({ messages: [{ role: 'user', content: prompt }] });
    const text = reply.choices?.[0]?.message?.content || null;
    if (!text) return { ok: false, error: 'The local model responded, but with no readable text — try again.' };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `The local model failed to respond: ${err.message || err}` };
  }
}
