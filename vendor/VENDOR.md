# Vendored libraries

This app is otherwise 100% hand-written vanilla JS. These two files are
the only exceptions, used solely for PNG/PDF export, and are loaded lazily
(only when the user actually clicks Export PNG/PDF) rather than on page
load.

They are vendored locally (not loaded from a CDN) so the app works fully
offline/air-gapped on GitHub Pages with no third-party network dependency
or SRI-hash maintenance burden.

| File                     | Library    | Version | License | Source |
|--------------------------|-----------|---------|---------|--------|
| `html2canvas.min.js`     | html2canvas | 1.4.1 | MIT | https://github.com/niklasvh/html2canvas |
| `jspdf.umd.min.js`       | jsPDF       | 2.5.2 | MIT | https://github.com/parallax/jsPDF |

Both are the official pre-built UMD/minified distributables from the
package's npm `dist/` folder, copied unmodified. To upgrade: `npm pack
html2canvas@<version>` / `npm pack jspdf@<version>` elsewhere, take the
`dist/html2canvas.min.js` / `dist/jspdf.umd.min.js` file, and replace here.
