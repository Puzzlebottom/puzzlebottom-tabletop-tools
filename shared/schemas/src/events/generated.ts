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

export type EventDetail = PlayerJoinedDetail | PlayerLeftDetail | RollCompletedDetail | RollRequestCompletedDetail;

export type EventDetailType =
  | 'PlayerJoined'
  | 'PlayerLeft'
  | 'RollCompleted'
  | 'RollRequestCompleted';

export type PlayerJoinedDetail = {
  __typename?: 'PlayerJoinedDetail';
  characterName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  initiativeModifier: Scalars['Int']['output'];
  playTableId: Scalars['ID']['output'];
};

export type PlayerLeftDetail = {
  __typename?: 'PlayerLeftDetail';
  id: Scalars['ID']['output'];
  playTableId: Scalars['ID']['output'];
};

export type RollCompletedDetail = {
  __typename?: 'RollCompletedDetail';
  createdAt: Scalars['String']['output'];
  deletedAt?: Maybe<Scalars['String']['output']>;
  isPrivate: Scalars['Boolean']['output'];
  modifier: Scalars['Int']['output'];
  playTableId: Scalars['ID']['output'];
  rollId: Scalars['ID']['output'];
  rollNotation: Scalars['String']['output'];
  rollRequestId?: Maybe<Scalars['ID']['output']>;
  rollResult: Scalars['Int']['output'];
  rollerId: Scalars['ID']['output'];
  type?: Maybe<RollType>;
  values: Array<Scalars['Int']['output']>;
};

export type RollRequestCompletedDetail = {
  __typename?: 'RollRequestCompletedDetail';
  playTableId: Scalars['ID']['output'];
  playerIds: Array<Scalars['String']['output']>;
  rollIds: Array<Scalars['String']['output']>;
  rollRequestId: Scalars['ID']['output'];
  timestamps: RollRequestCompletedTimestamps;
  type: RollType;
};

export type RollRequestCompletedTimestamps = {
  __typename?: 'RollRequestCompletedTimestamps';
  completedAt: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
};

export type RollType =
  | 'initiative';


type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny => v !== undefined && v !== null;

export const definedNonNullAnySchema = z.any().refine((v) => isDefinedNonNullAny(v));

export const EventDetailTypeSchema = z.enum(['PlayerJoined', 'PlayerLeft', 'RollCompleted', 'RollRequestCompleted']);

export const RollTypeSchema = z.enum(['initiative']);

export function EventDetailSchema() {
  return z.union([PlayerJoinedDetailSchema(), PlayerLeftDetailSchema(), RollCompletedDetailSchema(), RollRequestCompletedDetailSchema()])
}

export function PlayerJoinedDetailSchema(): z.ZodObject<Properties<PlayerJoinedDetail>> {
  return z.object({
    __typename: z.literal('PlayerJoinedDetail').optional(),
    characterName: z.string(),
    id: z.string(),
    initiativeModifier: z.number(),
    playTableId: z.string()
  })
}

export function PlayerLeftDetailSchema(): z.ZodObject<Properties<PlayerLeftDetail>> {
  return z.object({
    __typename: z.literal('PlayerLeftDetail').optional(),
    id: z.string(),
    playTableId: z.string()
  })
}

export function RollCompletedDetailSchema(): z.ZodObject<Properties<RollCompletedDetail>> {
  return z.object({
    __typename: z.literal('RollCompletedDetail').optional(),
    createdAt: z.string(),
    deletedAt: z.string().nullish(),
    isPrivate: z.boolean(),
    modifier: z.number(),
    playTableId: z.string(),
    rollId: z.string(),
    rollNotation: z.string(),
    rollRequestId: z.string().nullish(),
    rollResult: z.number(),
    rollerId: z.string(),
    type: RollTypeSchema.nullish(),
    values: z.array(z.number())
  })
}

export function RollRequestCompletedDetailSchema(): z.ZodObject<Properties<RollRequestCompletedDetail>> {
  return z.object({
    __typename: z.literal('RollRequestCompletedDetail').optional(),
    playTableId: z.string(),
    playerIds: z.array(z.string()),
    rollIds: z.array(z.string()),
    rollRequestId: z.string(),
    timestamps: z.lazy(() => RollRequestCompletedTimestampsSchema()),
    type: RollTypeSchema
  })
}

export function RollRequestCompletedTimestampsSchema(): z.ZodObject<Properties<RollRequestCompletedTimestamps>> {
  return z.object({
    __typename: z.literal('RollRequestCompletedTimestamps').optional(),
    completedAt: z.string(),
    createdAt: z.string()
  })
}
