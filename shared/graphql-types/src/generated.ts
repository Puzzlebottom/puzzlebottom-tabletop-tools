import * as z from 'zod'
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type CreateRollInput = {
  diceNotation: Scalars['String']['input'];
  isPrivate: Scalars['Boolean']['input'];
  modifier: Scalars['Int']['input'];
  playerId?: InputMaybe<Scalars['ID']['input']>;
  rollRequestId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateRollRequestInput = {
  dc?: InputMaybe<Scalars['Int']['input']>;
  diceNotation: Scalars['String']['input'];
  isPrivate?: InputMaybe<Scalars['Boolean']['input']>;
  targetPlayerIds: Array<Scalars['ID']['input']>;
  type: RollType;
};

export type JoinPlayTableInput = {
  characterName: Scalars['String']['input'];
  initiativeModifier: Scalars['Int']['input'];
};

export type Mutation = {
  clearInitiative: Scalars['Boolean']['output'];
  createPlayTable: PlayTable;
  createRoll: Roll;
  createRollRequest: RollRequest;
  joinPlayTable: PlayTable;
  leavePlayTable: Scalars['Boolean']['output'];
  publishInitiativeUpdated: Array<Maybe<Roll>>;
  publishRollCompleted: Roll;
  publishRollRequestCreated: RollRequest;
};


export type MutationClearInitiativeArgs = {
  playTableId: Scalars['ID']['input'];
};


export type MutationCreateRollArgs = {
  input: CreateRollInput;
  playTableId: Scalars['ID']['input'];
  playerId?: InputMaybe<Scalars['ID']['input']>;
};


export type MutationCreateRollRequestArgs = {
  input: CreateRollRequestInput;
  playTableId: Scalars['ID']['input'];
};


export type MutationJoinPlayTableArgs = {
  input: JoinPlayTableInput;
  inviteCode: Scalars['String']['input'];
};


export type MutationLeavePlayTableArgs = {
  playTableId: Scalars['ID']['input'];
  playerId: Scalars['String']['input'];
};


export type MutationPublishInitiativeUpdatedArgs = {
  input: PublishInitiativeUpdatedInput;
};


export type MutationPublishRollCompletedArgs = {
  input: PublishRollInput;
};


export type MutationPublishRollRequestCreatedArgs = {
  input: PublishRollRequestInput;
};

export type PaginatedRolls = {
  items: Array<Roll>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type PlayTable = {
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  gmUserId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  inviteCode: Scalars['String']['output'];
  players?: Maybe<Array<Player>>;
};

export type Player = {
  characterName: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  initiativeModifier: Scalars['Int']['output'];
  playTableId?: Maybe<Scalars['ID']['output']>;
};

export type PublishInitiativeUpdatedInput = {
  rolls: Array<InputMaybe<PublishRollInput>>;
};

export type PublishRollInput = {
  createdAt: Scalars['String']['input'];
  deletedAt?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isPrivate: Scalars['Boolean']['input'];
  modifier: Scalars['Int']['input'];
  playTableId: Scalars['ID']['input'];
  rollNotation: Scalars['String']['input'];
  rollRequestId?: InputMaybe<Scalars['ID']['input']>;
  rollResult: Scalars['Int']['input'];
  rollerId: Scalars['String']['input'];
  type?: InputMaybe<RollType>;
  values: Array<Scalars['Int']['input']>;
};

export type PublishRollRequestInput = {
  createdAt: Scalars['String']['input'];
  dc?: InputMaybe<Scalars['Int']['input']>;
  deletedAt?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isPrivate: Scalars['Boolean']['input'];
  playTableId: Scalars['ID']['input'];
  rollNotation: Scalars['String']['input'];
  rolls: Array<InputMaybe<PublishRollInput>>;
  targetPlayerIds: Array<Scalars['String']['input']>;
  type: RollType;
};

export type Query = {
  playTable?: Maybe<PlayTable>;
  playTableByInviteCode?: Maybe<PlayTable>;
  rollHistory?: Maybe<PaginatedRolls>;
};


export type QueryPlayTableArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPlayTableByInviteCodeArgs = {
  inviteCode: Scalars['String']['input'];
};


export type QueryRollHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
  playTableId: Scalars['ID']['input'];
  playerId?: InputMaybe<Scalars['ID']['input']>;
};

export type Roll = {
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrivate: Scalars['Boolean']['output'];
  modifier: Scalars['Int']['output'];
  playTableId: Scalars['ID']['output'];
  rollNotation: Scalars['String']['output'];
  rollRequestId?: Maybe<Scalars['ID']['output']>;
  rollResult: Scalars['Int']['output'];
  rollerId: Scalars['String']['output'];
  type?: Maybe<RollType>;
  values: Array<Scalars['Int']['output']>;
};

export type RollRequest = {
  createdAt: Scalars['String']['output'];
  dc?: Maybe<Scalars['Int']['output']>;
  deletedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrivate: Scalars['Boolean']['output'];
  playTableId: Scalars['ID']['output'];
  rollNotation: Scalars['String']['output'];
  rolls: Array<Maybe<Roll>>;
  targetPlayerIds: Array<Scalars['String']['output']>;
  type: RollType;
};

export type RollType =
  | 'initiative';

export type Subscription = {
  initiativeUpdated: Array<Maybe<Roll>>;
  rollCompleted?: Maybe<Roll>;
  rollRequestCreated?: Maybe<RollRequest>;
};


export type SubscriptionInitiativeUpdatedArgs = {
  playTableId: Scalars['ID']['input'];
};


export type SubscriptionRollCompletedArgs = {
  playTableId: Scalars['ID']['input'];
};


export type SubscriptionRollRequestCreatedArgs = {
  playTableId: Scalars['ID']['input'];
};

export type PlayerFragment = { id: string, playTableId?: string | null, characterName: string, initiativeModifier: number, createdAt: string, deletedAt?: string | null };

export type PlayTableFragment = { id: string, gmUserId: string, inviteCode: string, createdAt: string, deletedAt?: string | null, players?: Array<{ id: string, playTableId?: string | null, characterName: string, initiativeModifier: number, createdAt: string, deletedAt?: string | null }> | null };

export type RollFragment = { id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null };

export type RollRequestFragment = { id: string, playTableId: string, targetPlayerIds: Array<string>, rollNotation: string, type: RollType, dc?: number | null, isPrivate: boolean, createdAt: string, deletedAt?: string | null, rolls: Array<{ id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null } | null> };

export type CreatePlayTableMutationVariables = Exact<{ [key: string]: never; }>;


export type CreatePlayTableMutation = { createPlayTable: { id: string, gmUserId: string, inviteCode: string, createdAt: string, deletedAt?: string | null, players?: Array<{ id: string, playTableId?: string | null, characterName: string, initiativeModifier: number, createdAt: string, deletedAt?: string | null }> | null } };

export type JoinPlayTableMutationVariables = Exact<{
  inviteCode: Scalars['String']['input'];
  input: JoinPlayTableInput;
}>;


export type JoinPlayTableMutation = { joinPlayTable: { id: string, gmUserId: string, inviteCode: string, createdAt: string, deletedAt?: string | null, players?: Array<{ id: string, playTableId?: string | null, characterName: string, initiativeModifier: number, createdAt: string, deletedAt?: string | null }> | null } };

export type LeavePlayTableMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  playerId: Scalars['String']['input'];
}>;


export type LeavePlayTableMutation = { leavePlayTable: boolean };

export type CreateRollMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  playerId?: InputMaybe<Scalars['ID']['input']>;
  input: CreateRollInput;
}>;


export type CreateRollMutation = { createRoll: { id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null } };

export type CreateRollRequestMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  input: CreateRollRequestInput;
}>;


export type CreateRollRequestMutation = { createRollRequest: { id: string, playTableId: string, targetPlayerIds: Array<string>, rollNotation: string, type: RollType, dc?: number | null, isPrivate: boolean, createdAt: string, deletedAt?: string | null, rolls: Array<{ id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null } | null> } };

export type ClearInitiativeMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type ClearInitiativeMutation = { clearInitiative: boolean };

export type PlayTableByInviteCodeQueryVariables = Exact<{
  inviteCode: Scalars['String']['input'];
}>;


export type PlayTableByInviteCodeQuery = { playTableByInviteCode?: { id: string, gmUserId: string, inviteCode: string, createdAt: string, deletedAt?: string | null, players?: Array<{ id: string, playTableId?: string | null, characterName: string, initiativeModifier: number, createdAt: string, deletedAt?: string | null }> | null } | null };

export type PlayTableQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type PlayTableQuery = { playTable?: { id: string, gmUserId: string, inviteCode: string, createdAt: string, deletedAt?: string | null, players?: Array<{ id: string, playTableId?: string | null, characterName: string, initiativeModifier: number, createdAt: string, deletedAt?: string | null }> | null } | null };

export type RollHistoryQueryVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  playerId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type RollHistoryQuery = { rollHistory?: { nextToken?: string | null, items: Array<{ id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null }> } | null };

export type RollCompletedSubscriptionVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type RollCompletedSubscription = { rollCompleted?: { id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null } | null };

export type RollRequestCreatedSubscriptionVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type RollRequestCreatedSubscription = { rollRequestCreated?: { id: string, playTableId: string, targetPlayerIds: Array<string>, rollNotation: string, type: RollType, dc?: number | null, isPrivate: boolean, createdAt: string, deletedAt?: string | null, rolls: Array<{ id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null } | null> } | null };

export type InitiativeUpdatedSubscriptionVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type InitiativeUpdatedSubscription = { initiativeUpdated: Array<{ id: string, playTableId: string, rollerId: string, rollNotation: string, type?: RollType | null, values: Array<number>, modifier: number, rollResult: number, isPrivate: boolean, rollRequestId?: string | null, createdAt: string, deletedAt?: string | null } | null> };


type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny => v !== undefined && v !== null;

export const definedNonNullAnySchema = z.any().refine((v) => isDefinedNonNullAny(v));

export const RollTypeSchema = z.enum(['initiative']);

export function CreateRollInputSchema(): z.ZodObject<Properties<CreateRollInput>> {
  return z.object({
    diceNotation: z.string(),
    isPrivate: z.boolean(),
    modifier: z.number(),
    playerId: z.string().nullish(),
    rollRequestId: z.string().nullish()
  })
}

export function CreateRollRequestInputSchema(): z.ZodObject<Properties<CreateRollRequestInput>> {
  return z.object({
    dc: z.number().nullish(),
    diceNotation: z.string(),
    isPrivate: z.boolean().nullish(),
    targetPlayerIds: z.array(z.string()),
    type: RollTypeSchema
  })
}

export function JoinPlayTableInputSchema(): z.ZodObject<Properties<JoinPlayTableInput>> {
  return z.object({
    characterName: z.string(),
    initiativeModifier: z.number()
  })
}

export function PaginatedRollsSchema(): z.ZodObject<Properties<PaginatedRolls>> {
  return z.object({
    __typename: z.literal('PaginatedRolls').optional(),
    items: z.array(z.lazy(() => RollSchema())),
    nextToken: z.string().nullish()
  })
}

export function PlayTableSchema(): z.ZodObject<Properties<PlayTable>> {
  return z.object({
    __typename: z.literal('PlayTable').optional(),
    createdAt: z.string(),
    deletedAt: z.string().nullish(),
    gmUserId: z.string(),
    id: z.string(),
    inviteCode: z.string(),
    players: z.array(z.lazy(() => PlayerSchema())).nullish()
  })
}

export function PlayerSchema(): z.ZodObject<Properties<Player>> {
  return z.object({
    __typename: z.literal('Player').optional(),
    characterName: z.string(),
    createdAt: z.string(),
    deletedAt: z.string().nullish(),
    id: z.string(),
    initiativeModifier: z.number(),
    playTableId: z.string().nullish()
  })
}

export function PublishInitiativeUpdatedInputSchema(): z.ZodObject<Properties<PublishInitiativeUpdatedInput>> {
  return z.object({
    rolls: z.array(z.lazy(() => PublishRollInputSchema().nullable()))
  })
}

export function PublishRollInputSchema(): z.ZodObject<Properties<PublishRollInput>> {
  return z.object({
    createdAt: z.string(),
    deletedAt: z.string().nullish(),
    id: z.string(),
    isPrivate: z.boolean(),
    modifier: z.number(),
    playTableId: z.string(),
    rollNotation: z.string(),
    rollRequestId: z.string().nullish(),
    rollResult: z.number(),
    rollerId: z.string(),
    type: RollTypeSchema.nullish(),
    values: z.array(z.number())
  })
}

export function PublishRollRequestInputSchema(): z.ZodObject<Properties<PublishRollRequestInput>> {
  return z.object({
    createdAt: z.string(),
    dc: z.number().nullish(),
    deletedAt: z.string().nullish(),
    id: z.string(),
    isPrivate: z.boolean(),
    playTableId: z.string(),
    rollNotation: z.string(),
    rolls: z.array(z.lazy(() => PublishRollInputSchema().nullable())),
    targetPlayerIds: z.array(z.string()),
    type: RollTypeSchema
  })
}

export function RollSchema(): z.ZodObject<Properties<Roll>> {
  return z.object({
    __typename: z.literal('Roll').optional(),
    createdAt: z.string(),
    deletedAt: z.string().nullish(),
    id: z.string(),
    isPrivate: z.boolean(),
    modifier: z.number(),
    playTableId: z.string(),
    rollNotation: z.string(),
    rollRequestId: z.string().nullish(),
    rollResult: z.number(),
    rollerId: z.string(),
    type: RollTypeSchema.nullish(),
    values: z.array(z.number())
  })
}

export function RollRequestSchema(): z.ZodObject<Properties<RollRequest>> {
  return z.object({
    __typename: z.literal('RollRequest').optional(),
    createdAt: z.string(),
    dc: z.number().nullish(),
    deletedAt: z.string().nullish(),
    id: z.string(),
    isPrivate: z.boolean(),
    playTableId: z.string(),
    rollNotation: z.string(),
    rolls: z.array(z.lazy(() => RollSchema().nullable())),
    targetPlayerIds: z.array(z.string()),
    type: RollTypeSchema
  })
}
