#!/usr/bin/env node
/**
 * Composes module GraphQL schemas into a single schema for AppSync.
 * Uses @graphql-tools/merge to merge type definitions (including extend type)
 * and emits flattened SDL that AppSync via CloudFormation accepts.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { mergeTypeDefs } from '@graphql-tools/merge'
import { print } from 'graphql'

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

const typeDefs = moduleNames.map((name) =>
  readFileSync(join(modulesDir, name, 'graphql', 'schema.graphql'), 'utf8')
)

const merged = mergeTypeDefs(typeDefs)
const sdl = print(merged)

const outputPath = join(root, 'infrastructure/lib/graphql/schema.graphql')
writeFileSync(outputPath, sdl, 'utf8')
console.log('Composed schema written to', outputPath)
