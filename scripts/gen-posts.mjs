#!/usr/bin/env node
/**
 * Build-time blog generator.
 *
 * Reads posts.config.json (external drafts) plus src/content/posts/*.md (local
 * posts), renders markdown to HTML, writes a static page per post under
 * writing/<slug>/index.html, and injects the post lists into writing/index.html
 * and index.html between the POSTS/RECENT markers.
 *
 * No runtime fetch, no client-side router: the output is plain static HTML.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { HEADER, FOOTER, postPage } from './shell.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(readFileSync(join(root, 'posts.config.json'), 'utf8'))

const SITE = 'https://tuttilabs.xyz'
const warnings = []

const log = (msg) => console.log(`[gen-posts] ${msg}`)
const warn = (msg) => {
  warnings.push(msg)
  console.warn(`[gen-posts] warning: ${msg}`)
}

/* ---------- markdown ---------- */

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section'

/** marked v5+ dropped header ids; re-add them so posts can be deep-linked. */
function withHeadingIds(html) {
  const seen = new Map()
  return html.replace(/<h([23])>(.*?)<\/h\1>/g, (_match, level, inner) => {
    const text = inner.replace(/<[^>]+>/g, '')
    const base = slugify(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return { data: {}, body: raw }
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return { data: {}, body: raw }
  const block = raw.slice(3, end).trim()
  const body = raw.slice(raw.indexOf('\n', end + 1) + 1)
  const data = {}
  for (const line of block.split('\n')) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim())
    if (!match) continue
    let value = match[2].trim()
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1)
    data[match[1]] = value
  }
  return { data, body }
}

function stripLeadingH1(body) {
  const match = /^\s*#\s+(.+?)\s*\n/.exec(body)
  if (!match) return { title: null, body }
  return { title: match[1].replace(/\s+$/, ''), body: body.slice(match[0].length) }
}

const readTime = (md) => {
  const words = md.replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 210))
}

/* ---------- posts ---------- */

const esc = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function collectPosts() {
  const posts = []

  for (const entry of config.sources ?? []) {
    const sourcePath = resolve(entry.sourceFile)
    if (!existsSync(sourcePath)) {
      warn(`source file missing for "${entry.slug}": ${sourcePath} — falling back to a link-out stub`)
      posts.push({ ...entry, missing: true, body: '', readMinutes: 1 })
      continue
    }
    const raw = readFileSync(sourcePath, 'utf8')
    const { data, body } = parseFrontmatter(raw)
    const stripped = stripLeadingH1(body)
    const title = entry.title ?? data.title ?? stripped.title ?? entry.slug
    const markdown = stripped.body
    posts.push({
      slug: entry.slug,
      title,
      date: entry.date ?? data.date ?? '',
      summary: entry.summary ?? data.summary ?? '',
      sourceNote: entry.sourceNote ?? '',
      canonical: entry.canonical ?? `${SITE}/writing/${entry.slug}/`,
      html: withHeadingIds(marked.parse(markdown, { gfm: true, mangle: false, headerIds: false })),
      readMinutes: readTime(markdown),
    })
  }

  const postsDir = join(root, 'src/content/posts')
  if (existsSync(postsDir)) {
    for (const file of readdirSync(postsDir).filter((f) => f.endsWith('.md'))) {
      const raw = readFileSync(join(postsDir, file), 'utf8')
      const { data, body } = parseFrontmatter(raw)
      if (String(data.draft) === 'true') continue
      const stripped = stripLeadingH1(body)
      const slug = data.slug ?? basename(file, '.md')
      posts.push({
        slug,
        title: data.title ?? stripped.title ?? slug,
        date: data.date ?? '',
        summary: data.summary ?? '',
        sourceNote: data.sourceNote ?? '',
        canonical: data.canonical ?? `${SITE}/writing/${slug}/`,
        html: withHeadingIds(marked.parse(stripped.body, { gfm: true, mangle: false, headerIds: false })),
        readMinutes: readTime(stripped.body),
      })
    }
  }

  posts.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return posts
}

function postListItem(post) {
  const meta = [post.date, `${post.readMinutes} min read`].filter(Boolean)
  return `          <li>
            <a class="post-link" href="/writing/${post.slug}/">
              <h3 class="post-title">${esc(post.title)}</h3>
              <p class="post-summary">${esc(post.summary)}</p>
              <span class="post-meta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</span>
            </a>
          </li>`
}

function renderPage(post) {
  const article = `      <article class="article wrap">
        <div class="article-head">
          <p class="eyebrow"><a href="/writing/">Writing</a></p>
          <h1>${esc(post.title)}</h1>
          <p class="post-summary">${esc(post.summary)}</p>
          <span class="post-meta">
            <span>${esc(post.date)}</span>
            <span>${post.readMinutes} min read</span>
          </span>
        </div>
        <div class="prose">
${post.html.trim()}
        </div>
        <div class="article-foot">
          ${post.sourceNote ? `<p>${esc(post.sourceNote)}</p>` : ''}
          <p>Questions or corrections: <a href="mailto:smuel.rr@gmail.com">smuel.rr@gmail.com</a>.</p>
        </div>
      </article>`

  return postPage({
    title: post.title,
    summary: post.summary,
    canonical: post.canonical,
    mainHtml: article,
  })
}

function renderStub(post) {
  const article = `      <article class="article wrap">
        <div class="article-head">
          <p class="eyebrow"><a href="/writing/">Writing</a></p>
          <h1>${esc(post.title)}</h1>
          <p class="post-summary">${esc(post.summary)}</p>
        </div>
        <div class="prose">
          <p>This walkthrough is still being finished. The draft source was not reachable at build time.</p>
        </div>
      </article>`
  return postPage({
    title: post.title,
    summary: post.summary,
    canonical: post.canonical,
    mainHtml: article,
  })
}

/* ---------- injection ---------- */

function inject(file, startMarker, endMarker, html, { emptyNote }) {
  const path = join(root, file)
  if (!existsSync(path)) {
    warn(`cannot inject into ${file}: file not found`)
    return
  }
  const source = readFileSync(path, 'utf8')
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)
  if (start === -1 || end === -1 || end < start) {
    warn(`cannot inject into ${file}: markers not found`)
    return
  }
  const body = html || `          <li class="empty-note">${esc(emptyNote)}</li>`
  const next = `${source.slice(0, start + startMarker.length)}\n${body}\n          ${source.slice(end)}`
  if (next === source) {
    log(`${file}: list unchanged`)
    return
  }
  writeFileSync(path, next)
  log(`${file}: post list updated`)
}

function checkShellSync() {
  for (const file of ['index.html', 'work/index.html', 'writing/index.html']) {
    const path = join(root, file)
    if (!existsSync(path)) continue
    const source = readFileSync(path, 'utf8')
    if (!source.includes(HEADER.split('\n').slice(0, 4).join('\n'))) {
      warn(`${file} header markup has drifted from scripts/shell.mjs`)
    }
    if (!source.includes('class="site-footer"')) {
      warn(`${file} is missing the shared footer markup`)
    }
  }
}

/* ---------- sitemap ---------- */

function writeSitemap(posts) {
  const entries = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/work/`, priority: '0.8' },
    { loc: `${SITE}/writing/`, priority: '0.6' },
    ...posts.map((post) => ({
      loc: `${SITE}/writing/${post.slug}/`,
      priority: '0.7',
      lastmod: post.date,
    })),
  ]
  const body = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${entry.loc}</loc>${
          entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''
        }\n    <priority>${entry.priority}</priority>\n  </url>`,
    )
    .join('\n')
  writeFileSync(
    join(root, 'public/sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
  )
  log('public/sitemap.xml')
}

/* ---------- main ---------- */

const posts = collectPosts()

if (posts.length === 0) {
  log('no posts found')
}

const writingDir = join(root, 'writing')
if (existsSync(writingDir)) {
  for (const entry of readdirSync(writingDir)) {
    if (entry.startsWith('.') || entry === 'index.html') continue
    const path = join(writingDir, entry)
    if (!statSync(path).isDirectory()) continue
    rmSync(path, { recursive: true, force: true })
  }
}

for (const post of posts) {
  const dir = join(writingDir, post.slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), post.missing ? renderStub(post) : renderPage(post))
  log(`writing/${post.slug}/index.html`)
}

const listHtml = posts.map(postListItem).join('\n')
inject('writing/index.html', '<!-- POSTS:START -->', '<!-- POSTS:END -->', listHtml, {
  emptyNote: 'Nothing published yet.',
})
inject('index.html', '<!-- RECENT:START -->', '<!-- RECENT:END -->', listHtml, {
  emptyNote: 'Nothing published yet.',
})
writeSitemap(posts)
checkShellSync()

log(`done — ${posts.length} post(s)${warnings.length ? `, ${warnings.length} warning(s)` : ''}`)
