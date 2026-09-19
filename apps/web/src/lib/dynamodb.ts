import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import type { MaterialLot } from "@/types";

function getDynamoConfig() {
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
  const lotsTable =
    process.env.REROUTE_AWS_DYNAMODB_LOTS_TABLE ||
    process.env.MY_AWS_DYNAMODB_LOTS_TABLE ||
    process.env.AWS_DYNAMODB_LOTS_TABLE ||
    "ReRoute_Lots";
  const passportsTable =
    process.env.REROUTE_AWS_DYNAMODB_PASSPORTS_TABLE ||
    process.env.MY_AWS_DYNAMODB_PASSPORTS_TABLE ||
    process.env.AWS_DYNAMODB_PASSPORTS_TABLE ||
    "ReRoute_Passports";

  return { accessKeyId, secretAccessKey, region, lotsTable, passportsTable };
}

export function isDynamoDBConfigured(): boolean {
  const { accessKeyId, secretAccessKey } = getDynamoConfig();
  return !!(accessKeyId && secretAccessKey);
}

let docClientInstance: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  const { accessKeyId, secretAccessKey, region } = getDynamoConfig();
  if (!docClientInstance) {
    const rawClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    docClientInstance = DynamoDBDocumentClient.from(rawClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }
  return docClientInstance;
}

/**
 * Saves or updates a MaterialLot in DynamoDB
 */
export async function saveLotToDynamoDB(lot: MaterialLot): Promise<void> {
  const { lotsTable } = getDynamoConfig();
  const client = getDocClient();
  const command = new PutCommand({
    TableName: lotsTable,
    Item: {
      ...lot,
      pk: lot.lot_id,
      updated_at: new Date().toISOString(),
    },
  });
  await client.send(command);
}

/**
 * Fetches a single MaterialLot from DynamoDB by ID
 */
export async function getLotFromDynamoDB(lotId: string): Promise<MaterialLot | null> {
  const { lotsTable } = getDynamoConfig();
  const client = getDocClient();
  const command = new GetCommand({
    TableName: lotsTable,
    Key: { pk: lotId },
  });
  const response = await client.send(command);
  return (response.Item as MaterialLot) || null;
}

/**
 * Fetches all MaterialLots from DynamoDB
 */
export async function getAllLotsFromDynamoDB(): Promise<MaterialLot[]> {
  const { lotsTable } = getDynamoConfig();
  const client = getDocClient();
  const command = new ScanCommand({
    TableName: lotsTable,
  });
  const response = await client.send(command);
  const items = (response.Items as MaterialLot[]) || [];
  return items.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Saves a Digital Material Passport record to DynamoDB
 */
export async function savePassportToDynamoDB(passportData: any): Promise<void> {
  const { passportsTable } = getDynamoConfig();
  const client = getDocClient();
  const command = new PutCommand({
    TableName: passportsTable,
    Item: {
      pk: passportData.passport_id,
      ...passportData,
      created_at: new Date().toISOString(),
    },
  });
  await client.send(command);
}

/**
 * Fetches a Digital Material Passport from DynamoDB
 */
export async function getPassportFromDynamoDB(passportId: string): Promise<any | null> {
  const { passportsTable } = getDynamoConfig();
  const client = getDocClient();
  const command = new GetCommand({
    TableName: passportsTable,
    Key: { pk: passportId },
  });
  const response = await client.send(command);
  return response.Item || null;
}
