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

export type CreateRollRequestInput = {
  advantage?: InputMaybe<Scalars['String']['input']>;
  dc?: InputMaybe<Scalars['Int']['input']>;
  isPrivate?: InputMaybe<Scalars['Boolean']['input']>;
  targetPlayerIds: Array<Scalars['String']['input']>;
  type: RollRequestType;
};

export type InitiativeEntry = {
  characterName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  modifier: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
  value: Scalars['Int']['output'];
};

export type InitiativeEntryInput = {
  characterName: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  modifier: Scalars['Int']['input'];
  total: Scalars['Int']['input'];
  value: Scalars['Int']['input'];
};

export type JoinPlayTableInput = {
  characterName: Scalars['String']['input'];
  initiativeModifier: Scalars['Int']['input'];
};

export type JoinPlayTableResponse = {
  id: Scalars['ID']['output'];
  playTableId: Scalars['ID']['output'];
};

export type Mutation = {
  clearInitiative: Scalars['Boolean']['output'];
  createPlayTable: PlayTable;
  createRollRequest: RollRequest;
  fulfillRollRequest: RollDiceResponse;
  joinPlayTable: JoinPlayTableResponse;
  leavePlayTable: Scalars['Boolean']['output'];
  notifyInitiativeUpdated: Array<InitiativeEntry>;
  rollDice: RollDiceResponse;
};


export type MutationClearInitiativeArgs = {
  playTableId: Scalars['ID']['input'];
};


export type MutationCreateRollRequestArgs = {
  input: CreateRollRequestInput;
  playTableId: Scalars['ID']['input'];
};


export type MutationFulfillRollRequestArgs = {
  playTableId: Scalars['ID']['input'];
  playerId: Scalars['String']['input'];
  rollRequestId: Scalars['ID']['input'];
};


export type MutationJoinPlayTableArgs = {
  input: JoinPlayTableInput;
  inviteCode: Scalars['String']['input'];
};


export type MutationLeavePlayTableArgs = {
  playTableId: Scalars['ID']['input'];
  playerId: Scalars['String']['input'];
};


export type MutationNotifyInitiativeUpdatedArgs = {
  order: Array<InitiativeEntryInput>;
  playTableId: Scalars['ID']['input'];
};


export type MutationRollDiceArgs = {
  input: RollDiceInput;
  playTableId: Scalars['ID']['input'];
};

export type PlayTable = {
  createdAt: Scalars['String']['output'];
  gmUserId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  inviteCode: Scalars['String']['output'];
  players?: Maybe<Array<Player>>;
};

export type Player = {
  characterName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  initiativeModifier: Scalars['Int']['output'];
};

export type Query = {
  playTable?: Maybe<PlayTable>;
  playTableByInviteCode?: Maybe<PlayTable>;
  rollHistory?: Maybe<RollConnection>;
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
};

export type Roll = {
  advantage?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  dc?: Maybe<Scalars['Int']['output']>;
  diceType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  modifier: Scalars['Int']['output'];
  playTableId: Scalars['ID']['output'];
  rollRequestId?: Maybe<Scalars['ID']['output']>;
  rollRequestType: RollRequestType;
  rollerId: Scalars['String']['output'];
  rollerType: RollerType;
  success?: Maybe<Scalars['Boolean']['output']>;
  total: Scalars['Int']['output'];
  values: Array<Scalars['Int']['output']>;
  visibility: Visibility;
};

export type RollConnection = {
  items: Array<Roll>;
  nextToken?: Maybe<Scalars['String']['output']>;
};

export type RollDiceInput = {
  advantage?: InputMaybe<Scalars['String']['input']>;
  dc?: InputMaybe<Scalars['Int']['input']>;
  diceType: Scalars['String']['input'];
  id?: InputMaybe<Scalars['String']['input']>;
  modifier?: InputMaybe<Scalars['Int']['input']>;
  rollRequestId?: InputMaybe<Scalars['ID']['input']>;
  visibility?: InputMaybe<Scalars['String']['input']>;
};

export type RollDiceResponse = {
  accepted: Scalars['Boolean']['output'];
  rollId: Scalars['ID']['output'];
};

export type RollRequest = {
  advantage?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  dc?: Maybe<Scalars['Int']['output']>;
  id: Scalars['ID']['output'];
  isPrivate: Scalars['Boolean']['output'];
  playTableId: Scalars['ID']['output'];
  status: Scalars['String']['output'];
  targetPlayerIds: Array<Scalars['String']['output']>;
  type: RollRequestType;
};

export type RollRequestType =
  | 'ad_hoc'
  | 'initiative';

export type RollResult = {
  advantage?: Maybe<Scalars['String']['output']>;
  dc?: Maybe<Scalars['Int']['output']>;
  modifier: Scalars['Int']['output'];
  rollId: Scalars['ID']['output'];
  success?: Maybe<Scalars['Boolean']['output']>;
  total: Scalars['Int']['output'];
  values: Array<Scalars['Int']['output']>;
  visibility: Visibility;
};

export type RollerType =
  | 'gm'
  | 'player';

export type Subscription = {
  onInitiativeUpdated: Array<InitiativeEntry>;
  onRollCompleted?: Maybe<RollResult>;
  onRollRequestCreated?: Maybe<RollRequest>;
};


export type SubscriptionOnInitiativeUpdatedArgs = {
  playTableId: Scalars['ID']['input'];
};


export type SubscriptionOnRollCompletedArgs = {
  playTableId: Scalars['ID']['input'];
};


export type SubscriptionOnRollRequestCreatedArgs = {
  playTableId: Scalars['ID']['input'];
};

export type Visibility =
  | 'all'
  | 'gm_only';

export type CreatePlayTableMutationVariables = Exact<{ [key: string]: never; }>;


export type CreatePlayTableMutation = { createPlayTable: { id: string, inviteCode: string, createdAt: string } };

export type JoinPlayTableMutationVariables = Exact<{
  inviteCode: Scalars['String']['input'];
  input: JoinPlayTableInput;
}>;


export type JoinPlayTableMutation = { joinPlayTable: { id: string, playTableId: string } };

export type LeavePlayTableMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  playerId: Scalars['String']['input'];
}>;


export type LeavePlayTableMutation = { leavePlayTable: boolean };

export type RollDiceMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  input: RollDiceInput;
}>;


export type RollDiceMutation = { rollDice: { rollId: string, accepted: boolean } };

export type FulfillRollRequestMutationVariables = Exact<{
  rollRequestId: Scalars['ID']['input'];
  playTableId: Scalars['ID']['input'];
  playerId: Scalars['String']['input'];
}>;


export type FulfillRollRequestMutation = { fulfillRollRequest: { rollId: string, accepted: boolean } };

export type CreateRollRequestMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  input: CreateRollRequestInput;
}>;


export type CreateRollRequestMutation = { createRollRequest: { id: string, targetPlayerIds: Array<string>, type: RollRequestType, status: string, createdAt: string } };

export type ClearInitiativeMutationVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type ClearInitiativeMutation = { clearInitiative: boolean };

export type PlayTableByInviteCodeQueryVariables = Exact<{
  inviteCode: Scalars['String']['input'];
}>;


export type PlayTableByInviteCodeQuery = { playTableByInviteCode?: { id: string } | null };

export type PlayTableQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type PlayTableQuery = { playTable?: { id: string, inviteCode: string, createdAt: string, players?: Array<{ id: string, characterName: string, initiativeModifier: number }> | null } | null };

export type RollHistoryQueryVariables = Exact<{
  playTableId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  nextToken?: InputMaybe<Scalars['String']['input']>;
}>;


export type RollHistoryQuery = { rollHistory?: { nextToken?: string | null, items: Array<{ id: string, playTableId: string, rollerId: string, rollerType: RollerType, diceType: string, values: Array<number>, modifier: number, total: number, advantage?: string | null, dc?: number | null, success?: boolean | null, visibility: Visibility, rollRequestType: RollRequestType, createdAt: string }> } | null };

export type OnRollCompletedSubscriptionVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type OnRollCompletedSubscription = { onRollCompleted?: { rollId: string, values: Array<number>, modifier: number, total: number, advantage?: string | null, dc?: number | null, success?: boolean | null, visibility: Visibility } | null };

export type OnRollRequestCreatedSubscriptionVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type OnRollRequestCreatedSubscription = { onRollRequestCreated?: { id: string, targetPlayerIds: Array<string>, type: RollRequestType, dc?: number | null, advantage?: string | null, isPrivate: boolean, status: string, createdAt: string } | null };

export type OnInitiativeUpdatedSubscriptionVariables = Exact<{
  playTableId: Scalars['ID']['input'];
}>;


export type OnInitiativeUpdatedSubscription = { onInitiativeUpdated: Array<{ id: string, characterName: string, value: number, modifier: number, total: number }> };


type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny => v !== undefined && v !== null;

export const definedNonNullAnySchema = z.any().refine((v) => isDefinedNonNullAny(v));

export const RollRequestTypeSchema = z.enum(['ad_hoc', 'initiative']);

export const RollerTypeSchema = z.enum(['gm', 'player']);

export const VisibilitySchema = z.enum(['all', 'gm_only']);

export function CreateRollRequestInputSchema(): z.ZodObject<Properties<CreateRollRequestInput>> {
  return z.object({
    advantage: z.string().nullish(),
    dc: z.number().nullish(),
    isPrivate: z.boolean().nullish(),
    targetPlayerIds: z.array(z.string()),
    type: RollRequestTypeSchema
  })
}

export function InitiativeEntrySchema(): z.ZodObject<Properties<InitiativeEntry>> {
  return z.object({
    __typename: z.literal('InitiativeEntry').optional(),
    characterName: z.string(),
    id: z.string(),
    modifier: z.number(),
    total: z.number(),
    value: z.number()
  })
}

export function InitiativeEntryInputSchema(): z.ZodObject<Properties<InitiativeEntryInput>> {
  return z.object({
    characterName: z.string(),
    id: z.string(),
    modifier: z.number(),
    total: z.number(),
    value: z.number()
  })
}

export function JoinPlayTableInputSchema(): z.ZodObject<Properties<JoinPlayTableInput>> {
  return z.object({
    characterName: z.string(),
    initiativeModifier: z.number()
  })
}

export function JoinPlayTableResponseSchema(): z.ZodObject<Properties<JoinPlayTableResponse>> {
  return z.object({
    __typename: z.literal('JoinPlayTableResponse').optional(),
    id: z.string(),
    playTableId: z.string()
  })
}

export function PlayTableSchema(): z.ZodObject<Properties<PlayTable>> {
  return z.object({
    __typename: z.literal('PlayTable').optional(),
    createdAt: z.string(),
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
    id: z.string(),
    initiativeModifier: z.number()
  })
}

export function RollSchema(): z.ZodObject<Properties<Roll>> {
  return z.object({
    __typename: z.literal('Roll').optional(),
    advantage: z.string().nullish(),
    createdAt: z.string(),
    dc: z.number().nullish(),
    diceType: z.string(),
    id: z.string(),
    modifier: z.number(),
    playTableId: z.string(),
    rollRequestId: z.string().nullish(),
    rollRequestType: RollRequestTypeSchema,
    rollerId: z.string(),
    rollerType: RollerTypeSchema,
    success: z.boolean().nullish(),
    total: z.number(),
    values: z.array(z.number()),
    visibility: VisibilitySchema
  })
}

export function RollConnectionSchema(): z.ZodObject<Properties<RollConnection>> {
  return z.object({
    __typename: z.literal('RollConnection').optional(),
    items: z.array(z.lazy(() => RollSchema())),
    nextToken: z.string().nullish()
  })
}

export function RollDiceInputSchema(): z.ZodObject<Properties<RollDiceInput>> {
  return z.object({
    advantage: z.string().nullish(),
    dc: z.number().nullish(),
    diceType: z.string(),
    id: z.string().nullish(),
    modifier: z.number().nullish(),
    rollRequestId: z.string().nullish(),
    visibility: z.string().nullish()
  })
}

export function RollDiceResponseSchema(): z.ZodObject<Properties<RollDiceResponse>> {
  return z.object({
    __typename: z.literal('RollDiceResponse').optional(),
    accepted: z.boolean(),
    rollId: z.string()
  })
}

export function RollRequestSchema(): z.ZodObject<Properties<RollRequest>> {
  return z.object({
    __typename: z.literal('RollRequest').optional(),
    advantage: z.string().nullish(),
    createdAt: z.string(),
    dc: z.number().nullish(),
    id: z.string(),
    isPrivate: z.boolean(),
    playTableId: z.string(),
    status: z.string(),
    targetPlayerIds: z.array(z.string()),
    type: RollRequestTypeSchema
  })
}

export function RollResultSchema(): z.ZodObject<Properties<RollResult>> {
  return z.object({
    __typename: z.literal('RollResult').optional(),
    advantage: z.string().nullish(),
    dc: z.number().nullish(),
    modifier: z.number(),
    rollId: z.string(),
    success: z.boolean().nullish(),
    total: z.number(),
    values: z.array(z.number()),
    visibility: VisibilitySchema
  })
}
