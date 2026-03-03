import { Authenticator } from '@aws-amplify/ui-react'
import type {
  InitiativeEntry,
  OnInitiativeUpdatedSubscription,
  OnRollCompletedSubscription,
  OnRollRequestCreatedSubscription,
  PlayTableQuery,
  Roll,
  RollHistoryQuery,
  RollResult,
} from '@puzzlebottom-tabletop-tools/graphql-types'
import { generateClient } from 'aws-amplify/api'
import { getCurrentUser } from 'aws-amplify/auth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DiceRoller } from '../components/DiceRoller'
import { GMRollControls } from '../components/GMRollControls'
import { InitiativeList } from '../components/InitiativeList'
import { RollLog } from '../components/RollLog'
import {
  clearInitiativeMutation,
  createRollRequestMutation,
  fulfillRollRequestMutation,
  leavePlayTableMutation,
  rollDiceMutation,
} from '../graphql/mutations'
import { playTableQuery, rollHistoryQuery } from '../graphql/queries'
import {
  onInitiativeUpdatedSubscription,
  onRollCompletedSubscription,
  onRollRequestCreatedSubscription,
} from '../graphql/subscriptions'
import { clearStoredPlayer, getStoredPlayer } from '../lib/player-storage'

const client = generateClient()

type RollDisplayItem =
  | Roll
  | (RollResult & {
      rollerId?: string
      rollerType?: string
      createdAt?: string
    })

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
  } | null>(null)
  const [rolling, setRolling] = useState(false)
  const [, setPendingRollId] = useState<string | null>(null)
  const [diceSettledValue, setDiceSettledValue] = useState<number | undefined>()
  const [diceCocked, setDiceCocked] = useState(false)
  const [requestingInitiative, setRequestingInitiative] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const playerIdRef = useRef<string | null>(null)

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
        const result = (await client.graphql(
          {
            query: rollHistoryQuery,
            variables: {
              playTableId,
              limit: 20,
              nextToken: nextToken ?? undefined,
            },
          },
          isPlayer ? { authMode: 'apiKey' as const } : undefined
        )) as { data: RollHistoryQuery }
        const conn = result.data.rollHistory
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
      client.graphql(
        {
          query: onRollCompletedSubscription,
          variables: { playTableId },
        },
        isPlayer ? { authMode: 'apiKey' as const } : undefined
      ) as unknown as SubscriptionClient
    ).subscribe({
      next: (payload: unknown) => {
        const result = (payload as { data?: OnRollCompletedSubscription }).data
          ?.onRollCompleted
        if (result) {
          setRolls((prev) => [result as RollDisplayItem, ...prev])
          setPendingRollId((prev) => {
            if (prev === result.rollId) {
              setRolling(false)
              const d20 =
                result.values.length > 0
                  ? Math.max(...result.values)
                  : undefined
              setDiceSettledValue(d20)
              return null
            }
            return prev
          })
        }
      },
    })

    const subRequest = (
      client.graphql(
        {
          query: onRollRequestCreatedSubscription,
          variables: { playTableId },
        },
        isPlayer ? { authMode: 'apiKey' as const } : undefined
      ) as unknown as SubscriptionClient
    ).subscribe({
      next: (payload: unknown) => {
        const req = (payload as { data?: OnRollRequestCreatedSubscription })
          .data?.onRollRequestCreated
        if (req)
          setPendingRollRequest({
            id: req.id,
            targetPlayerIds: req.targetPlayerIds,
          })
      },
    })

    const subInitiative = (
      client.graphql(
        {
          query: onInitiativeUpdatedSubscription,
          variables: { playTableId },
        },
        isPlayer ? { authMode: 'apiKey' as const } : undefined
      ) as unknown as SubscriptionClient
    ).subscribe({
      next: (payload: unknown) => {
        const order = (payload as { data?: OnInitiativeUpdatedSubscription })
          .data?.onInitiativeUpdated
        if (order) {
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
      await client.graphql(
        {
          query: leavePlayTableMutation,
          variables: { playTableId, playerId: stored.playerId },
        },
        { authMode: 'apiKey' as const }
      )
      clearStoredPlayer()
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate may return Promise; we intentionally fire-and-forget
      navigate('/dice', { replace: true })
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
      const result = (await client.graphql(
        {
          query: rollDiceMutation,
          variables: {
            playTableId,
            input: {
              diceType: 'd20',
              ...(isPlayer && playerIdRef.current
                ? { id: playerIdRef.current }
                : {}),
            },
          },
        },
        isPlayer ? { authMode: 'apiKey' as const } : undefined
      )) as { data?: { rollDice: { rollId: string } } }
      const rollId = result.data?.rollDice?.rollId
      if (rollId) setPendingRollId(rollId)
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
      const result = (await client.graphql(
        {
          query: fulfillRollRequestMutation,
          variables: {
            rollRequestId: pendingRollRequest.id,
            playTableId,
            playerId: playerIdRef.current,
          },
        },
        { authMode: 'apiKey' as const }
      )) as { data?: { fulfillRollRequest: { rollId: string } } }
      const rollId = result.data?.fulfillRollRequest?.rollId
      if (rollId) setPendingRollId(rollId)
    } catch {
      setRolling(false)
      setDiceCocked(true)
    }
  }

  const handleRequestInitiative = async () => {
    if (!playTableId) return
    setRequestingInitiative(true)
    try {
      const result = (await client.graphql({
        query: playTableQuery,
        variables: { id: playTableId },
      })) as { data: PlayTableQuery }
      const players = result.data.playTable?.players ?? []
      const targetPlayerIds = players.map((p) => p.id)
      await client.graphql({
        query: createRollRequestMutation,
        variables: {
          playTableId,
          input: {
            targetPlayerIds,
            type: 'initiative',
          },
        },
      })
    } finally {
      setRequestingInitiative(false)
    }
  }

  const handleAdHocRoll = async () => {
    if (!playTableId) return
    setRolling(true)
    setDiceCocked(false)
    setDiceSettledValue(undefined)
    try {
      const result = (await client.graphql({
        query: rollDiceMutation,
        variables: {
          playTableId,
          input: { diceType: 'd20' },
        },
      })) as { data?: { rollDice: { rollId: string } } }
      const rollId = result.data?.rollDice?.rollId
      if (rollId) setPendingRollId(rollId)
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
              <p>Roll requested for initiative!</p>
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
            onRequestInitiative={() => void handleRequestInitiative()}
            onAdHocRoll={() => void handleAdHocRoll()}
            onClearInitiative={() => void handleClearInitiative()}
            requestingInitiative={requestingInitiative}
            rolling={rolling}
            clearing={clearing}
          />
          <DiceRoller
            onRoll={() => void handleAdHocRoll()}
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
