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

type SummarizeTextOptions = {
    title?: string | null;
};

type ProcessFileResult = RecordProcessingResult & {
    title: string | null;
};

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

    async summarizeText(
        text: string,
        options?: SummarizeTextOptions,
    ): Promise<RecordSummaryResult> {
        const model = this.llmProvider.languageModel(
            Bun.env.MISTRAL_SUMMARY_MODEL ?? "mistral-small-latest",
        );

        const prompt = [
            "You are a helpful assistant that summarizes call transcripts.",
            "Return the answer only in Russian.",
            "",
            options?.title
                ? `Use this call title as additional context: ${options.title}`
                : "If a call title was not provided on upload, infer the context from the transcript only and generate a short, meaningful Russian title for the call.",
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
            "Also evaluate the overall quality of the call and return qualityScore as a number from 0 to 100.",
            "Use these rough anchors:",
            "- 0-30: very poor call quality, no useful outcome, major communication problems",
            "- 31-60: weak or average call, partial understanding, weak qualification or follow-up",
            "- 61-80: good call, clear communication, useful progress, mostly correct handling",
            "- 81-100: excellent call, strong structure, good discovery, clear next steps, high business value",
            "If the transcript is too short, corrupted, empty, or insufficient for a fair assessment, return qualityScore as null.",
            "",
            options?.title
                ? "If a title was provided on upload, return title as null."
                : "If a title was not provided on upload, return the generated title in the title field.",
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

    async processFile(
        file: File,
        title?: string | null,
    ): Promise<ProcessFileResult> {
        const transcription = await this.transcribeAudio(file);
        const normalizedTitle = title?.trim() || null;
        const summarized = await this.summarizeText(transcription.text, {
            title: normalizedTitle,
        });

        return recordProcessingResultSchema.parse({
            transcription: transcription.text,
            title: normalizedTitle ?? summarized.title ?? null,
            durationSec: transcription.durationSec,
            summary: summarized.summary,
            tags: summarized.tags,
            checkboxes: summarized.checkboxes,
            qualityScore: summarized.qualityScore,
        }) as ProcessFileResult;
    }
}

export default RecordAiService;
