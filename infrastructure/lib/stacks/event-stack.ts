import * as cdk from 'aws-cdk-lib'
import * as events from 'aws-cdk-lib/aws-events'
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { type Construct } from 'constructs'

import { type EnvironmentConfig } from '../config/environments.js'

interface EventStackProps extends cdk.StackProps {
  config: EnvironmentConfig
}

export class EventStack extends cdk.Stack {
  public readonly eventBus: events.EventBus
  public readonly pipelineQueue: sqs.Queue
  public readonly deadLetterQueue: sqs.Queue

  constructor(scope: Construct, id: string, props: EventStackProps) {
    super(scope, id, props)

    const { config } = props

    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `${config.envName}-puzzlebottom-tabletop-tools-bus`,
    })

    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: `${config.envName}-pipeline-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: config.removalPolicy,
    })

    this.pipelineQueue = new sqs.Queue(this, 'PipelineQueue', {
      queueName: `${config.envName}-pipeline-queue`,
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
      removalPolicy: config.removalPolicy,
    })

    const eventSource = 'puzzlebottom-tabletop-tools'

    new events.Rule(this, 'InitiativeRollRequestCreatedRule', {
      eventBus: this.eventBus,
      ruleName: `${config.envName}-initiative-roll-request-created`,
      description: 'Route InitiativeRollRequestCreated to pipeline',
      eventPattern: {
        source: [eventSource],
        detailType: ['InitiativeRollRequestCreated'],
      },
      targets: [new eventsTargets.SqsQueue(this.pipelineQueue)],
    })

    new events.Rule(this, 'RollCompletedRule', {
      eventBus: this.eventBus,
      ruleName: `${config.envName}-roll-completed`,
      description: 'Route RollCompleted to pipeline',
      eventPattern: {
        source: [eventSource],
        detailType: ['RollCompleted'],
      },
      targets: [new eventsTargets.SqsQueue(this.pipelineQueue)],
    })

    new events.Rule(this, 'PlayerLeftRule', {
      eventBus: this.eventBus,
      ruleName: `${config.envName}-player-left`,
      description: 'Route PlayerLeft to pipeline',
      eventPattern: {
        source: [eventSource],
        detailType: ['PlayerLeft'],
      },
      targets: [new eventsTargets.SqsQueue(this.pipelineQueue)],
    })

    new events.Rule(this, 'PlayerJoinedRule', {
      eventBus: this.eventBus,
      ruleName: `${config.envName}-player-joined`,
      description: 'Route PlayerJoined to pipeline',
      eventPattern: {
        source: [eventSource],
        detailType: ['PlayerJoined'],
      },
      targets: [new eventsTargets.SqsQueue(this.pipelineQueue)],
    })

    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      exportName: `${config.envName}-event-bus-name`,
    })

    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      exportName: `${config.envName}-event-bus-arn`,
    })

    new cdk.CfnOutput(this, 'PipelineQueueUrl', {
      value: this.pipelineQueue.queueUrl,
      exportName: `${config.envName}-pipeline-queue-url`,
    })
  }
}
