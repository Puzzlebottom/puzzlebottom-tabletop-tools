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

  it('creates a GSI named GSI1', () => {
    const app = new cdk.App()
    const stack = new DatabaseStack(app, 'TestDatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: Match.arrayWith([
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
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
      Export: { Name: `${mockConfig.envName}-data-table-name` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-data-table-arn` },
    })
  })
})
