import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { DatabaseStack } from './database-stack.js'

describe('DatabaseStack', () => {
  it('synthesizes PlayTable and DiceRoller DynamoDB tables with expected properties', () => {
    const app = new cdk.App()
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::DynamoDB::Table', 2)
    const baseTableProps = {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: Match.arrayWith([
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ]),
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    }
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      ...baseTableProps,
      TableName: `${mockConfig.envName}-puzzlebottom-play-table`,
    })
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      ...baseTableProps,
      TableName: `${mockConfig.envName}-puzzlebottom-dice-roller`,
    })
  })

  it('creates GSIs for play table and dice roller access patterns', () => {
    const app = new cdk.App()
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    // PlayTable: GSI1 (GM#gmUserId + createdAt), GSI2 (INVITECODE#code + PLAYTABLE)
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: `${mockConfig.envName}-puzzlebottom-play-table`,
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: 'GSI1' }),
        Match.objectLike({ IndexName: 'GSI2' }),
      ]),
    })

    // DiceRoller: GSI3 (TARGET#playerId + status#createdAt)
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: `${mockConfig.envName}-puzzlebottom-dice-roller`,
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: 'GSI3' }),
      ]),
    })
  })

  it('exports DataTableName and table name outputs', () => {
    const app = new cdk.App()
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-puzzlebottom-table-name` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-puzzlebottom-play-table-name` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-puzzlebottom-dice-roller-name` },
    })
  })
})
