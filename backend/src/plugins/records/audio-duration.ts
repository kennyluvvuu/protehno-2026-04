const FFPROBE_COMMAND = "ffprobe";

const parseDurationToSeconds = (value: string): number | null => {
    const parsed = Number.parseFloat(value.trim());

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return Math.max(1, Math.round(parsed));
};

export const detectAudioDurationSec = async (
    filePath: string,
): Promise<number | null> => {
    if (!filePath.trim()) return null;

    try {
        const process = Bun.spawn({
            cmd: [
                FFPROBE_COMMAND,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                filePath,
            ],
            stdout: "pipe",
            stderr: "pipe",
        });

        const [exitCode, stdout] = await Promise.all([
            process.exited,
            new Response(process.stdout).text(),
        ]);

        if (exitCode !== 0) {
            return null;
        }

        return parseDurationToSeconds(stdout);
    } catch {
        return null;
    }
};
