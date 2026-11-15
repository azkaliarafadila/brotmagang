# InternHub — GitHub Pages Edition

Static-site edition of the internship tracker. Publish `index.html`, `styles.css`, `static-adapter.js`, and `app.js` at a GitHub Pages repository root.

## Privacy, limitations

- No backend, no server-side logins, no automated applications, no email notifications, no AI job discovery.
- Job pipeline, profile, and approval activity are stored **only in this browser's localStorage**. They do **not sync** to other devices or browsers. Clearing site data loses them. Use the export button frequently to save backup JSON.
- The CV picker reads the selected file locally and saves only its name, size, and SHA-256 fingerprint. The actual CV is **not stored** by this static website. For a real job application, attach the file manually on the employer's site.
- PDF/DOCX content is not automatically extracted; complete your candidate profile manually. TXT files have very basic extraction.
- An approval YES only prepares a data pack and is **never an employer submission**. An applied status is self-recorded with evidence.
- GitHub Pages hosting on GitHub Free requires a public repository. **Do not upload CVs, passwords, personal application exports, or secrets to the repository.**

## Publish steps

1. Create a new **Public** repository, e.g. `internhub-pages` (keep the old `intern` repository private).
2. Upload the **four website files** from this folder to the repository root, not the ZIP file itself.
3. Commit changes.
4. Go to repository **Settings → Pages** and choose **Deploy from a branch**; select `main` and `/(root)` and save.
5. After the GitHub Pages deployment succeeds, visit `https://YOUR_GITHUB_USERNAME.github.io/internhub-pages/`.

## Run without GitHub Pages

Open `index.html` locally in a browser. It works without a Python server; browser storage must be allowed.
