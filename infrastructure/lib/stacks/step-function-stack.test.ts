import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { DatabaseStack } from './database-stack.js'
import { EventStack } from './event-stack.js'
import { StepFunctionStack } from './step-function-stack.js'

function createStepFunctionStack(): StepFunctionStack {
  const app = new cdk.App()
  const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  const eventStack = new EventStack(app, 'EventStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  return new StepFunctionStack(app, 'TestStepFunctionStack', {
    config: mockConfig,
    dataTable: databaseStack.dataTable,
    pipelineQueue: eventStack.pipelineQueue,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
}

describe('StepFunctionStack', () => {
  it('synthesizes a Step Functions state machine', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1)
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: `${mockConfig.envName}-puzzlebottom-tabletop-tools`,
      TracingConfiguration: { Enabled: true },
    })
  })

  it('creates trigger Lambda for SQS', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${mockConfig.envName}-pipeline-trigger`,
    })
  })

  it('creates CloudWatch Log Group for state machine', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: `/aws/stepfunctions/${mockConfig.envName}-puzzlebottom-tabletop-tools`,
    })
  })

  it('exports StateMachineArn', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-state-machine-arn` },
    })
  })
})
