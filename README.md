# My Blog Studio

Static blog studio + public blog view.

## Pages

- `docs/index.html`: public blog page (for readers, deployed by GitHub Pages)
- `studio.html`: editor page (for authoring, local use)

## Public update flow

1. Open `studio.html`
2. Edit/save posts (`status = 公開`)
3. Click `公開` (first time only: GitHub token/setup prompts)
4. Wait for GitHub Pages to rebuild (usually under 1 minute)

Token note:
- Use a fine-grained token with repository `Contents: Read and write`.
- The token is saved in browser localStorage on your machine.

Security note:
- GitHub Pages source is `main` branch `/docs`, so `studio.html` and `script.js` are not publicly hosted.
- Public readers can access only the published site and published data under `/docs`.
- Even if `studio.html` is reached on a hosted URL, the editor auto-redirects / blocks editing on `github.io`.

## Files

- `index.html` (public view)
- `docs/index.html` (actual GitHub Pages public source)
- `studio.html` (editor)
- `styles.css`
- `script.js` (editor logic)
- `published.js` (public page logic)
- `published-data.json` (public data source)
- `published.html` (legacy redirect to `index.html`)
