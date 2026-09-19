import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const REGION = process.env.AWS_REGION || "us-east-1";
const EVENT_BUS_NAME = process.env.AWS_EVENTBRIDGE_BUS_NAME || "reroute-event-bus";

export function isEventBridgeConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_EVENTBRIDGE_BUS_NAME
  );
}

let eventBridgeClientInstance: EventBridgeClient | null = null;

function getEventBridgeClient(): EventBridgeClient {
  if (!eventBridgeClientInstance) {
    eventBridgeClientInstance = new EventBridgeClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
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
    const client = getEventBridgeClient();
    const command = new PutEventsCommand({
      Entries: [
        {
          EventBusName: EVENT_BUS_NAME,
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
