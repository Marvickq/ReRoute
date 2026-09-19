import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

const REGION = process.env.AWS_REGION || "us-east-1";
const STATE_MACHINE_ARN = process.env.AWS_STEP_FUNCTIONS_ARN || "";

export function isStepFunctionsConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_STEP_FUNCTIONS_ARN
  );
}

let sfnClientInstance: SFNClient | null = null;

function getSFNClient(): SFNClient {
  if (!sfnClientInstance) {
    sfnClientInstance = new SFNClient({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return sfnClientInstance;
}

/**
 * Triggers an AWS Step Functions state machine execution for a newly created lot
 */
export async function startLotWorkflowInStepFunctions(
  lotId: string,
  inputData: Record<string, unknown>
): Promise<{ executionArn?: string; started: boolean }> {
  if (!isStepFunctionsConfigured()) {
    console.log(`[Step Functions Mock] Workflow execution simulated for lot ${lotId}`);
    return { started: false };
  }

  try {
    const client = getSFNClient();
    const executionName = `LotWorkflow-${lotId}-${Date.now()}`;
    const command = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify({
        lot_id: lotId,
        started_at: new Date().toISOString(),
        ...inputData,
      }),
    });

    const response = await client.send(command);
    console.log(`[Step Functions] Started execution ${response.executionArn}`);
    return { executionArn: response.executionArn, started: true };
  } catch (err) {
    console.error(`[Step Functions Error] Failed to start execution for lot ${lotId}:`, err);
    return { started: false };
  }
}
