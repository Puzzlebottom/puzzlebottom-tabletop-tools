import * as cdk from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { AuthStack } from './auth-stack.js'

describe('AuthStack', () => {
  it('synthesizes a Cognito User Pool with expected config', () => {
    const app = new cdk.App()
    const stack = new AuthStack(app, 'TestAuthStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::Cognito::UserPool', 1)
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: `${mockConfig.envName}-user-pool`,
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
      Policies: Match.objectLike({
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireLowercase: true,
          RequireUppercase: true,
          RequireNumbers: true,
        }),
      }),
    })
  })

  it('creates a User Pool Client with OAuth and SRP auth', () => {
    const app = new cdk.App()
    const stack = new AuthStack(app, 'TestAuthStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1)
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: `${mockConfig.envName}-web-client`,
      ExplicitAuthFlows: Match.arrayWith([
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ]),
      PreventUserExistenceErrors: 'ENABLED',
    })
  })

  it('exports UserPoolId and UserPoolClientId', () => {
    const app = new cdk.App()
    const stack = new AuthStack(app, 'TestAuthStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-user-pool-id` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-user-pool-client-id` },
    })
  })
})
