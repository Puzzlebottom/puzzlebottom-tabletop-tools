import * as cdk from 'aws-cdk-lib'
import * as appsync from 'aws-cdk-lib/aws-appsync'
import type * as cognito from 'aws-cdk-lib/aws-cognito'
import type * as events from 'aws-cdk-lib/aws-events'
import { type Construct } from 'constructs'
import * as path from 'path'

import { type EnvironmentConfig } from '../config/environments.js'

interface ApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  userPool: cognito.UserPool
  eventBus: events.EventBus
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const { config, userPool } = props

    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: `${config.envName}-puzzlebottom-tabletop-tools-api`,
      definition: appsync.Definition.fromFile(
        path.join(import.meta.dirname, '../graphql/schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
        additionalAuthorizationModes: [
          { authorizationType: appsync.AuthorizationType.IAM },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        retention: config.logRetention,
      },
      xrayEnabled: true,
    })

    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: this.api.graphqlUrl,
      exportName: `${config.envName}-graphql-api-url`,
    })

    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      exportName: `${config.envName}-graphql-api-id`,
    })
  }
}
