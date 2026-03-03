import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { EventStack } from './event-stack.js'

describe('EventStack', () => {
  it('synthesizes EventBridge bus and SQS queues', () => {
    const app = new cdk.App()
    const stack = new EventStack(app, 'TestEventStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::Events::EventBus', 1)
    template.resourceCountIs('AWS::SQS::Queue', 2)

    template.hasResourceProperties('AWS::Events::EventBus', {
      Name: `${mockConfig.envName}-puzzlebottom-tabletop-tools-bus`,
    })

    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: `${mockConfig.envName}-pipeline-queue`,
    })
    template.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: `${mockConfig.envName}-pipeline-dlq`,
    })
  })

  it('exports EventBusName, EventBusArn, and PipelineQueueUrl', () => {
    const app = new cdk.App()
    const stack = new EventStack(app, 'TestEventStack', {
      config: mockConfig,
      env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
    })

    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-event-bus-name` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-event-bus-arn` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-pipeline-queue-url` },
    })
  })
})
