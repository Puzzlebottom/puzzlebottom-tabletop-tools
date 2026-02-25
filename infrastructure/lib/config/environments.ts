import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export interface EnvironmentConfig {
  envName: string;
  awsAccount: string;
  awsRegion: string;
  isSandbox: boolean;
  sandboxBranch?: string;
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

export function getSandboxConfig(sandboxIdentifier: string, sandboxBranch?: string): EnvironmentConfig {
  return {
    ...BASE_CONFIG,
    envName: `sandbox-${sandboxIdentifier}`,
    isSandbox: true,
    sandboxBranch,
    removalPolicy: RemovalPolicy.DESTROY,
    logRetention: RetentionDays.ONE_DAY,
  };
}

export function resolveEnvironment(): EnvironmentConfig {
  const envName = process.env.ENVIRONMENT;
  const sandboxIdentifier = process.env.SANDBOX_IDENTIFIER ?? process.env.SANDBOX_DEVELOPER;

  if (sandboxIdentifier) {
    const sandboxBranch = process.env.SANDBOX_BRANCH || undefined;
    return getSandboxConfig(sandboxIdentifier, sandboxBranch);
  }

  if (!envName) {
    throw new Error(
      'ENVIRONMENT or SANDBOX_IDENTIFIER env var must be set. ' +
      'Valid environments: development, staging, production. ' +
      'For sandboxes, set SANDBOX_IDENTIFIER=<branch-slug-shortsha>.'
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
