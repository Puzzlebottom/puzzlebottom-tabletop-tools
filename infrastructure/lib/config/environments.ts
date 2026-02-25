import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export interface EnvironmentConfig {
  envName: string;
  awsAccount: string;
  awsRegion: string;
  isSandbox: boolean;
  removalPolicy: RemovalPolicy;
  logRetention: RetentionDays;
}

const AWS_ACCOUNT = process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID ?? '';
const AWS_REGION = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';

const BASE_CONFIG = {
  awsAccount: AWS_ACCOUNT,
  awsRegion: AWS_REGION,
  isSandbox: false,
};

export const environments: Record<string, EnvironmentConfig> = {
  development: {
    ...BASE_CONFIG,
    envName: 'development',
    removalPolicy: RemovalPolicy.RETAIN,
    logRetention: RetentionDays.ONE_MONTH,
  },
  staging: {
    ...BASE_CONFIG,
    envName: 'staging',
    removalPolicy: RemovalPolicy.RETAIN,
    logRetention: RetentionDays.THREE_MONTHS,
  },
  production: {
    ...BASE_CONFIG,
    envName: 'production',
    removalPolicy: RemovalPolicy.RETAIN,
    logRetention: RetentionDays.ONE_YEAR,
  },
};

export function getSandboxConfig(developerName: string): EnvironmentConfig {
  return {
    ...BASE_CONFIG,
    envName: `sandbox-${developerName}`,
    isSandbox: true,
    removalPolicy: RemovalPolicy.DESTROY,
    logRetention: RetentionDays.ONE_DAY,
  };
}

export function resolveEnvironment(): EnvironmentConfig {
  const envName = process.env.ENVIRONMENT;
  const sandboxDev = process.env.SANDBOX_DEVELOPER;

  if (sandboxDev) {
    return getSandboxConfig(sandboxDev);
  }

  if (!envName) {
    throw new Error(
      'ENVIRONMENT or SANDBOX_DEVELOPER env var must be set. ' +
      'Valid environments: development, staging, production. ' +
      'For sandboxes, set SANDBOX_DEVELOPER=<your-name>.'
    );
  }

  const config = environments[envName];
  if (!config) {
    throw new Error(
      `Unknown environment: "${envName}". ` +
      `Valid environments: ${Object.keys(environments).join(', ')}`
    );
  }

  return config;
}
