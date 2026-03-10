import { rollFragment, rollRequestFragment } from './fragments'

export const rollCompletedSubscription = /* GraphQL */ `
  subscription RollCompleted($playTableId: ID!) {
    rollCompleted(playTableId: $playTableId) {
      ...Roll
    }
  }
  ${rollFragment}
`

export const rollRequestCreatedSubscription = /* GraphQL */ `
  subscription RollRequestCreated($playTableId: ID!) {
    rollRequestCreated(playTableId: $playTableId) {
      ...RollRequest
    }
  }
  ${rollRequestFragment}
`

export const initiativeUpdatedSubscription = /* GraphQL */ `
  subscription InitiativeUpdated($playTableId: ID!) {
    initiativeUpdated(playTableId: $playTableId) {
      ...Roll
    }
  }
  ${rollFragment}
`
