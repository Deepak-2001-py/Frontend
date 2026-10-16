import react from '@vitejs/plugin-react'
import prefixer from 'postcss-prefix-selector'
import { defineConfig } from 'vite'

// The page stylesheets in src/styles/pages/ are the original per-page CSS
// files from the static site, copied verbatim. In a single-page app every
// imported stylesheet is global, so their generic selectors (.btn, .navbar,
// body, :root…) would collide. This scopes each file to a wrapper class
// named after it: src/styles/pages/auth.css -> `.page-auth …`, rendered by
// <PageScope name="auth">. Shared stylesheets several pages used (e.g.
// css/asthetic_style.css) live in src/styles/themes/ and scope to
// `.theme-<name>`, enabled with <PageScope theme="aesthetic">.
const SCOPED_CSS = /[\\/]src[\\/]styles[\\/](pages|themes)[\\/]([\w-]+)\.css/

function scopePageSelector(_prefix: string, selector: string, _prefixed: string, filePath?: string) {
  const match = filePath && SCOPED_CSS.exec(filePath)
  if (!match) return selector
  const scope = `.${match[1] === 'pages' ? 'page' : 'theme'}-${match[2]}`

  // Document-level selectors become the wrapper itself.
  const rootMatch = /^(html\s+body|html|body|:root)(?=$|[\s.:#[>+~])/.exec(selector)
  if (rootMatch) return scope + selector.slice(rootMatch[0].length)
  return `${scope} ${selector}`
}

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [prefixer({ prefix: '.page', transform: scopePageSelector })],
    },
  },
})
