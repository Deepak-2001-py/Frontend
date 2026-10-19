// Builds the Lambda Web Functions deployment package (nothing is uploaded):
//   dist/package/      index.js at the root + src/ + production node_modules
//   dist/function.zip  the same, zipped, with its SHA-256 printed
//
//   npm run package              build
//   npm run package -- --verify  build, then extract the zip into a clean folder
//                                and start it the way Lambda does
//                                (AWS_LAMBDA_HTTP_ENDPOINT) to check /health
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const STAGE = path.join(DIST, 'package')
const ZIP = path.join(DIST, 'function.zip')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

rmSync(DIST, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })
for (const entry of ['index.js', 'worker.js', 'package.json', 'package-lock.json', '.env.production', 'src']) {
  cpSync(path.join(ROOT, entry), path.join(STAGE, entry), { recursive: true })
}
// Development-only code (in-memory DynamoDB, Supabase Postgres) is never loaded in production.
rmSync(path.join(STAGE, 'src', 'dev', 'localDynamo.js'), { force: true })
rmSync(path.join(STAGE, 'src', 'repositories', 'postgres.js'), { force: true })
console.log('Installing production dependencies…')
execFileSync(npm, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: STAGE, stdio: 'inherit', shell: process.platform === 'win32' })

// Web Functions run on Arm64: native (.node) modules built on x86 would not load.
const native = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.node')) native.push(path.relative(STAGE, p))
  }
}
walk(path.join(STAGE, 'node_modules'))
if (native.length) console.warn(`WARNING: native modules found (rebuild them for linux/arm64):\n  ${native.join('\n  ')}`)

if (process.platform === 'win32') {
  execFileSync('tar', ['-a', '-c', '-f', ZIP, '.'], { cwd: STAGE, stdio: 'inherit' })
} else {
  execFileSync('zip', ['-qr', ZIP, '.'], { cwd: STAGE, stdio: 'inherit' })
}
const sha256 = createHash('sha256').update(readFileSync(ZIP)).digest('hex')
console.log(`\nPackage: ${path.relative(process.cwd(), ZIP)} (${(statSync(ZIP).size / 1048576).toFixed(1)} MB)\nSHA-256: ${sha256}`)

if (process.argv.includes('--verify')) {
  const dir = mkdtempSync(path.join(tmpdir(), 'gradeant-package-'))
  execFileSync(process.platform === 'win32' ? 'tar' : 'unzip', process.platform === 'win32' ? ['-x', '-f', ZIP] : ['-q', ZIP], { cwd: dir })
  if (!existsSync(path.join(dir, 'index.js'))) throw new Error('index.js is not at the root of the package')
  const port = 18000 + Math.floor(Math.random() * 1000)
  const child = spawn(process.execPath, ['index.js'], {
    cwd: dir,
    // Production mode as on Lambda, with placeholder values (no AWS calls are made by /health).
    env: {
      PATH: process.env.PATH,
      AWS_LAMBDA_HTTP_ENDPOINT: `127.0.0.1:${port}`,
      JWT_SECRET: 'package-verification-only',
      CORS_ALLOWED_ORIGINS: 'https://example.invalid',
      LOG_REQUESTS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (d) => (output += d))
  child.stderr.on('data', (d) => (output += d))
  const started = Date.now()
  let res
  while (!res && Date.now() - started < 10_000) {
    res = await fetch(`http://127.0.0.1:${port}/health`).catch(() => null)
    if (!res) await new Promise((r) => setTimeout(r, 200))
  }
  child.kill('SIGTERM')
  rmSync(dir, { recursive: true, force: true })
  if (!res || res.status !== 200) {
    console.error(`\nPackage verification FAILED:\n${output}`)
    process.exit(1)
  }
  const body = await res.json()
  console.log(`Package verified: listening on AWS_LAMBDA_HTTP_ENDPOINT in ${Date.now() - started} ms, /health → ${body.status} (mode ${body.mode})`)
}
