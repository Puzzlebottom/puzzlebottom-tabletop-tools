export const playerFragment = /* GraphQL */ `
  fragment Player on Player {
    id
    playTableId
    characterName
    initiativeModifier
    createdAt
    deletedAt
  }
`

/** Includes Player fragment; use this when querying PlayTable with players. */
export const playTableFragment = /* GraphQL */ `
  fragment PlayTable on PlayTable {
    id
    gmUserId
    inviteCode
    createdAt
    deletedAt
    players {
      ...Player
    }
  }
  ${playerFragment}
`

export const rollFragment = /* GraphQL */ `
  fragment Roll on Roll {
    id
    playTableId
    rollerId
    rollNotation
    type
    values
    modifier
    rollResult
    isPrivate
    rollRequestId
    createdAt
    deletedAt
  }
`

export const rollRequestFragment = /* GraphQL */ `
  fragment RollRequest on RollRequest {
    id
    playTableId
    targetPlayerIds
    rolls {
      ...Roll
    }
    rollNotation
    type
    dc
    isPrivate
    createdAt
    deletedAt
  }
  ${rollFragment}
`
