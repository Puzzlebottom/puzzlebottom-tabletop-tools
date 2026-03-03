export const createPlayTableMutation = /* GraphQL */ `
  mutation CreatePlayTable {
    createPlayTable {
      id
      inviteCode
      createdAt
    }
  }
`

export const joinPlayTableMutation = /* GraphQL */ `
  mutation JoinPlayTable($inviteCode: String!, $input: JoinPlayTableInput!) {
    joinPlayTable(inviteCode: $inviteCode, input: $input) {
      id
      playTableId
    }
  }
`

export const leavePlayTableMutation = /* GraphQL */ `
  mutation LeavePlayTable($playTableId: ID!, $playerId: String!) {
    leavePlayTable(playTableId: $playTableId, playerId: $playerId)
  }
`

export const rollDiceMutation = /* GraphQL */ `
  mutation RollDice($playTableId: ID!, $input: RollDiceInput!) {
    rollDice(playTableId: $playTableId, input: $input) {
      rollId
      values
      modifier
      total
      advantage
      dc
      success
      visibility
    }
  }
`

export const fulfillRollRequestMutation = /* GraphQL */ `
  mutation FulfillRollRequest(
    $rollRequestId: ID!
    $playTableId: ID!
    $playerId: String!
  ) {
    fulfillRollRequest(
      rollRequestId: $rollRequestId
      playTableId: $playTableId
      playerId: $playerId
    ) {
      rollId
      values
      modifier
      total
      advantage
      dc
      success
      visibility
    }
  }
`

export const createRollRequestMutation = /* GraphQL */ `
  mutation CreateRollRequest(
    $playTableId: ID!
    $input: CreateRollRequestInput!
  ) {
    createRollRequest(playTableId: $playTableId, input: $input) {
      id
      targetPlayerIds
      type
      status
      createdAt
    }
  }
`

export const clearInitiativeMutation = /* GraphQL */ `
  mutation ClearInitiative($playTableId: ID!) {
    clearInitiative(playTableId: $playTableId)
  }
`
