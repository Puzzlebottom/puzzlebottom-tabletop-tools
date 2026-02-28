import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { ApiStack } from './api-stack.js'
import { AuthStack } from './auth-stack.js'
import { EventStack } from './event-stack.js'

function createApiStack(): ApiStack {
  const app = new cdk.App()
  const authStack = new AuthStack(app, 'AuthStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  const eventStack = new EventStack(app, 'EventStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  return new ApiStack(app, 'TestApiStack', {
    config: mockConfig,
    userPool: authStack.userPool,
    eventBus: eventStack.eventBus,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
}

describe('ApiStack', () => {
  it('synthesizes an AppSync GraphQL API', () => {
    const stack = createApiStack()
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::AppSync::GraphQLApi', 1)
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      Name: `${mockConfig.envName}-data-pipeline-api`,
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
      XrayEnabled: true,
    })
  })

  it('creates submit-data Lambda with EventBridge env var', () => {
    const stack = createApiStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${mockConfig.envName}-submit-data`,
      Runtime: 'nodejs24.x',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          EVENT_BUS_NAME: Match.anyValue(),
        }),
      }),
    })
  })

  it('exports GraphQLApiUrl and GraphQLApiId', () => {
    const stack = createApiStack()
    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-graphql-api-url` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-graphql-api-id` },
    })
  })
})
