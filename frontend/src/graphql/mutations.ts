import {
  playTableFragment,
  rollFragment,
  rollRequestFragment,
} from './fragments'

export const createPlayTableMutation = /* GraphQL */ `
  mutation CreatePlayTable {
    createPlayTable {
      ...PlayTable
    }
  }
  ${playTableFragment}
`

export const joinPlayTableMutation = /* GraphQL */ `
  mutation JoinPlayTable($inviteCode: String!, $input: JoinPlayTableInput!) {
    joinPlayTable(inviteCode: $inviteCode, input: $input) {
      ...PlayTable
    }
  }
  ${playTableFragment}
`

export const leavePlayTableMutation = /* GraphQL */ `
  mutation LeavePlayTable($playTableId: ID!, $playerId: String!) {
    leavePlayTable(playTableId: $playTableId, playerId: $playerId)
  }
`

export const createRollMutation = /* GraphQL */ `
  mutation CreateRoll(
    $playTableId: ID!
    $playerId: ID
    $input: CreateRollInput!
  ) {
    createRoll(playTableId: $playTableId, playerId: $playerId, input: $input) {
      ...Roll
    }
  }
  ${rollFragment}
`

export const createRollRequestMutation = /* GraphQL */ `
  mutation CreateRollRequest(
    $playTableId: ID!
    $input: CreateRollRequestInput!
  ) {
    createRollRequest(playTableId: $playTableId, input: $input) {
      ...RollRequest
    }
  }
  ${rollRequestFragment}
`

export const clearInitiativeMutation = /* GraphQL */ `
  mutation ClearInitiative($playTableId: ID!) {
    clearInitiative(playTableId: $playTableId)
  }
`
