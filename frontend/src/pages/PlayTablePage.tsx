import { Authenticator } from '@aws-amplify/ui-react'
import type {
  InitiativeUpdatedSubscription,
  Roll,
  RollCompletedSubscription,
  RollRequestCreatedSubscription,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DiceRoller } from '../components/DiceRoller'
import type {
  AdHocRollOptions,
  InitiativeRollRequestOptions,
} from '../components/GMRollControls'
import { GMRollControls } from '../components/GMRollControls'
import type { InitiativeEntry } from '../components/InitiativeList'
import { InitiativeList } from '../components/InitiativeList'
import { RollLog } from '../components/RollLog'
import {
  clearInitiativeMutation,
  createRollMutation,
  createRollRequestMutation,
  leavePlayTableMutation,
} from '../graphql/mutations'
import { playTableQuery, rollHistoryQuery } from '../graphql/queries'
import {
  initiativeUpdatedSubscription,
  rollCompletedSubscription,
  rollRequestCreatedSubscription,
} from '../graphql/subscriptions'
import {
  playTableResponseSchema,
  rollHistoryResponseSchema,
} from '../graphql/validation'
import { clearStoredPlayer, getStoredPlayer } from '../lib/player-storage'

const client = generateClient()
const API_KEY = import.meta.env.VITE_GRAPHQL_API_KEY

function playerAuth() {
  return { authMode: 'apiKey' as const, apiKey: API_KEY }
}

type RollDisplayItem = Roll

export function PlayTablePage() {
  const { playTableId } = useParams<{ playTableId: string }>()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<
    'loading' | 'gm' | 'player' | 'redirect'
  >('loading')
  const [rolls, setRolls] = useState<RollDisplayItem[]>([])
  const [rollsNextToken, setRollsNextToken] = useState<string | null>(null)
  const [rollsLoading, setRollsLoading] = useState(false)
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>([])
  const [pendingRollRequest, setPendingRollRequest] = useState<{
    id: string
    targetPlayerIds: string[]
    dc?: number | null
    isPrivate?: boolean
  } | null>(null)
  const [rolling, setRolling] = useState(false)
  const [diceSettledValue, setDiceSettledValue] = useState<number | undefined>()
  const [diceCocked, setDiceCocked] = useState(false)
  const [requestingInitiative, setRequestingInitiative] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [adHocOptions, setAdHocOptions] = useState<AdHocRollOptions>(
    {} satisfies AdHocRollOptions
  )
  const playerIdRef = useRef<string | null>(null)
  const pendingRollIdRef = useRef<string | null>(null)

  const stored = getStoredPlayer()
  const isPlayer = Boolean(
    stored &&
    playTableId &&
    stored.playerId &&
    stored.playTableId === playTableId
  )
  if (isPlayer && stored && !playerIdRef.current) {
    playerIdRef.current = stored.playerId
  }

  useEffect(() => {
    if (!playTableId) return

    if (stored?.playerId && stored?.playTableId === playTableId) {
      setViewMode('player')
      return
    }

    getCurrentUser()
      .then(() => setViewMode('gm'))
      .catch(() => setViewMode('redirect'))
  }, [playTableId, stored?.playerId, stored?.playTableId])

  const fetchRollHistory = useCallback(
    async (nextToken?: string | null) => {
      if (!playTableId) return
      setRollsLoading(true)
      try {
        const raw = await client.graphql({
          query: rollHistoryQuery,
          variables: {
            playTableId,
            limit: 20,
            nextToken: nextToken ?? undefined,
          },
          ...(isPlayer ? playerAuth() : {}),
        })
        const result = rollHistoryResponseSchema.parse(raw)
        const conn = result.data?.rollHistory
        if (conn) {
          setRolls((prev) =>
            nextToken ? [...prev, ...conn.items] : [...conn.items]
          )
          setRollsNextToken(conn.nextToken ?? null)
        }
      } finally {
        setRollsLoading(false)
      }
    },
    [playTableId, isPlayer]
  )

  useEffect(() => {
    if (!playTableId || viewMode === 'loading' || viewMode === 'redirect')
      return
    void fetchRollHistory()
  }, [playTableId, viewMode, fetchRollHistory])

  useEffect(() => {
    if (!playTableId || viewMode === 'loading' || viewMode === 'redirect')
      return

    interface SubscriptionClient {
      subscribe: (handlers: { next: (payload: unknown) => void }) => {
        unsubscribe: () => void
      }
    }

    const subRoll = (
      client.graphql({
        query: rollCompletedSubscription,
        variables: { playTableId },
        ...(isPlayer ? playerAuth() : {}),
      }) as unknown as SubscriptionClient
    ).subscribe({
      next: (payload: unknown) => {
        const result = (payload as { data?: RollCompletedSubscription }).data
          ?.rollCompleted
        if (result) {
          setRolls((prev) => [result, ...prev])
          if (
            pendingRollIdRef.current &&
            result.id === pendingRollIdRef.current
          ) {
            const d20 =
              result.values.length > 0 ? Math.max(...result.values) : undefined
            setDiceSettledValue(d20)
            setRolling(false)
            pendingRollIdRef.current = null
          }
        }
      },
    })

    const subRequest = (
      client.graphql({
        query: rollRequestCreatedSubscription,
        variables: { playTableId },
        ...(isPlayer ? playerAuth() : {}),
      }) as unknown as SubscriptionClient
    ).subscribe({
      next: (payload: unknown) => {
        const req = (payload as { data?: RollRequestCreatedSubscription }).data
          ?.rollRequestCreated
        if (req)
          setPendingRollRequest({
            id: req.id,
            targetPlayerIds: req.targetPlayerIds,
            dc: req.dc ?? undefined,
            isPrivate: req.isPrivate,
          })
      },
    })

    const subInitiative = (
      client.graphql({
        query: initiativeUpdatedSubscription,
        variables: { playTableId },
        ...(isPlayer ? playerAuth() : {}),
      }) as unknown as SubscriptionClient
    ).subscribe({
      next: (payload: unknown) => {
        const rolls = (payload as { data?: InitiativeUpdatedSubscription }).data
          ?.initiativeUpdated
        if (rolls && rolls.length > 0) {
          const order: InitiativeEntry[] = rolls
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .map((r) => ({
              id: r.id,
              characterName: r.rollerId,
              value: r.values[0] ?? r.rollResult,
              modifier: r.modifier,
              total: r.rollResult,
            }))
          setInitiativeOrder(order)
          setPendingRollRequest(null)
        }
      },
    })

    return () => {
      ;(subRoll as { unsubscribe: () => void }).unsubscribe()
      ;(subRequest as { unsubscribe: () => void }).unsubscribe()
      ;(subInitiative as { unsubscribe: () => void }).unsubscribe()
    }
  }, [playTableId, viewMode, isPlayer])

  const handleLeave = async () => {
    if (!playTableId || !stored?.playerId) return
    setLeaving(true)
    try {
      await client.graphql({
        query: leavePlayTableMutation,
        variables: { playTableId, playerId: stored.playerId },
        ...playerAuth(),
      })
      clearStoredPlayer()
      void navigate('/dice', { replace: true })
    } catch {
      setLeaving(false)
    }
  }

  const handleRoll = async () => {
    if (!playTableId) return
    setRolling(true)
    setDiceCocked(false)
    setDiceSettledValue(undefined)
    try {
      const result = (await client.graphql({
        query: createRollMutation,
        variables: {
          playTableId,
          playerId: isPlayer ? (playerIdRef.current ?? undefined) : undefined,
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: false,
          },
        },
        ...(isPlayer ? playerAuth() : {}),
      })) as { data?: { createRoll: { id: string } } }
      const rollId = result.data?.createRoll?.id
      if (rollId) {
        pendingRollIdRef.current = rollId
      }
    } catch {
      setRolling(false)
      setDiceCocked(true)
    }
  }

  const handleFulfillRollRequest = async () => {
    if (!playTableId || !pendingRollRequest || !playerIdRef.current) return
    const isTarget = pendingRollRequest.targetPlayerIds.includes(
      playerIdRef.current
    )
    if (!isTarget) return
    setRolling(true)
    setDiceCocked(false)
    setDiceSettledValue(undefined)
    try {
      const result = (await client.graphql({
        query: createRollMutation,
        variables: {
          playTableId,
          playerId: playerIdRef.current,
          input: {
            rollRequestId: pendingRollRequest.id,
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: pendingRollRequest.isPrivate ?? false,
          },
        },
        ...playerAuth(),
      })) as { data?: { createRoll: { id: string } } }
      const rollId = result.data?.createRoll?.id
      if (rollId) {
        pendingRollIdRef.current = rollId
      }
    } catch {
      setRolling(false)
      setDiceCocked(true)
    }
  }

  const handleRequestInitiative = async (
    options: InitiativeRollRequestOptions
  ) => {
    if (!playTableId) return
    setRequestingInitiative(true)
    try {
      const raw = await client.graphql({
        query: playTableQuery,
        variables: { id: playTableId },
      })
      const result = playTableResponseSchema.parse(raw)
      const players = result.data?.playTable?.players ?? []
      const targetPlayerIds = players.map((p) => p.id)
      await client.graphql({
        query: createRollRequestMutation,
        variables: {
          playTableId,
          input: {
            targetPlayerIds,
            type: 'initiative',
            diceNotation: 'd20',
            dc: options.dc ?? undefined,
            isPrivate: options.isPrivate ?? false,
          },
        },
      })
    } finally {
      setRequestingInitiative(false)
    }
  }

  const handleAdHocRoll = async (options: AdHocRollOptions) => {
    if (!playTableId) return
    setRolling(true)
    setDiceCocked(false)
    setDiceSettledValue(undefined)
    try {
      const result = (await client.graphql({
        query: createRollMutation,
        variables: {
          playTableId,
          input: {
            diceNotation: 'd20',
            modifier: 0,
            isPrivate: options.visibility === 'gm_only',
          },
        },
      })) as { data?: { createRoll: { id: string } } }
      const rollId = result.data?.createRoll?.id
      if (rollId) {
        pendingRollIdRef.current = rollId
      }
    } catch {
      setRolling(false)
      setDiceCocked(true)
    }
  }

  const handleClearInitiative = async () => {
    if (!playTableId) return
    setClearing(true)
    try {
      await client.graphql({
        query: clearInitiativeMutation,
        variables: { playTableId },
      })
      setInitiativeOrder([])
    } finally {
      setClearing(false)
    }
  }

  if (!playTableId || viewMode === 'loading') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <p>Loading…</p>
      </main>
    )
  }

  if (viewMode === 'redirect') {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <h1>Join required</h1>
        <p>You need to join this play table via the invite link.</p>
      </main>
    )
  }

  const sharedContent = (
    <>
      <RollLog
        rolls={rolls}
        viewerIsGm={!isPlayer}
        onLoadMore={
          rollsNextToken
            ? () => void fetchRollHistory(rollsNextToken)
            : undefined
        }
        hasMore={Boolean(rollsNextToken)}
        loading={rollsLoading}
      />
      <InitiativeList order={initiativeOrder} />
      {isPlayer ? (
        <>
          {pendingRollRequest &&
          playerIdRef.current &&
          pendingRollRequest.targetPlayerIds.includes(playerIdRef.current) ? (
            <section>
              <p>
                Roll requested for initiative!
                {pendingRollRequest.dc !== undefined &&
                  pendingRollRequest.dc !== null && (
                    <span style={{ fontSize: '0.9rem', color: '#666' }}>
                      {' '}
                      DC {pendingRollRequest.dc}
                    </span>
                  )}
              </p>
              <button
                type="button"
                onClick={() => void handleFulfillRollRequest()}
                disabled={rolling}
              >
                {rolling ? 'Rolling…' : 'Roll for initiative'}
              </button>
            </section>
          ) : (
            <DiceRoller
              onRoll={() => void handleRoll()}
              rolling={rolling}
              disabled={rolling}
              settledValue={diceSettledValue}
              cocked={diceCocked}
            />
          )}
        </>
      ) : (
        <>
          <GMRollControls
            onRequestInitiative={(opts) => void handleRequestInitiative(opts)}
            onAdHocRoll={(opts) => void handleAdHocRoll(opts)}
            onClearInitiative={() => void handleClearInitiative()}
            adHocOptions={adHocOptions}
            onAdHocOptionsChange={setAdHocOptions}
            requestingInitiative={requestingInitiative}
            rolling={rolling}
            clearing={clearing}
          />
          <DiceRoller
            onRoll={() => void handleAdHocRoll(adHocOptions)}
            rolling={rolling}
            disabled={rolling}
            settledValue={diceSettledValue}
            cocked={diceCocked}
          />
        </>
      )}
      {isPlayer && (
        <section style={{ marginTop: '2rem' }}>
          <button
            type="button"
            onClick={() => void handleLeave()}
            disabled={leaving}
          >
            {leaving ? 'Leaving…' : 'Leave table'}
          </button>
        </section>
      )}
    </>
  )

  if (isPlayer) {
    return (
      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
        <h1>Play table</h1>
        <p>Table ID: {playTableId}</p>
        <p>(Player view)</p>
        {sharedContent}
      </main>
    )
  }

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
            }}
          >
            <h1 style={{ margin: 0 }}>Play table (GM)</h1>
            <div>
              <span style={{ marginRight: '1rem' }}>
                {user?.signInDetails?.loginId}
              </span>
              <button onClick={() => void signOut?.()}>Sign out</button>
            </div>
          </header>
          <p>Table ID: {playTableId}</p>
          {sharedContent}
        </main>
      )}
    </Authenticator>
  )
}
