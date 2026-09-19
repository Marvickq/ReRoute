import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const region = process.env.AWS_REGION || "us-east-1";
const bedrockClient = new BedrockRuntimeClient({ region });
const dbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const eventBridgeClient = new EventBridgeClient({ region });

/**
 * Standalone AWS Lambda Function Handler — Triggered by AWS API Gateway
 * Endpoint: POST /api/lots/analyze
 */
export const handler = async (event: any) => {
  console.log("AWS Lambda Execution Event:", JSON.stringify(event, null, 2));

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
    const lotId = body.lot_id || `RL-${Date.now()}`;
    const promptText = body.text || "E-waste material lot analysis request.";

    // 1. Invoke AWS Bedrock AI
    const bedrockCommand = new InvokeModelCommand({
      modelId: process.env.AWS_BEDROCK_MODEL_ID || "us.amazon.nova-pro-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        prompt: `Analyze this e-waste lot description and extract items and hazards: ${promptText}`,
      }),
    });

    const bedrockResponse = await bedrockClient.send(bedrockCommand);
    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));

    // 2. Persist to Amazon DynamoDB
    const dynamoCommand = new PutCommand({
      TableName: process.env.AWS_DYNAMODB_LOTS_TABLE || "ReRoute_Lots",
      Item: {
        pk: lotId,
        lot_id: lotId,
        status: "analyzed",
        analysis_result: responseBody,
        updated_at: new Date().toISOString(),
      },
    });
    await dbClient.send(dynamoCommand);

    // 3. Publish to Amazon EventBridge
    const eventCommand = new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.AWS_EVENTBRIDGE_BUS_NAME || "reroute-event-bus",
          Source: "reroute.ewaste.lambda",
          DetailType: "BedrockAnalysisCompleted",
          Detail: JSON.stringify({ lot_id: lotId, lambda_executed: true }),
        },
      ],
    });
    await eventBridgeClient.send(eventCommand);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "AWS Lambda execution successful",
        lot_id: lotId,
        analysis: responseBody,
      }),
    };
  } catch (err: any) {
    console.error("AWS Lambda Error:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: err.message || "Lambda processing error" }),
    };
  }
};
