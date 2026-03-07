import * as cdk from 'aws-cdk-lib'
import type * as appsync from 'aws-cdk-lib/aws-appsync'
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import type * as events from 'aws-cdk-lib/aws-events'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import type * as sqs from 'aws-cdk-lib/aws-sqs'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { type Construct } from 'constructs'
import * as path from 'path'

import { type EnvironmentConfig } from '../config/environments.js'

interface StepFunctionStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  dataTable: dynamodb.Table
  eventBus: events.IEventBus
  pipelineQueue: sqs.Queue
  graphqlApi: appsync.IGraphqlApi
}

export class StepFunctionStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine
  public readonly rollStateMachine: sfn.StateMachine

  constructor(scope: Construct, id: string, props: StepFunctionStackProps) {
    super(scope, id, props)

    const { config, pipelineQueue, graphqlApi } = props

    const lambdaDefaults: lambdaNode.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        format: lambdaNode.OutputFormat.ESM,
        minify: true,
        sourceMap: true,
      },
    }

    const createInitiativePendingFn = new lambdaNode.NodejsFunction(
      this,
      'CreateInitiativePendingFn',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-create-initiative-pending`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/steps/create-initiative-pending.ts'
        ),
        environment: {
          TABLE_NAME: props.dataTable.tableName,
        },
      }
    )
    props.dataTable.grantReadWriteData(createInitiativePendingFn)

    const orderInitiativeFn = new lambdaNode.NodejsFunction(
      this,
      'OrderInitiativeFn',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-order-initiative`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/steps/order-initiative.ts'
        ),
        environment: {
          TABLE_NAME: props.dataTable.tableName,
          APPSYNC_GRAPHQL_URL: `https://${graphqlApi.apiId}.appsync-api.${config.awsRegion}.amazonaws.com/graphql`,
        },
      }
    )
    props.dataTable.grantReadWriteData(orderInitiativeFn)
    orderInitiativeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        resources: [
          `arn:aws:appsync:${config.awsRegion}:${config.awsAccount}:apis/${graphqlApi.apiId}/*`,
        ],
      })
    )

    const createInitiativePendingTask = new sfnTasks.LambdaInvoke(
      this,
      'CreateInitiativePending',
      {
        lambdaFunction: createInitiativePendingFn,
        integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
        payload: sfn.TaskInput.fromObject({
          taskToken: sfn.JsonPath.taskToken,
          'playTableId.$': '$.playTableId',
          'rollRequestId.$': '$.rollRequestId',
          'targetPlayerIds.$': '$.targetPlayerIds',
          'expectedCount.$': '$.expectedCount',
        }),
      }
    )

    const orderInitiativeTask = new sfnTasks.LambdaInvoke(
      this,
      'OrderInitiative',
      {
        lambdaFunction: orderInitiativeFn,
        payload: sfn.TaskInput.fromJsonPathAt('$'),
      }
    )

    const definition = createInitiativePendingTask.next(orderInitiativeTask)

    const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/stepfunctions/${config.envName}-puzzlebottom-tabletop-tools`,
      retention: config.logRetention,
      removalPolicy: config.removalPolicy,
    })

    this.stateMachine = new sfn.StateMachine(this, 'DataPipeline', {
      stateMachineName: `${config.envName}-puzzlebottom-tabletop-tools`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(5),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    })

    const rollCompletedHandler = new lambdaNode.NodejsFunction(
      this,
      'RollCompletedHandler',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-roll-completed-handler`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/handlers/roll-completed.ts'
        ),
        environment: {
          TABLE_NAME: props.dataTable.tableName,
          APPSYNC_GRAPHQL_URL: `https://${graphqlApi.apiId}.appsync-api.${config.awsRegion}.amazonaws.com/graphql`,
        },
      }
    )
    props.dataTable.grantReadWriteData(rollCompletedHandler)
    rollCompletedHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['states:SendTaskSuccess'],
        resources: ['*'],
      })
    )
    rollCompletedHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        resources: [
          `arn:aws:appsync:${config.awsRegion}:${config.awsAccount}:apis/${graphqlApi.apiId}/*`,
        ],
      })
    )

    const playerLeftHandler = new lambdaNode.NodejsFunction(
      this,
      'PlayerLeftHandler',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-player-left-handler`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/handlers/player-left.ts'
        ),
        environment: {
          TABLE_NAME: props.dataTable.tableName,
          APPSYNC_GRAPHQL_URL: `https://${graphqlApi.apiId}.appsync-api.${config.awsRegion}.amazonaws.com/graphql`,
        },
      }
    )
    props.dataTable.grantReadWriteData(playerLeftHandler)
    playerLeftHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['states:SendTaskSuccess'],
        resources: ['*'],
      })
    )
    playerLeftHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        resources: [
          `arn:aws:appsync:${config.awsRegion}:${config.awsAccount}:apis/${graphqlApi.apiId}/*`,
        ],
      })
    )

    const playerJoinedHandler = new lambdaNode.NodejsFunction(
      this,
      'PlayerJoinedHandler',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-player-joined-handler`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/handlers/player-joined.ts'
        ),
        environment: {
          TABLE_NAME: props.dataTable.tableName,
          APPSYNC_GRAPHQL_URL: `https://${graphqlApi.apiId}.appsync-api.${config.awsRegion}.amazonaws.com/graphql`,
        },
      }
    )
    props.dataTable.grantReadWriteData(playerJoinedHandler)
    playerJoinedHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        resources: [
          `arn:aws:appsync:${config.awsRegion}:${config.awsAccount}:apis/${graphqlApi.apiId}/*`,
        ],
      })
    )

    const triggerFn = new lambdaNode.NodejsFunction(this, 'SqsTriggerFn', {
      ...lambdaDefaults,
      functionName: `${config.envName}-pipeline-trigger`,
      entry: path.join(
        import.meta.dirname,
        '../../../backend/lambdas/steps/trigger.ts'
      ),
      environment: {
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
        ROLL_COMPLETED_HANDLER_ARN: rollCompletedHandler.functionArn,
        PLAYER_LEFT_HANDLER_ARN: playerLeftHandler.functionArn,
        PLAYER_JOINED_HANDLER_ARN: playerJoinedHandler.functionArn,
      },
    })

    this.stateMachine.grantStartExecution(triggerFn)
    triggerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [
          rollCompletedHandler.functionArn,
          playerLeftHandler.functionArn,
          playerJoinedHandler.functionArn,
        ],
      })
    )

    triggerFn.addEventSource(
      new eventsources.SqsEventSource(pipelineQueue, {
        batchSize: 1,
      })
    )

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      exportName: `${config.envName}-state-machine-arn`,
    })

    // --- Roll Step Function ---

    const generateAndStoreRollFn = new lambdaNode.NodejsFunction(
      this,
      'GenerateAndStoreRollFn',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-generate-and-store-roll`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/steps/generate-and-store-roll.ts'
        ),
        environment: {
          TABLE_NAME: props.dataTable.tableName,
        },
      }
    )
    props.dataTable.grantReadWriteData(generateAndStoreRollFn)

    const notifyRollCompletedFn = new lambdaNode.NodejsFunction(
      this,
      'NotifyRollCompletedFn',
      {
        ...lambdaDefaults,
        functionName: `${config.envName}-notify-roll-completed`,
        entry: path.join(
          import.meta.dirname,
          '../../../backend/lambdas/steps/notify-roll-completed.ts'
        ),
        environment: {
          APPSYNC_GRAPHQL_URL: `https://${graphqlApi.apiId}.appsync-api.${config.awsRegion}.amazonaws.com/graphql`,
        },
      }
    )
    notifyRollCompletedFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['appsync:GraphQL'],
        resources: [
          `arn:aws:appsync:${config.awsRegion}:${config.awsAccount}:apis/${graphqlApi.apiId}/*`,
        ],
      })
    )

    const generateAndStoreRollTask = new sfnTasks.LambdaInvoke(
      this,
      'GenerateAndStoreRoll',
      {
        lambdaFunction: generateAndStoreRollFn,
        payloadResponseOnly: true,
      }
    )

    const notifyRollCompletedTask = new sfnTasks.LambdaInvoke(
      this,
      'NotifyRollCompleted',
      {
        lambdaFunction: notifyRollCompletedFn,
        payloadResponseOnly: true,
      }
    )

    const publishRollEventTask = new sfnTasks.EventBridgePutEvents(
      this,
      'PublishRollEvent',
      {
        entries: [
          {
            source: 'puzzlebottom-tabletop-tools',
            detailType: 'RollCompleted',
            detail: sfn.TaskInput.fromJsonPathAt('$'),
            eventBus: props.eventBus,
          },
        ],
      }
    )

    const rollDefinition = generateAndStoreRollTask
      .next(notifyRollCompletedTask)
      .next(publishRollEventTask)

    const rollLogGroup = new logs.LogGroup(this, 'RollStateMachineLogGroup', {
      logGroupName: `/aws/stepfunctions/${config.envName}-roll-pipeline`,
      retention: config.logRetention,
      removalPolicy: config.removalPolicy,
    })

    this.rollStateMachine = new sfn.StateMachine(this, 'RollPipeline', {
      stateMachineName: `${config.envName}-roll-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(rollDefinition),
      timeout: cdk.Duration.seconds(30),
      tracingEnabled: true,
      logs: {
        destination: rollLogGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    })

    new cdk.CfnOutput(this, 'RollStateMachineArn', {
      value: this.rollStateMachine.stateMachineArn,
      exportName: `${config.envName}-roll-state-machine-arn`,
    })
  }
}
