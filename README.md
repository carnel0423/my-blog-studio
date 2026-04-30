# My Blog Studio

Static blog studio + public blog view.

## Pages

- `index.html`: public blog page (for readers)
- `studio.html`: editor page (for authoring)

## Public update flow

1. Open `studio.html`
2. Edit/save posts (`status = 公開`)
3. Click `公開` (first time only: GitHub token/setup prompts)
4. Wait for GitHub Pages to rebuild (usually under 1 minute)

Token note:
- Use a fine-grained token with repository `Contents: Read and write`.
- The token is saved in browser localStorage on your machine.

## Files

- `index.html` (public view)
- `studio.html` (editor)
- `styles.css`
- `script.js` (editor logic)
- `published.js` (public page logic)
- `published-data.json` (public data source)
- `published.html` (legacy redirect to `index.html`)
