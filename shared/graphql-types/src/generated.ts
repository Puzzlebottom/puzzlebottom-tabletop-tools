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
  order: Array<InitiativeEntry>;
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
