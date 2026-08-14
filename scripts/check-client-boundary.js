#!/usr/bin/env node
/**
 * Fails if a client component can reach a server-only module.
 *
 * Importing `crypto`, `mongodb`, `next/headers` etc. from a module that a
 * `'use client'` file imports makes webpack bundle Node polyfills into the
 * browser (the Node crypto shim alone is ~320 KB). Run in CI to keep the
 * boundary from regressing.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib']
const EXTS = ['.js', '.jsx']

const SERVER_ONLY = new Set([
  'crypto', 'node:crypto',
  'fs', 'node:fs', 'fs/promises', 'node:fs/promises',
  'path', 'node:path',
  'mongodb',
  'jsonwebtoken',
  'bcryptjs',
  'next/headers',
  'cloudinary',
  'razorpay',
  'otplib',
  'nodemailer',
])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (EXTS.includes(path.extname(entry.name))) out.push(full)
  }
  return out
}

const files = SCAN_DIRS.flatMap(d => {
  const full = path.join(ROOT, d)
  return fs.existsSync(full) ? walk(full) : []
})

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g

const info = new Map()
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const specifiers = new Set()
  for (const re of [IMPORT_RE, REQUIRE_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src)) !== null) specifiers.add(m[1])
  }
  info.set(file, {
    isClient: /^\s*(['"])use client\1/m.test(src.slice(0, 400)),
    isRoute: /[\\/](route|middleware)\.js$/.test(file),
    specifiers: [...specifiers],
  })
}

/** Resolve a `@/` or relative specifier to a file we scanned. */
function resolveLocal(fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null

  const candidates = [
    base,
    ...EXTS.map(e => base + e),
    ...EXTS.map(e => path.join(base, 'index' + e)),
  ]
  return candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile()) || null
}

const violations = []
const visitedFrom = new Map()

/** Depth-first walk of a client component's local import graph. */
function inspect(file, chain, seen) {
  if (seen.has(file)) return
  seen.add(file)
  const meta = info.get(file)
  if (!meta) return

  for (const spec of meta.specifiers) {
    if (SERVER_ONLY.has(spec)) {
      violations.push({ entry: chain[0], module: file, spec, chain: [...chain, file] })
      continue
    }
    const local = resolveLocal(file, spec)
    if (local) inspect(local, [...chain, file], seen)
  }
}

for (const [file, meta] of info) {
  if (!meta.isClient) continue
  const seen = new Set()
  visitedFrom.set(file, seen)
  inspect(file, [], seen)
}

const rel = f => path.relative(ROOT, f)

if (violations.length === 0) {
  console.log(`client/server boundary clean — scanned ${files.length} files`)
  process.exit(0)
}

// One line per (module, specifier); entry points listed for context.
const grouped = new Map()
for (const v of violations) {
  const key = `${rel(v.module)}::${v.spec}`
  if (!grouped.has(key)) grouped.set(key, { module: rel(v.module), spec: v.spec, entries: new Set() })
  grouped.get(key).entries.add(rel(v.entry || v.module))
}

console.error(`\nclient/server boundary violations: ${grouped.size}\n`)
for (const g of grouped.values()) {
  console.error(`  ${g.module} imports server-only "${g.spec}"`)
  for (const e of [...g.entries].sort().slice(0, 6)) console.error(`      reached from ${e}`)
  if (g.entries.size > 6) console.error(`      ...and ${g.entries.size - 6} more`)
}
console.error('\nMove the server-only code into a module that no client component imports.\n')
process.exit(1)
