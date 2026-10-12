# tuttilabs.xyz

Source for my portfolio and writing site. Static output, Vite + TypeScript, no
UI framework: the pages are hand-written HTML, and a small build script turns
markdown into writing pages.

## What is in here

```
index.html              landing page (who I am, links, recent writing)
work/index.html         project detail: deployments, addresses, design notes
writing/index.html      writing index; the post list is injected at build time
writing/<slug>/         generated post pages (gitignored — built, not committed)
posts.config.json       markdown sources that live outside this repo
src/content/posts/      markdown posts authored here
src/styles/main.css     the whole stylesheet
src/main.ts             mobile nav, copy-address buttons, footer year
scripts/gen-posts.mjs   markdown -> static pages, post lists, sitemap
scripts/deploy.sh       build + publish to nginx + certbot
deploy/nginx/           the vhost this site is served from
```

## Commands

```bash
npm install
npm run dev        # regenerates posts, then serves on :5173
npm run build      # gen + tsc --noEmit + vite build  -> dist/
npm run preview    # serve dist/ locally
npm run deploy     # build, rsync to /var/www/tuttilabs, reload nginx, certbot
```

`npm run build` is the acceptance gate: it fails if the TypeScript does not
typecheck, and `scripts/gen-posts.mjs` warns loudly if a post source is missing
or if the header/footer markup in the static pages has drifted from
`scripts/shell.mjs`.

## Writing a post

Two ways, both end up as a static page at `/writing/<slug>/`:

1. **Local post.** Add `src/content/posts/<slug>.md` with frontmatter:

   ```markdown
   ---
   title: Some title
   date: 2026-10-12
   summary: One or two sentences.
   ---

   Body in markdown.
   ```

2. **A draft that lives somewhere else.** Add an entry to `posts.config.json`
   under `sources` with `slug`, `title`, `date`, `summary`, `sourceFile`
   (absolute path) and `sourceNote`. The draft stays the single source of truth;
   the build reads it and renders the page. Nothing is copied by hand, so the
   site and the draft cannot drift apart.

Posts are sorted newest first. The list on `writing/index.html` and the recent
list on the landing page are injected between HTML comment markers, so both
pages work without JavaScript.

## Deployment

Served by the nginx already on this VPS, root `/var/www/tuttilabs`, vhost
`deploy/nginx/tuttilabs.xyz`. The apex and `www` share one server block. The
`cuantum.tuttilabs.xyz` API proxy and the winr vhost are separate files and are
not touched.

TLS is issued with certbot (`--nginx`, HTTP-01). That needs both names to resolve
to this host first, and the Cloudflare records must be **DNS only** (grey cloud)
for the first issuance. `scripts/deploy.sh` prints the exact records to create
when they are missing, and skips certbot rather than failing.

## Notes

- No analytics, no tracking, no external requests except Google Fonts (Geist).
- No gradients, no glow, no decorative colour. The only accent in the stylesheet
  is the green dot used to mark live contracts.
- Nothing here reads environment files or key material.
