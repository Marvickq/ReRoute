import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

function getEventBridgeConfig() {
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
  const eventBusName =
    process.env.REROUTE_AWS_EVENTBRIDGE_BUS_NAME ||
    process.env.MY_AWS_EVENTBRIDGE_BUS_NAME ||
    process.env.AWS_EVENTBRIDGE_BUS_NAME ||
    "reroute-event-bus";

  return { accessKeyId, secretAccessKey, region, eventBusName };
}

export function isEventBridgeConfigured(): boolean {
  const { accessKeyId, secretAccessKey } = getEventBridgeConfig();
  return !!(accessKeyId && secretAccessKey);
}

let eventBridgeClientInstance: EventBridgeClient | null = null;

function getEventBridgeClient(): EventBridgeClient {
  const { accessKeyId, secretAccessKey, region } = getEventBridgeConfig();
  if (!eventBridgeClientInstance) {
    eventBridgeClientInstance = new EventBridgeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return eventBridgeClientInstance;
}

export type ReRouteEventType =
  | "LotCreated"
  | "BedrockAnalysisCompleted"
  | "SafetyHazardFlagged"
  | "FacilityRouted"
  | "PassportGenerated"
  | "VerificationUpdated";

/**
 * Publishes a custom event to Amazon EventBridge event bus
 */
export async function publishReRouteEvent(
  eventType: ReRouteEventType,
  lotId: string,
  detailPayload: Record<string, unknown>
): Promise<void> {
  if (!isEventBridgeConfigured()) {
    console.log(`[EventBridge Mock] Published event ${eventType} for lot ${lotId}`);
    return;
  }

  try {
    const { eventBusName } = getEventBridgeConfig();
    const client = getEventBridgeClient();
    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: "reroute.ewaste",
          DetailType: eventType,
          Detail: JSON.stringify({
            lot_id: lotId,
            event_type: eventType,
            timestamp: new Date().toISOString(),
            ...detailPayload,
          }),
        },
      ],
    });

    const response = await client.send(command);
    console.log(`[EventBridge] Published event ${eventType} (FailedCount: ${response.FailedEntryCount || 0})`);
  } catch (err) {
    console.error(`[EventBridge Error] Failed to publish ${eventType} for lot ${lotId}:`, err);
  }
}
