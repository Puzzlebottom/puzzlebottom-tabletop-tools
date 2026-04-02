export interface IDiceRollerAuthorizationPort {
  getTableGmUserId(playTableId: string): Promise<string | null>
  verifyPlayerMembership(
    playTableId: string,
    playerId: string
  ): Promise<{ playerId: string } | null>
}
