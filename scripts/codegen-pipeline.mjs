#!/usr/bin/env node
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { composeSchema } from './compose-schema.mjs'
import { composeEvents } from './compose-events.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaultCwd = join(__dirname, '..')

const DRIFT_PATHS = [
  'shared/graphql-types',
  'shared/schemas/src/events',
  'infrastructure/lib/graphql',
]

function defaultCodegen(cwd) {
  execSync('npx graphql-codegen', { cwd, stdio: 'inherit' })
}

function defaultGitDiff(cwd) {
  const result = execSync(`git diff --name-only -- ${DRIFT_PATHS.join(' ')}`, {
    cwd,
    encoding: 'utf8',
  })
  return result.trim() ? result.trim().split('\n') : []
}

export async function runCodegenPipeline({
  mode,
  cwd = defaultCwd,
  codegen = defaultCodegen,
  gitDiff = defaultGitDiff,
}) {
  composeSchema(cwd)
  composeEvents(cwd)
  await codegen(cwd)

  if (mode === 'check') {
    const driftPaths = gitDiff(cwd)
    if (driftPaths.length > 0) {
      return { ok: false, driftPaths }
    }
  }

  return { ok: true }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--check') ? 'check' : 'generate'
  const result = await runCodegenPipeline({ mode })
  if (!result.ok) {
    console.error('Codegen drift detected in:', result.driftPaths.join(', '))
    process.exit(1)
  }
}
