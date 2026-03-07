import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'

import { mockConfig } from '../test/mock-config.js'
import { ApiStack } from './api-stack.js'
import { AuthStack } from './auth-stack.js'
import { DatabaseStack } from './database-stack.js'
import { EventStack } from './event-stack.js'
import { StepFunctionStack } from './step-function-stack.js'

function createStepFunctionStack(): StepFunctionStack {
  const app = new cdk.App()
  const authStack = new AuthStack(app, 'AuthStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  const databaseStack = new DatabaseStack(app, 'DatabaseStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  const eventStack = new EventStack(app, 'EventStack', {
    config: mockConfig,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  const apiStack = new ApiStack(app, 'ApiStack', {
    config: mockConfig,
    userPool: authStack.userPool,
    eventBus: eventStack.eventBus,
    dataTable: databaseStack.dataTable,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
  return new StepFunctionStack(app, 'TestStepFunctionStack', {
    config: mockConfig,
    dataTable: databaseStack.dataTable,
    eventBus: eventStack.eventBus,
    pipelineQueue: eventStack.pipelineQueue,
    graphqlApi: apiStack.api,
    graphqlUrl: apiStack.api.graphqlUrl,
    env: { account: mockConfig.awsAccount, region: mockConfig.awsRegion },
  })
}

describe('StepFunctionStack', () => {
  it('synthesizes the initiative and roll Step Functions state machines', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.resourceCountIs('AWS::StepFunctions::StateMachine', 2)
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: `${mockConfig.envName}-puzzlebottom-tabletop-tools`,
      TracingConfiguration: { Enabled: true },
    })
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      StateMachineName: `${mockConfig.envName}-roll-pipeline`,
      TracingConfiguration: { Enabled: true },
    })
  }, 15000)

  it('creates trigger Lambda for SQS', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${mockConfig.envName}-pipeline-trigger`,
    })
  }, 15000)

  it('creates CloudWatch Log Group for state machine', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: `/aws/stepfunctions/${mockConfig.envName}-puzzlebottom-tabletop-tools`,
    })
  }, 15000)

  it('exports StateMachineArn and RollStateMachineArn', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-state-machine-arn` },
    })
    template.hasOutput('*', {
      Export: { Name: `${mockConfig.envName}-roll-state-machine-arn` },
    })
  }, 15000)

  it('creates Roll Step Function log group', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: `/aws/stepfunctions/${mockConfig.envName}-roll-pipeline`,
    })
  }, 15000)

  it('creates generate-and-store-roll and notify-roll-completed Lambdas', () => {
    const stack = createStepFunctionStack()
    const template = Template.fromStack(stack)

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${mockConfig.envName}-generate-and-store-roll`,
    })
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${mockConfig.envName}-notify-roll-completed`,
    })
  }, 15000)
})
