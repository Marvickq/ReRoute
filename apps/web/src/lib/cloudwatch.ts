import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
  CreateLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";

function getCloudWatchConfig() {
  const accessKeyId =
    process.env.REROUTE_AWS_ACCESS_KEY_ID ||
    process.env.MY_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    "";
  const secretAccessKey =
    process.env.REROUTE_AWS_SECRET_ACCESS_KEY ||
    process.env.MY_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "";
  const region =
    process.env.REROUTE_AWS_REGION ||
    process.env.MY_AWS_REGION ||
    process.env.AWS_REGION ||
    "us-east-1";
  const logGroupName =
    process.env.REROUTE_AWS_CLOUDWATCH_LOG_GROUP ||
    process.env.MY_AWS_CLOUDWATCH_LOG_GROUP ||
    process.env.AWS_CLOUDWATCH_LOG_GROUP ||
    "/reroute/ai-pipeline";

  return { accessKeyId, secretAccessKey, region, logGroupName };
}

export function isCloudWatchConfigured(): boolean {
  const { accessKeyId, secretAccessKey } = getCloudWatchConfig();
  return !!(accessKeyId && secretAccessKey);
}

let cwClientInstance: CloudWatchLogsClient | null = null;

function getCloudWatchClient(): CloudWatchLogsClient {
  const { accessKeyId, secretAccessKey, region } = getCloudWatchConfig();
  if (!cwClientInstance) {
    cwClientInstance = new CloudWatchLogsClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return cwClientInstance;
}

/**
 * Logs AI Pipeline metrics, token usage, latency, and hazard signals directly to Amazon CloudWatch Logs
 */
export async function logToCloudWatch(
  logStreamName: string,
  eventMessage: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (!isCloudWatchConfigured()) {
    console.log(`[Amazon CloudWatch Mock] Logged (${logStreamName}): ${eventMessage}`, metadata);
    return;
  }

  try {
    const { logGroupName } = getCloudWatchConfig();
    const client = getCloudWatchClient();
    const timestamp = Date.now();

    const logPayload = JSON.stringify({
      message: eventMessage,
      timestamp: new Date(timestamp).toISOString(),
      ...metadata,
    });

    const command = new PutLogEventsCommand({
      logGroupName,
      logStreamName,
      logEvents: [
        {
          timestamp,
          message: logPayload,
        },
      ],
    });

    await client.send(command);
    console.log(`[Amazon CloudWatch] Logged event to stream ${logStreamName}`);
  } catch (err: any) {
    // If log group doesn't exist, create it, then create the stream before retrying
    if (err.name === "ResourceNotFoundException") {
      try {
        const { logGroupName } = getCloudWatchConfig();
        const client = getCloudWatchClient();

        try {
          await client.send(
            new CreateLogGroupCommand({
              logGroupName,
            })
          );
        } catch (groupErr: any) {
          if (groupErr.name !== "ResourceAlreadyExistsException") {
            throw groupErr;
          }
        }

        try {
          await client.send(
            new CreateLogStreamCommand({
              logGroupName,
              logStreamName,
            })
          );
        } catch (streamErr: any) {
          if (streamErr.name !== "ResourceAlreadyExistsException") {
            throw streamErr;
          }
        }

        await logToCloudWatch(logStreamName, eventMessage, metadata);
      } catch (createErr) {
        console.error("[Amazon CloudWatch Stream Creation Error]:", createErr);
      }
    } else {
      console.error("[Amazon CloudWatch Log Error]:", err);
    }
  }
}
