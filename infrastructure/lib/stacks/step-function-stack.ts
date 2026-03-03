import * as cdk from 'aws-cdk-lib'
import type * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import type * as sqs from 'aws-cdk-lib/aws-sqs'
import * as sfn from 'aws-cdk-lib/aws-stepfunctions'
import { type Construct } from 'constructs'
import * as path from 'path'

import { type EnvironmentConfig } from '../config/environments.js'

interface StepFunctionStackProps extends cdk.StackProps {
  config: EnvironmentConfig
  dataTable: dynamodb.Table
  pipelineQueue: sqs.Queue
}

export class StepFunctionStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine

  constructor(scope: Construct, id: string, props: StepFunctionStackProps) {
    super(scope, id, props)

    const { config, pipelineQueue } = props

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

    const definition = new sfn.Pass(this, 'PassThrough', {
      result: sfn.Result.fromObject({}),
    }).next(new sfn.Succeed(this, 'Succeed'))

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
      }
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
      }
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
      }
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
  }
}
