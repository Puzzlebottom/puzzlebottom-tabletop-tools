import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { DatabaseStack } from './database-stack.js'

describe('DatabaseStack', () => {
  it('synthesizes a DynamoDB table with expected properties', () => {
    const app = new cdk.App()
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::DynamoDB::Table', 1)
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: Match.arrayWith([
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ]),
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    })
  })

  it('creates GSIs for dice roller access patterns', () => {
    const app = new cdk.App()
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    // GSI1: GM#gmUserId + createdAt — list PlayTables by GM
    // GSI2: INVITECODE#code + PLAYTABLE — lookup PlayTable by invite link
    // GSI3: TARGET#playerId + status#createdAt — list RollRequests by target player
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: Match.arrayWith([
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ]),
        }),
        Match.objectLike({
          IndexName: 'GSI2',
          KeySchema: Match.arrayWith([
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
          ]),
        }),
        Match.objectLike({
          IndexName: 'GSI3',
          KeySchema: Match.arrayWith([
            { AttributeName: 'GSI3PK', KeyType: 'HASH' },
            { AttributeName: 'GSI3SK', KeyType: 'RANGE' },
          ]),
        }),
      ]),
    })
  })

  it('exports DataTableName and DataTableArn outputs', () => {
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
      Export: { Name: `${mockConfig.envName}-puzzlebottom-table-arn` },
    })
  })
})
