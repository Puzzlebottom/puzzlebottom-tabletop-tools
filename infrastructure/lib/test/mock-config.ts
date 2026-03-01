import { RemovalPolicy } from 'aws-cdk-lib'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'

import type { EnvironmentConfig } from '../config/environments.js'

export const mockConfig: EnvironmentConfig = {
  envName: 'test-env',
  awsAccount: '123456789012',
  awsRegion: 'us-east-1',
  isSandbox: false,
  removalPolicy: RemovalPolicy.DESTROY,
  logRetention: RetentionDays.ONE_DAY,
}

export const sandboxConfig: EnvironmentConfig = {
  ...mockConfig,
  envName: 'sandbox-abc123',
  isSandbox: true,
  sandboxBranch: 'feature/my-branch',
}

export const sandboxConfigNoBranch: EnvironmentConfig = {
  ...mockConfig,
  envName: 'sandbox-xyz789',
  isSandbox: true,
  sandboxBranch: undefined,
}

export const developmentConfig: EnvironmentConfig = {
  ...mockConfig,
  envName: 'development',
}

export const productionConfig: EnvironmentConfig = {
  ...mockConfig,
  envName: 'production',
}
