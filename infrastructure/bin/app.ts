#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnvironment } from '../lib/config/environments';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';

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

void authStack;
void databaseStack;

app.synth();
