# CrowdChoreo project page

A static academic project page for **CrowdChoreo: A Large-Scale Text-Annotated Dataset for Group Dance**. The page introduces the project and its pipeline, followed by five interactive dataset examples with synchronized text annotations, a model section, and generation results.

The arXiv and Data resources are marked **Coming soon** until their URLs are available. GitHub links to this repository. Pipeline, model architecture, and generation results have reserved placeholders.

The dataset release contains skeleton data only. RGB clips on this page serve as visual references. Skeletons use the stored joints with monochrome rendering. Emotion, formation, and temporal action descriptions accompany each example.

## Publish with GitHub Pages

1. Create a GitHub repository with `main` as its default branch.
2. Add the contents of this project folder to the repository root, including the hidden `.github` directory. Keep `dist/` intact.
3. Open **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**.
4. Push to `main`, or run **Deploy project page to GitHub Pages** from the **Actions** tab.

The included workflow publishes `dist/` directly, with no build step or package installation. The deployed URL appears in the workflow and Pages settings, usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. All site assets use relative paths, so repository subpaths work.

See GitHub's instructions for [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [selecting GitHub Actions as the publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Preview locally

```bash
python start_local.py
```

Open `http://localhost:8876/` on the same computer. For a different port, use `python start_local.py --port 8000`. When running on a remote machine, forward that port through your SSH client or editor first. For offline viewing, open `dist/index.html` directly.

## Edit the page

- `dist/index.html`: the four-sentence project introduction, resource links, pipeline, nested dataset examples and text annotations, model, and generation results. Replace the placeholders with verified diagrams, results, and URLs when available.
- `dist/academic.css` and `dist/style.css`: appearance and responsive layout.
- `dist/app.js`: playback, skeleton rendering, and annotation controls.
- `dist/data.js` and `dist/assets/`: the five examples, skeleton trajectories, reference clips, and annotations.

Place new figures in `dist/assets/` and reference them with relative URLs, such as `assets/pipeline.png`. No backend or external data service is required.

The third example displays **triangle** through a website-only override in `app.js`; the original dataset annotations remain unchanged. The first example remains **A duet in motion**.

Keyboard controls: **Space** plays or pauses, **← / →** steps through frames, and **1–5** selects an example.
