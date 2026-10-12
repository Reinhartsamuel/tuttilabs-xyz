/**
 * Shared page chrome for generated post pages.
 *
 * The header and footer markup here is duplicated (deliberately, in plain HTML)
 * in index.html, work/index.html and writing/index.html so those pages render
 * without JavaScript. gen-posts.mjs warns if the copies drift apart.
 */

export const FONT_LINKS = `    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" />`;

export const HEADER = `  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="/">tuttilabs<span class="brand-dim">.xyz</span></a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">menu</button>
      <nav class="nav" id="site-nav">
        <a href="/work/">Work</a>
        <a href="/writing/">Writing</a>
        <a href="https://github.com/Reinhartsamuel">GitHub</a>
        <a href="https://www.linkedin.com/in/reinhartsulilatu">LinkedIn</a>
        <a href="https://x.com/reyyn_hart">X</a>
      </nav>
    </div>
  </header>`;

export const FOOTER = `  <footer class="site-footer">
    <div class="wrap">
      <div>© <span data-year>2026</span> Reinhart Sulilatu</div>
      <div class="footer-links">
        <a href="https://github.com/Reinhartsamuel">github.com/Reinhartsamuel</a>
        <a href="https://www.linkedin.com/in/reinhartsulilatu">linkedin.com/in/reinhartsulilatu</a>
        <a href="https://x.com/reyyn_hart">x.com/reyyn_hart</a>
        <a href="mailto:smuel.rr@gmail.com">smuel.rr@gmail.com</a>
      </div>
    </div>
  </footer>`;

const escape = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Full document for a writing post. */
export function postPage({ title, summary, canonical, mainHtml }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(title)} — tuttilabs.xyz</title>
    <meta name="description" content="${escape(summary)}" />
    <link rel="canonical" href="${escape(canonical)}" />
    <meta name="color-scheme" content="dark" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
${FONT_LINKS}
    <link rel="stylesheet" href="/src/styles/main.css" />
  </head>
  <body>
${HEADER}
    <main>
${mainHtml}
    </main>
${FOOTER}
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}
