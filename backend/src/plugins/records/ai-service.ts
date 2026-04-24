import { createOpenAI } from "@ai-sdk/openai";
import { createMistral } from "@ai-sdk/mistral";
import {
    experimental_transcribe as transcribe,
    generateText,
    Output,
} from "ai";
import {
    type RecordProcessingResult,
    type RecordSummaryResult,
    recordProcessingResultSchema,
    recordSummaryResultSchema,
} from "./schema";

class RecordAiService {
    private readonly transcriptionProvider = createOpenAI({
        name: "whisperkit",
        baseURL: Bun.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
        apiKey: Bun.env.GROQ_API_KEY!,
    });

    private readonly llmProvider = createMistral({
        apiKey: Bun.env.MISTRAL_API_KEY!,
    });

    async transcribeAudio(file: File): Promise<{
        text: string;
        durationSec: number | null;
    }> {
        const model = this.transcriptionProvider.transcription(
            Bun.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo",
        );

        const transcript = await transcribe({
            model,
            audio: await file.arrayBuffer(),
        });

        return {
            text: transcript.text,
            durationSec:
                typeof transcript.durationInSeconds === "number"
                    ? Math.round(transcript.durationInSeconds)
                    : null,
        };
    }

    async summarizeText(text: string): Promise<RecordSummaryResult> {
        const model = this.llmProvider.languageModel(
            Bun.env.MISTRAL_SUMMARY_MODEL ?? "mistral-small-latest",
        );

        const prompt = [
            "You are a helpful assistant that summarizes call transcripts.",
            "Return the answer only in Russian.",
            "",
            "Summarize the following text:",
            text,
            "",
            "Besides regular tags, also extract checkbox items from the conversation and split them into 3 groups:",
            "1) tasks (what needs to be done),",
            "2) promises (what someone promises to do),",
            "3) agreements (what parties agreed on).",
            "",
            "Each checkbox item must contain:",
            "- label: string in Russian",
            "- checked: always false",
            "",
            "Also return one or more relevant tags for the summary.",
        ].join("\n");

        const summary = await generateText({
            model,
            prompt,
            output: Output.object({
                schema: recordSummaryResultSchema,
            }),
        });

        return summary.output;
    }

    async processFile(file: File): Promise<RecordProcessingResult> {
        const transcription = await this.transcribeAudio(file);
        const summarized = await this.summarizeText(transcription.text);

        return recordProcessingResultSchema.parse({
            transcription: transcription.text,
            durationSec: transcription.durationSec,
            summary: summarized.summary,
            tags: summarized.tags,
            checkboxes: summarized.checkboxes,
        });
    }
}

export default RecordAiService;
