#!/usr/bin/env node
/**
 * Composes module event GraphQL schemas into a single schema for codegen.
 * Discovers modules with graphql/events.graphql and composes them in sorted order.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const modulesDir = join(root, 'modules')

// Composition order: EventDetail union references PlayerLeftDetail, PlayerJoinedDetail from play-table
const EVENTS_ORDER = ['play-table', 'dice-roller']

const discovered = readdirSync(modulesDir).filter((name) =>
  existsSync(join(modulesDir, name, 'graphql', 'events.graphql'))
)
const moduleNames = [
  ...EVENTS_ORDER.filter((name) => discovered.includes(name)),
  ...discovered.filter((name) => !EVENTS_ORDER.includes(name)).sort(),
]

const events = moduleNames.map((name) =>
  readFileSync(join(modulesDir, name, 'graphql', 'events.graphql'), 'utf8')
)
const composed = events.join('\n\n')
const outputPath = join(root, 'infrastructure/lib/graphql/events.graphql')
writeFileSync(outputPath, composed, 'utf8')
console.log('Composed events written to', outputPath)
