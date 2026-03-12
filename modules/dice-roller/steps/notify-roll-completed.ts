import type { PublishRollInput } from '@puzzlebottom-tabletop-tools/graphql-types'
import type { Handler } from 'aws-lambda'

import { publishRollCompleted } from '../shared/notify-appsync.js'

const APPSYNC_GRAPHQL_URL = process.env.APPSYNC_GRAPHQL_URL!

export const handler: Handler<PublishRollInput, void> = async (event) => {
  await publishRollCompleted(APPSYNC_GRAPHQL_URL, event)
}
