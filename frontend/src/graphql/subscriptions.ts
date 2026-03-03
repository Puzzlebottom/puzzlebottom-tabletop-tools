export const onRollCompletedSubscription = /* GraphQL */ `
  subscription OnRollCompleted($playTableId: ID!) {
    onRollCompleted(playTableId: $playTableId) {
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

export const onRollRequestCreatedSubscription = /* GraphQL */ `
  subscription OnRollRequestCreated($playTableId: ID!) {
    onRollRequestCreated(playTableId: $playTableId) {
      id
      targetPlayerIds
      type
      dc
      advantage
      isPrivate
      status
      createdAt
    }
  }
`

export const onInitiativeUpdatedSubscription = /* GraphQL */ `
  subscription OnInitiativeUpdated($playTableId: ID!) {
    onInitiativeUpdated(playTableId: $playTableId) {
      order {
        id
        characterName
        value
        modifier
        total
      }
    }
  }
`
