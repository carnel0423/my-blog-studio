# My Blog Studio

Static blog studio + public blog view.

## Pages

- `index.html`: public blog page (for readers)
- `studio.html`: editor page (for authoring)

## Public update flow

1. Open `studio.html`
2. Edit/save posts (`status = 公開`)
3. Click `公開データ出力` to export `published-data.json`
4. Replace repository `published-data.json` with the exported file
5. Push to `main` (GitHub Pages reflects it publicly)

## Files

- `index.html` (public view)
- `studio.html` (editor)
- `styles.css`
- `script.js` (editor logic)
- `published.js` (public page logic)
- `published-data.json` (public data source)
- `published.html` (legacy redirect to `index.html`)
