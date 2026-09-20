import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
  LanguageCode,
} from "@aws-sdk/client-transcribe";

function getTranscribeConfig() {
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
  const languageCode =
    (process.env.REROUTE_AWS_TRANSCRIBE_LANGUAGE as LanguageCode) ||
    (process.env.MY_AWS_TRANSCRIBE_LANGUAGE as LanguageCode) ||
    LanguageCode.EN_US;

  return { accessKeyId, secretAccessKey, region, languageCode };
}

export function isTranscribeConfigured(): boolean {
  const { accessKeyId, secretAccessKey } = getTranscribeConfig();
  return !!(accessKeyId && secretAccessKey);
}

let transcribeClientInstance: TranscribeClient | null = null;

function getTranscribeClient(): TranscribeClient {
  const { accessKeyId, secretAccessKey, region } = getTranscribeConfig();
  if (!transcribeClientInstance) {
    transcribeClientInstance = new TranscribeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }
  return transcribeClientInstance;
}

/**
 * Transcribes an e-waste collector voice recording stored in Amazon S3 using Amazon Transcribe
 * @param s3Uri S3 object URI (e.g. s3://reroute-evidence-storage/evidence/voice-123.mp3)
 * @param mediaFormat Audio format (mp3, wav, m4a, ogg)
 * @returns Transcribed text string
 */
export async function transcribeAudioFromS3(
  s3Uri: string,
  mediaFormat: "mp3" | "wav" | "m4a" | "ogg" = "mp3"
): Promise<{ transcript: string; jobName: string; status: string }> {
  if (!isTranscribeConfigured()) {
    console.log(`[Amazon Transcribe Mock] Simulated voice transcription for ${s3Uri}`);
    return {
      transcript: "Collector voice note: e-waste items with lithium battery present, physical damage observed.",
      jobName: `mock-transcribe-${Date.now()}`,
      status: "COMPLETED",
    };
  }

  try {
    const client = getTranscribeClient();
    const { languageCode } = getTranscribeConfig();
    const jobName = `ReRouteVoice-${Date.now()}`;

    const startCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: languageCode,
      MediaFormat: mediaFormat,
      Media: {
        MediaFileUri: s3Uri,
      },
    });

    await client.send(startCommand);
    console.log(`[Amazon Transcribe] Started transcription job: ${jobName}`);

    // Poll job status until COMPLETED or FAILED
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;

      const getCommand = new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName,
      });

      const response = await client.send(getCommand);
      const job = response.TranscriptionJob;
      const status = job?.TranscriptionJobStatus;

      if (status === "COMPLETED") {
        const transcriptFileUri = job?.Transcript?.TranscriptFileUri;
        if (transcriptFileUri) {
          const res = await fetch(transcriptFileUri);
          const data = await res.json();
          const transcriptText = data.results?.transcripts?.[0]?.transcript || "";
          return { transcript: transcriptText, jobName, status: "COMPLETED" };
        }
        return { transcript: "", jobName, status: "COMPLETED" };
      }

      if (status === "FAILED") {
        throw new Error(`Amazon Transcribe Job Failed: ${job?.FailureReason}`);
      }
    }

    throw new Error("Amazon Transcribe Job Timed Out");
  } catch (err: any) {
    console.error("[Amazon Transcribe Error]:", err);
    throw err;
  }
}
