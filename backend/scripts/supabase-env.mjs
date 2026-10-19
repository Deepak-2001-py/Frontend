// Writes the local Supabase keys into .env.development.local (gitignored), from
// `npx supabase status -o env` (run `npx supabase start` first). Other lines in the
// file are kept.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(ROOT, '.env.development.local')

let output
try {
  output = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['supabase', 'status', '-o', 'env'], {
    cwd: path.join(ROOT, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  })
} catch {
  console.error('Could not read `npx supabase status`. Start the local stack first: npx supabase start (needs Docker).')
  process.exit(1)
}

const status = {}
for (const line of output.split('\n')) {
  const m = line.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/)
  if (m) status[m[1]] = m[2]
}
// Older CLIs print ANON_KEY / SERVICE_ROLE_KEY; newer ones also PUBLISHABLE_KEY / SECRET_KEY.
const pick = (...names) => names.map((n) => status[n]).find(Boolean)
const values = {
  SUPABASE_URL: pick('API_URL'),
  SUPABASE_ANON_KEY: pick('ANON_KEY', 'PUBLISHABLE_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: pick('SERVICE_ROLE_KEY', 'SECRET_KEY'),
  DATABASE_URL: pick('DB_URL'),
}
const missing = Object.entries(values)
  .filter(([, v]) => !v)
  .map(([k]) => k)
if (missing.length) {
  console.error(`\`supabase status\` didn't include ${missing.join(', ')} (it printed: ${Object.keys(status).join(', ') || 'nothing'}).`)
  console.error('Copy the values into .env.development.local by hand.')
  process.exit(1)
}

const kept = existsSync(FILE)
  ? readFileSync(FILE, 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !Object.keys(values).some((k) => line.startsWith(`${k}=`)))
  : []
writeFileSync(FILE, [...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`)].join('\n') + '\n')
console.log(`Wrote ${Object.keys(values).join(', ')} to ${path.relative(process.cwd(), FILE)}.`)
