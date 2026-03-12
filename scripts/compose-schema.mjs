#!/usr/bin/env node
/**
 * Composes module GraphQL schemas into a single schema for AppSync.
 * Discovers modules with graphql/schema.graphql and composes them in sorted order.
 *
 * AppSync via CloudFormation does not support "extend type" for root types
 * (Query, Mutation, Subscription). This script merges extend blocks into the
 * base type definition so all fields are in a single block.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const modulesDir = join(root, 'modules')

// Composition order: modules that extend others must come after their dependencies
const SCHEMA_ORDER = ['play-table', 'dice-roller']

const ROOT_TYPES = ['Query', 'Mutation', 'Subscription']

/**
 * Extracts the body (content between braces) of a type/extend type block.
 * Handles nested braces.
 */
function extractTypeBody(schema, startIndex) {
  const open = schema.indexOf('{', startIndex)
  if (open === -1) return null
  let depth = 1
  let i = open + 1
  while (i < schema.length && depth > 0) {
    const c = schema[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  return schema.slice(open + 1, i - 1).trim()
}

/**
 * Finds all type/extend type X blocks and returns their bodies.
 */
function findTypeBlocks(schema, typeName) {
  const bodies = []
  const regex = new RegExp(
    `(?:^|\\n)\\s*(?:extend\\s+)?type\\s+${typeName}\\s*\\{`,
    'g'
  )
  let match
  while ((match = regex.exec(schema)) !== null) {
    const body = extractTypeBody(schema, match.index)
    if (body) bodies.push(body)
  }
  return bodies
}

/**
 * Merges root type blocks (type X / extend type X) into a single type X block.
 * AppSync via CloudFormation does not support extend, so we must flatten.
 * Replaces each matching block individually (from end to start) to preserve
 * other root types that may appear between blocks.
 */
function mergeRootTypesV2(schema) {
  let result = schema
  for (const typeName of ROOT_TYPES) {
    const bodies = findTypeBlocks(result, typeName)
    if (bodies.length === 0) continue

    const mergedBody = bodies.join('\n  ')
    const mergedBlock = `type ${typeName} {\n  ${mergedBody}\n}`

    const blockRegex = new RegExp(
      `(\\n|^)(\\s*(?:extend\\s+)?type\\s+${typeName}\\s*\\{)`,
      'g'
    )
    const allMatches = [...result.matchAll(blockRegex)]
    if (allMatches.length === 0) continue

    // Get start/end of each block (only this type's blocks)
    const blocks = []
    for (const m of allMatches) {
      const openBrace = result.indexOf('{', m.index)
      let depth = 1
      let pos = openBrace + 1
      while (pos < result.length && depth > 0) {
        const c = result[pos]
        if (c === '{') depth++
        else if (c === '}') depth--
        pos++
      }
      blocks.push({ start: m.index, end: pos })
    }

    // Replace from last block to first so indices stay valid
    for (let i = blocks.length - 1; i >= 0; i--) {
      const { start, end } = blocks[i]
      const replacement = i === 0 ? mergedBlock : ''
      const prefix = result.slice(0, start)
      const suffix = result.slice(end)
      result = prefix + (i === 0 ? '\n' : '') + replacement + suffix
    }
  }
  return result
}

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
const merged = mergeRootTypesV2(composed)
const outputPath = join(root, 'infrastructure/lib/graphql/schema.graphql')
writeFileSync(outputPath, merged, 'utf8')
console.log('Composed schema written to', outputPath)
