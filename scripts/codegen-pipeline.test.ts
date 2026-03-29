import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./compose-schema.mjs', () => ({ composeSchema: vi.fn() }))
vi.mock('./compose-events.mjs', () => ({ composeEvents: vi.fn() }))

import { runCodegenPipeline } from './codegen-pipeline.mjs'
import { composeEvents } from './compose-events.mjs'
import { composeSchema } from './compose-schema.mjs'

describe('runCodegenPipeline', () => {
  const codegen = vi.fn().mockResolvedValue(undefined)
  const gitDiff = vi.fn().mockReturnValue([])

  beforeEach(() => {
    vi.mocked(composeSchema).mockReset()
    vi.mocked(composeEvents).mockReset()
    codegen.mockReset().mockResolvedValue(undefined)
    gitDiff.mockReset().mockReturnValue([])
  })

  it('calls composeSchema before composeEvents', async () => {
    const order: string[] = []
    vi.mocked(composeSchema).mockImplementation(() => {
      order.push('schema')
    })
    vi.mocked(composeEvents).mockImplementation(() => {
      order.push('events')
    })

    await runCodegenPipeline({ mode: 'generate', codegen })

    expect(order).toEqual(['schema', 'events'])
  })

  it('calls composeEvents before codegen', async () => {
    const order: string[] = []
    vi.mocked(composeEvents).mockImplementation(() => {
      order.push('events')
    })
    codegen.mockImplementation(() => {
      order.push('codegen')
    })

    await runCodegenPipeline({ mode: 'generate', codegen })

    expect(order).toEqual(['events', 'codegen'])
  })

  it('uses the injected codegen callback', async () => {
    await runCodegenPipeline({ mode: 'generate', codegen })

    expect(codegen).toHaveBeenCalledOnce()
  })

  it('returns { ok: true } on success', async () => {
    const result = await runCodegenPipeline({ mode: 'generate', codegen })

    expect(result).toEqual({ ok: true })
  })

  describe('check mode', () => {
    it('runs the generate sequence before checking for drift', async () => {
      const order: string[] = []
      vi.mocked(composeSchema).mockImplementation(() => {
        order.push('schema')
      })
      vi.mocked(composeEvents).mockImplementation(() => {
        order.push('events')
      })
      codegen.mockImplementation(() => {
        order.push('codegen')
      })
      gitDiff.mockImplementation(() => {
        order.push('gitDiff')
        return []
      })

      await runCodegenPipeline({ mode: 'check', codegen, gitDiff })

      expect(order).toEqual(['schema', 'events', 'codegen', 'gitDiff'])
    })

    it('returns { ok: true } when no drift is detected', async () => {
      gitDiff.mockReturnValue([])

      const result = await runCodegenPipeline({
        mode: 'check',
        codegen,
        gitDiff,
      })

      expect(result).toEqual({ ok: true })
    })

    it('returns { ok: false, driftPaths } when drift is detected', async () => {
      gitDiff.mockReturnValue(['shared/graphql-types/src/generated.ts'])

      const result = await runCodegenPipeline({
        mode: 'check',
        codegen,
        gitDiff,
      })

      expect(result).toEqual({
        ok: false,
        driftPaths: ['shared/graphql-types/src/generated.ts'],
      })
    })
  })
})
