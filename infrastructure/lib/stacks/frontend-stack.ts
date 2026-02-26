import * as cdk from 'aws-cdk-lib';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

interface FrontendStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  graphqlApiUrl: string;
  userPoolId: string;
  userPoolClientId: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly amplifyApp: amplify.App;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { config, graphqlApiUrl, userPoolId, userPoolClientId } = props;

    const githubOwner = this.requireContext('githubOwner');
    const githubRepo = this.requireContext('githubRepo');
    const githubToken = cdk.SecretValue.secretsManager('github-token');

    this.amplifyApp = new amplify.App(this, 'AmplifyApp', {
      appName: `${config.envName}-data-pipeline`,
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: 1,
        applications: [
          {
            appRoot: 'frontend',
            frontend: {
              phases: {
                preBuild: {
                  commands: ['npm ci'],
                },
                build: {
                  commands: ['npm run build'],
                },
              },
              artifacts: {
                baseDirectory: 'dist',
                files: ['**/*'],
              },
              cache: {
                paths: ['node_modules/**/*'],
              },
            },
          },
        ],
      }),
      environmentVariables: {
        VITE_USER_POOL_ID: userPoolId,
        VITE_USER_POOL_CLIENT_ID: userPoolClientId,
        VITE_GRAPHQL_ENDPOINT: graphqlApiUrl,
      },
      platform: amplify.Platform.WEB,
    });

    const cfnApp = this.amplifyApp.node.defaultChild as cdk.CfnResource;
    cfnApp.addPropertyOverride('Repository', `https://github.com/${githubOwner}/${githubRepo}`);
    cfnApp.addPropertyOverride('AccessToken', githubToken.unsafeUnwrap());

    if (config.isSandbox) {
      if (config.sandboxBranch) {
        this.amplifyApp.addBranch(config.sandboxBranch, {
          autoBuild: true,
          stage: 'DEVELOPMENT',
        });
      }
    } else {
      const branchMap: Record<string, string> = {
        development: 'development',
        staging: 'staging',
        production: 'main',
      };

      const branchName = branchMap[config.envName];
      if (branchName) {
        this.amplifyApp.addBranch(branchName, {
          autoBuild: true,
          stage: config.envName === 'production' ? 'PRODUCTION' : 'DEVELOPMENT',
        });
      }
    }

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.appId,
      exportName: `${config.envName}-amplify-app-id`,
    });

    const amplifySubdomain = config.isSandbox
      ? (config.sandboxBranch ?? config.envName)
      : (config.envName === 'production' ? 'main' : config.envName);

    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', {
      value: `https://${amplifySubdomain}.${this.amplifyApp.defaultDomain}`,
      exportName: `${config.envName}-amplify-url`,
    });
  }

  private requireContext(key: string): string {
    const value = this.node.tryGetContext(key);
    if (!value) {
      throw new Error(
        `CDK context variable "${key}" is required. ` +
        `Pass it via: cdk deploy -c ${key}=<value>`
      );
    }
    return value;
  }
}
