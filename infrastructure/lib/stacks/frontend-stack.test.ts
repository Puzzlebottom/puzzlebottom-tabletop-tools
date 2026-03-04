import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import {
  developmentConfig,
  mockConfig,
  productionConfig,
  sandboxConfig,
  sandboxConfigNoBranch,
} from '../test/mock-config.js'
import { ApiStack } from './api-stack.js'
import { AuthStack } from './auth-stack.js'
import { DatabaseStack } from './database-stack.js'
import { EventStack } from './event-stack.js'
import { FrontendStack } from './frontend-stack.js'

const appContext = { githubOwner: 'test-owner', githubRepo: 'test-repo' }

function createFrontendStack(config = mockConfig): FrontendStack {
  const app = new cdk.App({ context: appContext })
  const authStack = new AuthStack(app, 'AuthStack', {
    config,
    env: { account: config.awsAccount, region: config.awsRegion },
  })
  const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
    config,
    env: { account: config.awsAccount, region: config.awsRegion },
  })
  const eventStack = new EventStack(app, 'EventStack', {
    config,
    env: { account: config.awsAccount, region: config.awsRegion },
  })
  const apiStack = new ApiStack(app, 'ApiStack', {
    config,
    userPool: authStack.userPool,
    eventBus: eventStack.eventBus,
    dataTable: databaseStack.dataTable,
    env: { account: config.awsAccount, region: config.awsRegion },
  })
  return new FrontendStack(app, 'TestFrontendStack', {
    config,
    graphqlApiUrl: apiStack.api.graphqlUrl,
    graphqlApiKey: apiStack.graphqlApiKey,
    userPoolId: authStack.userPool.userPoolId,
    userPoolClientId: authStack.userPoolClient.userPoolClientId,
    env: { account: config.awsAccount, region: config.awsRegion },
  })
}

describe('FrontendStack', () => {
  it('synthesizes an Amplify App', () => {
    const stack = createFrontendStack()
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::Amplify::App', 1)
    template.hasResourceProperties('AWS::Amplify::App', {
      Name: `${mockConfig.envName}-puzzlebottom-tabletop-tools`,
      EnvironmentVariables: Match.arrayWith([
        Match.objectLike({ Name: 'VITE_USER_POOL_ID' }),
        Match.objectLike({ Name: 'VITE_USER_POOL_CLIENT_ID' }),
        Match.objectLike({ Name: 'VITE_GRAPHQL_ENDPOINT' }),
        Match.objectLike({ Name: 'VITE_GRAPHQL_API_KEY' }),
      ]),
    })
  })

  it('exports AmplifyAppId and AmplifyDefaultDomain', () => {
    const stack = createFrontendStack()
    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-amplify-app-id` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-amplify-url` },
    })
  })

  it('synthesizes without Amplify branch when sandbox has no sandboxBranch', () => {
    const stack = createFrontendStack(sandboxConfigNoBranch)
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::Amplify::Branch', 0)
    template.hasOutput('*', {
      Export: { Name: `${sandboxConfigNoBranch.envName}-amplify-url` },
    })
  })

  it('adds sandbox branch when config.isSandbox and sandboxBranch are set', () => {
    const stack = createFrontendStack(sandboxConfig)
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::Amplify::Branch', 1)
    template.hasResourceProperties('AWS::Amplify::Branch', {
      BranchName: sandboxConfig.sandboxBranch,
      Stage: 'DEVELOPMENT',
    })
  })

  it('adds development branch for development config', () => {
    const stack = createFrontendStack(developmentConfig)
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Amplify::Branch', {
      BranchName: 'development',
      Stage: 'DEVELOPMENT',
    })
  })

  it('adds production branch with PRODUCTION stage for production config', () => {
    const stack = createFrontendStack(productionConfig)
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Amplify::Branch', {
      BranchName: 'main',
      Stage: 'PRODUCTION',
    })
  })

  it('throws when githubOwner context is missing', () => {
    const app = new cdk.App()
    const authStack = new AuthStack(app, 'AuthStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })
    const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })
    const eventStack = new EventStack(app, 'EventStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })
    const apiStack = new ApiStack(app, 'ApiStack', {
      config: mockConfig,
      userPool: authStack.userPool,
      eventBus: eventStack.eventBus,
      dataTable: databaseStack.dataTable,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    expect(
      () =>
        new FrontendStack(app, 'TestFrontendStack', {
          config: mockConfig,
          graphqlApiUrl: apiStack.api.graphqlUrl,
          graphqlApiKey: apiStack.graphqlApiKey,
          userPoolId: authStack.userPool.userPoolId,
          userPoolClientId: authStack.userPoolClient.userPoolClientId,
          env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
        })
    ).toThrow(/CDK context variable "githubOwner" is required/)
  })
})
