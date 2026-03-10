import { playTableFragment, rollFragment } from './fragments'

export const playTableByInviteCodeQuery = /* GraphQL */ `
  query PlayTableByInviteCode($inviteCode: String!) {
    playTableByInviteCode(inviteCode: $inviteCode) {
      ...PlayTable
    }
  }
  ${playTableFragment}
`

export const playTableQuery = /* GraphQL */ `
  query PlayTable($id: ID!) {
    playTable(id: $id) {
      ...PlayTable
    }
  }
  ${playTableFragment}
`

export const rollHistoryQuery = /* GraphQL */ `
  query RollHistory(
    $playTableId: ID!
    $playerId: ID
    $limit: Int
    $nextToken: String
  ) {
    rollHistory(
      playTableId: $playTableId
      playerId: $playerId
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        ...Roll
      }
      nextToken
    }
  }
  ${rollFragment}
`
