# Vendored libraries

This app is otherwise 100% hand-written vanilla JS. These three files are
the only exceptions, used solely for PNG/PDF/PPTX export, and are loaded
lazily (only when the user actually clicks Export PNG/PDF or exports a
presentation to PowerPoint) rather than on page load.

They are vendored locally (not loaded from a CDN) so the app works fully
offline/air-gapped on GitHub Pages with no third-party network dependency
or SRI-hash maintenance burden.

| File                     | Library    | Version | License | Source |
|--------------------------|-----------|---------|---------|--------|
| `html2canvas.min.js`     | html2canvas | 1.4.1 | MIT | https://github.com/niklasvh/html2canvas |
| `jspdf.umd.min.js`       | jsPDF       | 2.5.2 | MIT | https://github.com/parallax/jsPDF |
| `pptxgen.bundle.js`      | PptxGenJS   | 3.12.0 | MIT | https://github.com/gitbrent/PptxGenJS |

All three are the official pre-built UMD/minified/bundled distributables
from the package's npm `dist/` folder, copied unmodified. To upgrade:
`npm pack html2canvas@<version>` / `npm pack jspdf@<version>` / `npm pack
pptxgenjs@<version>` elsewhere, take the `dist/html2canvas.min.js` /
`dist/jspdf.umd.min.js` / `dist/pptxgen.bundle.js` file, and replace here.

`pptxgen.bundle.js` specifically is PptxGenJS's **standalone bundle**
(JSZip bundled inside, exposed as `window.PptxGenJS`) rather than its
`pptxgen.min.js` + separate `jszip.min.js` two-file form — one script tag
to vendor and load instead of two, at the cost of a larger single file.
