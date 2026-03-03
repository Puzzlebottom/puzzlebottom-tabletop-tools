export const playTableQuery = /* GraphQL */ `
  query PlayTable($id: ID!) {
    playTable(id: $id) {
      id
      inviteCode
      createdAt
      players {
        id
        characterName
        initiativeModifier
      }
    }
  }
`

export const rollHistoryQuery = /* GraphQL */ `
  query RollHistory($playTableId: ID!, $limit: Int, $nextToken: String) {
    rollHistory(
      playTableId: $playTableId
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        rollerId
        rollerType
        diceType
        values
        modifier
        total
        advantage
        dc
        success
        visibility
        rollRequestType
        createdAt
      }
      nextToken
    }
  }
`
