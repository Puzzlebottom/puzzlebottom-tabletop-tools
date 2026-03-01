import type { SQSEvent, SQSRecord } from 'aws-lambda/trigger/sqs'

const MINIMAL_ATTRIBUTES: SQSRecord['attributes'] = {
  ApproximateReceiveCount: '1',
  SentTimestamp: '0',
  SenderId: 'test',
  ApproximateFirstReceiveTimestamp: '0',
}

/**
 * Creates a minimal SQSEvent for unit testing.
 * Only body is configurable per record; other fields use dummy values
 * since most handlers only use body.
 */
export function createSqsEvent(bodies: string[]): SQSEvent {
  return {
    Records: bodies.map((body, i) => ({
      body,
      messageId: `msg-${i}`,
      receiptHandle: `receipt-${i}`,
      attributes: MINIMAL_ATTRIBUTES,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: 'aws:sqs',
      eventSourceARN: '',
      awsRegion: 'us-east-1',
    })),
  }
}
