#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { resolveEnvironment } from '../lib/config/environments';

const app = new cdk.App();
const config = resolveEnvironment();

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

void stackProps; // stacks will consume this in subsequent commits

app.synth();
