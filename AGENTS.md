# AGENTS.md

## Project

This is a static personal website. The main entry is `index.html`, with feature pages:

- `photo.html`
- `days.html`
- `message.html`
- `game.html`
- `pet.html`
- `drinkgame.html`
- `video.html`

The homepage uses a light frosted-glass visual system, scroll-driven text, and fixed image layers. Feature pages should keep the same light glass shell while preserving their existing functionality.

## Development Rules

- Keep changes scoped to the requested behavior.
- Preserve existing COS login/register and data logic unless the user explicitly asks to change it.
- Do not reintroduce the old sea-room homepage or old sea living-room page background.
- Do not use the old `assets/work/video-fast.webp`; the current academy image is `assets/work/nuonuo-academy.webp`.
- When adding image assets, store final project assets under `assets/`.
- Prefer WebP for generated homepage assets when practical.
- Keep mobile layouts free of text/image overlap.

## Local Testing

Run a local static server from the project root:

```powershell
python -m http.server 8791 --bind 127.0.0.1
```

Then test:

- `http://127.0.0.1:8791/index.html`
- all seven feature pages
- desktop and mobile viewports
- protected homepage entries: `game.html` and `pet.html`
- login/register modal behavior

Useful static checks:

```powershell
rg -n "sea-living-room|video-fast|视频快放|07 / 07|kicker|copy-opacity" index.html photo.html days.html message.html game.html pet.html drinkgame.html video.html
```

This search should normally return no matches for homepage/page-shell cleanup work.

## GitHub Sync

After local file changes, sync corresponding code to GitHub:

- Repository: `nuonuoruo/nuonuo`
- Branch: `main`

If the local folder is not a git repository, use a temporary clone, copy changed files into it, commit, and push to `main`.

Use clear commit messages, for example:

```text
Update homepage scroll interaction
Update glass shell pages
```

## Notes

- This site is static HTML/CSS/JS.
- Some pages include client-side COS credentials and auth logic; do not refactor this casually.
- `video.html` is currently branded as `nuonuo学堂` while keeping the local video playback feature.
