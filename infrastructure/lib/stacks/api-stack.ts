import * as cdk from 'aws-cdk-lib'
import * as appsync from 'aws-cdk-lib/aws-appsync'
import type * as cognito from 'aws-cdk-lib/aws-cognito'
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
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
  dataTable: dynamodb.Table
}

export class ApiStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const { config, userPool, eventBus, dataTable } = props

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

    const playTableFn = new lambdaNode.NodejsFunction(this, 'PlayTableFn', {
      functionName: `${config.envName}-play-table-resolver`,
      entry: path.join(
        import.meta.dirname,
        '../../../backend/lambdas/resolvers/play-table.ts'
      ),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: dataTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      bundling: {
        format: lambdaNode.OutputFormat.ESM,
        minify: true,
        sourceMap: true,
      },
    })

    dataTable.grantReadWriteData(playTableFn)
    eventBus.grantPutEventsTo(playTableFn)

    const playTableDs = this.api.addLambdaDataSource(
      'PlayTableDataSource',
      playTableFn
    )

    playTableDs.createResolver('CreatePlayTableResolver', {
      typeName: 'Mutation',
      fieldName: 'createPlayTable',
    })
    playTableDs.createResolver('JoinPlayTableResolver', {
      typeName: 'Mutation',
      fieldName: 'joinPlayTable',
    })
    playTableDs.createResolver('LeavePlayTableResolver', {
      typeName: 'Mutation',
      fieldName: 'leavePlayTable',
    })
    playTableDs.createResolver('PlayTableResolver', {
      typeName: 'Query',
      fieldName: 'playTable',
    })
    playTableDs.createResolver('PlayTableByInviteCodeResolver', {
      typeName: 'Query',
      fieldName: 'playTableByInviteCode',
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
