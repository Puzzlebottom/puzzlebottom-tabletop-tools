#!/usr/bin/env node
import 'source-map-support/register'

import * as cdk from 'aws-cdk-lib'

import { resolveEnvironment } from '../lib/config/environments.js'
import { ApiStack } from '../lib/stacks/api-stack.js'
import { AuthStack } from '../lib/stacks/auth-stack.js'
import { DatabaseStack } from '../lib/stacks/database-stack.js'
import { EventStack } from '../lib/stacks/event-stack.js'
import { FrontendStack } from '../lib/stacks/frontend-stack.js'
import { StepFunctionStack } from '../lib/stacks/step-function-stack.js'

const app = new cdk.App()
const config = resolveEnvironment()
const prefix = config.envName

const stackProps: cdk.StackProps = {
  env: {
    account: config.awsAccount,
    region: config.awsRegion,
  },
}

cdk.Tags.of(app).add('project', 'puzzlebottom-tabletop-tools')
cdk.Tags.of(app).add('environment', config.envName)
if (config.isSandbox) {
  cdk.Tags.of(app).add('sandbox', 'true')
}

const authStack = new AuthStack(app, `${prefix}-AuthStack`, {
  ...stackProps,
  config,
})

const databaseStack = new DatabaseStack(app, `${prefix}-DatabaseStack`, {
  ...stackProps,
  config,
})

const eventStack = new EventStack(app, `${prefix}-EventStack`, {
  ...stackProps,
  config,
})

const apiStack = new ApiStack(app, `${prefix}-ApiStack`, {
  ...stackProps,
  config,
  userPool: authStack.userPool,
  eventBus: eventStack.eventBus,
  dataTable: databaseStack.dataTable,
})

const stepFunctionStack = new StepFunctionStack(
  app,
  `${prefix}-StepFunctionStack`,
  {
    ...stackProps,
    config,
    dataTable: databaseStack.dataTable,
    eventBus: eventStack.eventBus,
    pipelineQueue: eventStack.pipelineQueue,
    graphqlApi: apiStack.api,
  }
)

stepFunctionStack.rollStateMachine.grantStartExecution(apiStack.rollDiceFn)
apiStack.rollDiceFn.addEnvironment(
  'ROLL_STATE_MACHINE_ARN',
  stepFunctionStack.rollStateMachine.stateMachineArn
)

const frontendStack = new FrontendStack(app, `${prefix}-FrontendStack`, {
  ...stackProps,
  config,
  graphqlApiUrl: apiStack.api.graphqlUrl,
  graphqlApiKey: apiStack.graphqlApiKey,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
})

void stepFunctionStack
void frontendStack

app.synth()
