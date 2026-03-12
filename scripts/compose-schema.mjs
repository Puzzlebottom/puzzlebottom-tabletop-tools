#!/usr/bin/env node
/**
 * Composes module GraphQL schemas into a single schema for AppSync.
 * Discovers modules with graphql/schema.graphql and composes them in sorted order.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const modulesDir = join(root, 'modules')

// Composition order: modules that extend others must come after their dependencies
const SCHEMA_ORDER = ['play-table', 'dice-roller']

const discovered = readdirSync(modulesDir).filter((name) =>
  existsSync(join(modulesDir, name, 'graphql', 'schema.graphql'))
)
const moduleNames = [
  ...SCHEMA_ORDER.filter((name) => discovered.includes(name)),
  ...discovered.filter((name) => !SCHEMA_ORDER.includes(name)).sort(),
]

const schemas = moduleNames.map((name) =>
  readFileSync(join(modulesDir, name, 'graphql', 'schema.graphql'), 'utf8')
)
const composed = schemas.join('\n\n')
const outputPath = join(root, 'infrastructure/lib/graphql/schema.graphql')
writeFileSync(outputPath, composed, 'utf8')
console.log('Composed schema written to', outputPath)
