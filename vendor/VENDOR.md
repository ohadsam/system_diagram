# Vendored libraries

This app is otherwise 100% hand-written vanilla JS. These seven files are
the only exceptions, and are loaded lazily — the first three only when the
user actually clicks Export PNG/PDF or exports a presentation to
PowerPoint, the fourth only when someone opts into Settings -> AI
Providers -> Local AI (in-browser), the fifth only when someone picks the
"quick room code" connection method in the Live Collaboration modal, the
sixth only when someone opens Tools -> 3D Presentation, the seventh only
when someone opens the 📱 Remote Control panel in Presenter Mode — rather
than on page load.

They are vendored locally (not loaded from a CDN) so the app works fully
offline/air-gapped on GitHub Pages with no third-party network dependency
or SRI-hash maintenance burden.

| File                     | Library    | Version | License | Source |
|--------------------------|-----------|---------|---------|--------|
| `html2canvas.min.js`     | html2canvas | 1.4.1 | MIT | https://github.com/niklasvh/html2canvas |
| `jspdf.umd.min.js`       | jsPDF       | 2.5.2 | MIT | https://github.com/parallax/jsPDF |
| `pptxgen.bundle.js`      | PptxGenJS   | 3.12.0 | MIT | https://github.com/gitbrent/PptxGenJS |
| `web-llm.min.js`         | @mlc-ai/web-llm | 0.2.84 | Apache-2.0 | https://github.com/mlc-ai/web-llm |
| `peerjs.min.js`          | PeerJS      | 1.5.4 | MIT | https://github.com/peers/peerjs |
| `three.module.min.js`    | three.js    | 0.160.0 | MIT | https://github.com/mrdoob/three.js |
| `qrcode.js`              | qrcode-generator | 1.4.4 | MIT | https://github.com/kazuhikoarase/qrcode-generator |

The first three are the official pre-built UMD/minified/bundled
distributables from the package's npm `dist/` folder, copied unmodified.
To upgrade: `npm pack html2canvas@<version>` / `npm pack jspdf@<version>` /
`npm pack pptxgenjs@<version>` elsewhere, take the
`dist/html2canvas.min.js` / `dist/jspdf.umd.min.js` /
`dist/pptxgen.bundle.js` file, and replace here.

`pptxgen.bundle.js` specifically is PptxGenJS's **standalone bundle**
(JSZip bundled inside, exposed as `window.PptxGenJS`) rather than its
`pptxgen.min.js` + separate `jszip.min.js` two-file form — one script tag
to vendor and load instead of two, at the cost of a larger single file.

`web-llm.min.js` is different from the other three in two ways. First,
`@mlc-ai/web-llm` ships only as a single ES module (`lib/index.js`, ~6.6MB,
already a rolled-up bundle with no bare-specifier imports to resolve) with
no separate minified build — `npx esbuild lib/index.js --minify
--format=esm --banner:js="..."` was run once here to shrink it to ~5.8MB
before vendoring, keeping its license banner; `js/io/webllmEngine.js`
loads it via a local `import()` (an ES module, not a classic `<script>`
tag like the UMD libraries above) rather than `utils/loadScript.js`.
Second, and unavoidably: this file is only the *inference engine* — the
actual model weights (1-2.5 GB depending on which one you pick in
Settings) and their WASM runtime are fetched on first use from
`huggingface.co/mlc-ai/*` and
`raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs`, pinned to this
exact engine version (`v0_2_84`) inside the bundle itself. That part
genuinely cannot be vendored — it's the model itself, not a dependency of
this app's code — so Local AI mode is the one feature in this app that
requires an internet connection the first time it's used, even though the
app as a whole works offline. The browser caches those downloads itself
(Cache Storage/IndexedDB, managed by WebLLM) so every use after the first
is fully offline. To upgrade: `npm pack @mlc-ai/web-llm@<version>`
elsewhere, minify `lib/index.js` the same way, and update the curated
`LOCAL_MODEL_CHOICES` list in `js/io/aiProviderKeys.js` against whatever
model IDs the new version's `prebuiltAppConfig.model_list` actually
contains — don't assume old IDs still exist.

`peerjs.min.js` is the official pre-built minified UMD distributable from
the package's npm `dist/` folder (`dist/peerjs.min.js`), copied unmodified
except for stripping its trailing `//# sourceMappingURL=...` comment (the
matching `.map` file isn't vendored, so the reference would just be a
broken request). It sets `window.Peer`. Used only by
`js/collab/peerjsCollab.js` for the "quick room code" live-collaboration
connection method (`js/collab/webrtcCollab.js`'s manual code-exchange
method needs no library at all — just the browser's native
`RTCPeerConnection`/`RTCDataChannel`); PeerJS's own free public broker
(`0.peerjs.com`) is what lets two browsers find each other by a short room
code with no signaling server of this app's own. To upgrade: `npm pack
peerjs@<version>` elsewhere, take `dist/peerjs.min.js`, strip the same
sourcemap comment, and replace here.

`three.module.min.js` is different from every file above: it's the
official pre-built **ES module** distributable (`build/three.module.min.js`
from the npm package), not a UMD/global-setting script — this app's own
`js/render3d/scene3dRenderer.js` uses a real `import * as THREE from
'../../vendor/three.module.min.js'`, the same plain-ES-module mechanism as
every hand-written file here, rather than `utils/loadScript.js`'s
`<script>`-tag loader the UMD libraries above need. Used only by the "🧊 3D
Presentation" feature (Tools menu) — turns the current diagram into an
interactive, rotatable 3D scene (extruded boxes for components, tube-
-geometry "cables" for connectors) purely for presentation flair; the
underlying 2D project data is completely unaffected. To upgrade: `npm pack
three@<version>` elsewhere, take `build/three.module.min.js`, replace here
unmodified (it needs no minification step of its own, unlike web-llm.min.js
above).

`qrcode.js` is the package's plain classic script (`qrcode.js`, not the
`qrcode_UTF8.js`/`qrcode_SJIS.js` variants, which add encoding tables this
app doesn't need since it only ever encodes a plain-ASCII `remote.html?code=`
URL) from the npm `qrcode-generator` package, copied unmodified — it sets a
top-level `var qrcode = ...` global despite predating the UMD pattern (a
classic, non-module `<script>` tag's top-level `var` is itself already a
global, so no wrapper was needed). Used only by
`js/collab/presenterRemote.js`'s "📱 Remote Control" panel (Presenter Mode)
to render a QR code encoding a link to `remote.html` — scanning it with a
phone opens a big-button Prev/Next remote that drives the presenter's own
Diagram Animation playback over the same PeerJS room-code connection
Live Collaboration already uses. To upgrade: `npm pack
qrcode-generator@<version>` elsewhere, take `qrcode.js`, replace here
unmodified.
