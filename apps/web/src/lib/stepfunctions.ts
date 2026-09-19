import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";

function getStepFunctionsConfig() {
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
  const stateMachineArn =
    process.env.REROUTE_AWS_STEP_FUNCTIONS_ARN ||
    process.env.MY_AWS_STEP_FUNCTIONS_ARN ||
    process.env.AWS_STEP_FUNCTIONS_ARN ||
    "";

  return { accessKeyId, secretAccessKey, region, stateMachineArn };
}

export function isStepFunctionsConfigured(): boolean {
  const { accessKeyId, secretAccessKey, stateMachineArn } = getStepFunctionsConfig();
  return !!(accessKeyId && secretAccessKey && stateMachineArn);
}

let sfnClientInstance: SFNClient | null = null;

function getSFNClient(): SFNClient {
  const { accessKeyId, secretAccessKey, region } = getStepFunctionsConfig();
  if (!sfnClientInstance) {
    sfnClientInstance = new SFNClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
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
    const { stateMachineArn } = getStepFunctionsConfig();
    const client = getSFNClient();
    const executionName = `LotWorkflow-${lotId}-${Date.now()}`;
    const command = new StartExecutionCommand({
      stateMachineArn,
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
