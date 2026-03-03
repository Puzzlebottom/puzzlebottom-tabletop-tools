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
