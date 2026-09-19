import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { MaterialLot } from "@/types";

const REGION = process.env.AWS_REGION || "us-east-1";
const LOTS_TABLE = process.env.AWS_DYNAMODB_LOTS_TABLE || "ReRoute_Lots";
const PASSPORTS_TABLE = process.env.AWS_DYNAMODB_PASSPORTS_TABLE || "ReRoute_Passports";

export function isDynamoDBConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_DYNAMODB_LOTS_TABLE
  );
}

let docClientInstance: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClientInstance) {
    const rawClient = new DynamoDBClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
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
  const client = getDocClient();
  const command = new PutCommand({
    TableName: LOTS_TABLE,
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
  const client = getDocClient();
  const command = new GetCommand({
    TableName: LOTS_TABLE,
    Key: { pk: lotId },
  });
  const response = await client.send(command);
  return (response.Item as MaterialLot) || null;
}

/**
 * Fetches all MaterialLots from DynamoDB
 */
export async function getAllLotsFromDynamoDB(): Promise<MaterialLot[]> {
  const client = getDocClient();
  const command = new ScanCommand({
    TableName: LOTS_TABLE,
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
  const client = getDocClient();
  const command = new PutCommand({
    TableName: PASSPORTS_TABLE,
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
  const client = getDocClient();
  const command = new GetCommand({
    TableName: PASSPORTS_TABLE,
    Key: { pk: passportId },
  });
  const response = await client.send(command);
  return response.Item || null;
}
