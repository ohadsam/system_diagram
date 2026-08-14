const loaded = new Set();

/** Load a classic <script> once (idempotent), resolving when it's ready. */
export function loadScriptOnce(src) {
  if (loaded.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      loaded.add(src);
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      loaded.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
