/**
 * Small, dependency-free page behaviour. Everything important is already in the
 * static HTML; this only adds the mobile nav, copy-to-clipboard for addresses,
 * the current year, and the "current page" nav marker.
 */

function setupNav(): void {
  const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle')
  const nav = document.querySelector<HTMLElement>('.nav')
  if (!toggle || !nav) return

  toggle.addEventListener('click', () => {
    const open = nav.dataset.open === 'true'
    nav.dataset.open = open ? 'false' : 'true'
    toggle.setAttribute('aria-expanded', String(!open))
  })
}

function markCurrentPage(): void {
  const here = window.location.pathname.replace(/index\.html$/, '')
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.nav a')) {
    const target = link.getAttribute('href')
    if (!target || !target.startsWith('/')) continue
    const normalized = target.replace(/index\.html$/, '')
    if (normalized === here || (normalized !== '/' && here.startsWith(normalized))) {
      link.setAttribute('aria-current', 'page')
    }
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API needs a secure context; fall back to a hidden textarea.
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}

function setupCopyButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('.copy')) {
    button.addEventListener('click', async () => {
      const value = button.dataset.copy
      if (!value) return
      const ok = await copyText(value)
      button.dataset.copied = String(ok)
      button.textContent = ok ? 'copied' : 'failed'
      window.setTimeout(() => {
        button.dataset.copied = 'false'
        button.textContent = 'copy'
      }, 1400)
    })
  }
}

function stampYear(): void {
  const year = String(new Date().getFullYear())
  for (const node of document.querySelectorAll<HTMLElement>('[data-year]')) {
    node.textContent = year
  }
}

setupNav()
markCurrentPage()
setupCopyButtons()
stampYear()
