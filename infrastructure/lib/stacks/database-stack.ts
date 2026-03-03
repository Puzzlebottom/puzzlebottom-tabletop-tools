import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { type Construct } from 'constructs'

import { type EnvironmentConfig } from '../config/environments.js'

interface DatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig
}

export class DatabaseStack extends cdk.Stack {
  public readonly dataTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props)

    const { config } = props

    this.dataTable = new dynamodb.Table(this, 'DataTable', {
      tableName: `${config.envName}-puzzlebottom-tabletop-tools`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: !config.isSandbox,
      removalPolicy: config.removalPolicy,
      timeToLiveAttribute: 'ttl',
    })

    // GSI1: GM#<gmUserId> + createdAt — list PlayTables by GM
    this.dataTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI2: INVITECODE#<code> + PLAYTABLE — lookup PlayTable by invite link
    this.dataTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // GSI3: TARGET#<playerId> + status#createdAt — list RollRequests by target player
    this.dataTable.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    new cdk.CfnOutput(this, 'DataTableName', {
      value: this.dataTable.tableName,
      exportName: `${config.envName}-puzzlebottom-table-name`,
    })

    new cdk.CfnOutput(this, 'DataTableArn', {
      value: this.dataTable.tableArn,
      exportName: `${config.envName}-puzzlebottom-table-arn`,
    })
  }
}
