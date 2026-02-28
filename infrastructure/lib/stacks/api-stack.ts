import * as cdk from 'aws-cdk-lib'
import * as appsync from 'aws-cdk-lib/aws-appsync'
import type * as cognito from 'aws-cdk-lib/aws-cognito'
import type * as events from 'aws-cdk-lib/aws-events'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
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

    const { config, userPool, eventBus } = props

    this.api = new appsync.GraphqlApi(this, 'Api', {
      name: `${config.envName}-data-pipeline-api`,
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

    const submitDataFn = new lambdaNode.NodejsFunction(this, 'SubmitDataFn', {
      functionName: `${config.envName}-submit-data`,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(
        import.meta.dirname,
        '../../../backend/lambdas/resolvers/submit-data.ts'
      ),
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      bundling: {
        format: lambdaNode.OutputFormat.ESM,
        minify: true,
        sourceMap: true,
      },
    })

    eventBus.grantPutEventsTo(submitDataFn)

    const lambdaDs = this.api.addLambdaDataSource('SubmitDataDs', submitDataFn)

    lambdaDs.createResolver('SubmitDataResolver', {
      typeName: 'Mutation',
      fieldName: 'submitData',
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
