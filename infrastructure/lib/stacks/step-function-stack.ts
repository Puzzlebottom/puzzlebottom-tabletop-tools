import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';
import { EnvironmentConfig } from '../config/environments';

interface StepFunctionStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  dataTable: dynamodb.Table;
  pipelineQueue: sqs.Queue;
}

export class StepFunctionStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StepFunctionStackProps) {
    super(scope, id, props);

    const { config, dataTable, pipelineQueue } = props;

    const lambdaDefaults: lambdaNode.NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    };

    const ingestFn = new lambdaNode.NodejsFunction(this, 'IngestFn', {
      ...lambdaDefaults,
      functionName: `${config.envName}-pipeline-ingest`,
      entry: path.join(__dirname, '../../../backend/lambdas/steps/ingest.ts'),
    });

    const transformFn = new lambdaNode.NodejsFunction(this, 'TransformFn', {
      ...lambdaDefaults,
      functionName: `${config.envName}-pipeline-transform`,
      entry: path.join(__dirname, '../../../backend/lambdas/steps/transform.ts'),
    });

    const validateFn = new lambdaNode.NodejsFunction(this, 'ValidateFn', {
      ...lambdaDefaults,
      functionName: `${config.envName}-pipeline-validate`,
      entry: path.join(__dirname, '../../../backend/lambdas/steps/validate.ts'),
    });

    const storeFn = new lambdaNode.NodejsFunction(this, 'StoreFn', {
      ...lambdaDefaults,
      functionName: `${config.envName}-pipeline-store`,
      entry: path.join(__dirname, '../../../backend/lambdas/steps/store.ts'),
      environment: {
        TABLE_NAME: dataTable.tableName,
      },
    });

    dataTable.grantWriteData(storeFn);

    const ingestStep = new tasks.LambdaInvoke(this, 'Ingest', {
      lambdaFunction: ingestFn,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const transformStep = new tasks.LambdaInvoke(this, 'Transform', {
      lambdaFunction: transformFn,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const validateStep = new tasks.LambdaInvoke(this, 'Validate', {
      lambdaFunction: validateFn,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const storeStep = new tasks.LambdaInvoke(this, 'Store', {
      lambdaFunction: storeFn,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const failState = new sfn.Fail(this, 'PipelineFailed', {
      cause: 'Pipeline step encountered an error',
      error: 'PipelineError',
    });

    const successState = new sfn.Succeed(this, 'PipelineSucceeded');

    const retryConfig: sfn.RetryProps = {
      errors: ['States.TaskFailed'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 2,
      backoffRate: 2,
    };

    ingestStep.addRetry(retryConfig);
    transformStep.addRetry(retryConfig);
    validateStep.addRetry(retryConfig);
    storeStep.addRetry(retryConfig);

    ingestStep.addCatch(failState, { resultPath: '$.error' });
    transformStep.addCatch(failState, { resultPath: '$.error' });
    validateStep.addCatch(failState, { resultPath: '$.error' });
    storeStep.addCatch(failState, { resultPath: '$.error' });

    const definition = ingestStep
      .next(transformStep)
      .next(validateStep)
      .next(storeStep)
      .next(successState);

    const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/stepfunctions/${config.envName}-data-pipeline`,
      retention: config.logRetention,
      removalPolicy: config.removalPolicy,
    });

    this.stateMachine = new sfn.StateMachine(this, 'DataPipeline', {
      stateMachineName: `${config.envName}-data-pipeline`,
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(5),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    const triggerFn = new lambdaNode.NodejsFunction(this, 'SqsTriggerFn', {
      ...lambdaDefaults,
      functionName: `${config.envName}-pipeline-trigger`,
      entry: path.join(__dirname, '../../../backend/lambdas/steps/trigger.ts'),
      environment: {
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
      },
    });

    this.stateMachine.grantStartExecution(triggerFn);

    triggerFn.addEventSource(
      new eventsources.SqsEventSource(pipelineQueue, {
        batchSize: 1,
      })
    );

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      exportName: `${config.envName}-state-machine-arn`,
    });
  }
}
