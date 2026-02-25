#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnvironment } from '../lib/config/environments';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { EventStack } from '../lib/stacks/event-stack';
import { StepFunctionStack } from '../lib/stacks/step-function-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();
const config = resolveEnvironment();
const prefix = config.envName;

const stackProps: cdk.StackProps = {
  env: {
    account: config.awsAccount,
    region: config.awsRegion,
  },
};

cdk.Tags.of(app).add('project', 'aws-step-function-test');
cdk.Tags.of(app).add('environment', config.envName);
if (config.isSandbox) {
  cdk.Tags.of(app).add('sandbox', 'true');
}

const authStack = new AuthStack(app, `${prefix}-AuthStack`, {
  ...stackProps,
  config,
});

const databaseStack = new DatabaseStack(app, `${prefix}-DatabaseStack`, {
  ...stackProps,
  config,
});

const eventStack = new EventStack(app, `${prefix}-EventStack`, {
  ...stackProps,
  config,
});

const stepFunctionStack = new StepFunctionStack(app, `${prefix}-StepFunctionStack`, {
  ...stackProps,
  config,
  dataTable: databaseStack.dataTable,
  pipelineQueue: eventStack.pipelineQueue,
});

const apiStack = new ApiStack(app, `${prefix}-ApiStack`, {
  ...stackProps,
  config,
  userPool: authStack.userPool,
  eventBus: eventStack.eventBus,
});

const frontendStack = new FrontendStack(app, `${prefix}-FrontendStack`, {
  ...stackProps,
  config,
  graphqlApiUrl: apiStack.api.graphqlUrl,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
});

void stepFunctionStack;
void frontendStack;

app.synth();
