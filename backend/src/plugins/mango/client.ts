import { createHash } from "node:crypto";

export type MangoClientConfig = {
    apiKey: string;
    apiSalt: string;
    baseUrl?: string;
};

export class MangoClient {
    private readonly apiKey: string;
    private readonly apiSalt: string;
    private readonly baseUrl: string;

    constructor(config: MangoClientConfig) {
        this.apiKey = config.apiKey;
        this.apiSalt = config.apiSalt;
        this.baseUrl =
            config.baseUrl?.replace(/\/$/, "") ??
            "https://app.mango-office.ru";
    }

    // Compute signature for outgoing request to Mango API
    private sign(jsonBody: string): string {
        return createHash("sha256")
            .update(this.apiKey + jsonBody + this.apiSalt)
            .digest("hex");
    }

    // Verify signature of an incoming webhook from Mango Office
    // Returns false if apiKey does not match or signature is wrong
    verifyWebhookSignature(
        receivedApiKey: string,
        receivedSign: string,
        jsonBody: string,
    ): boolean {
        if (receivedApiKey !== this.apiKey) return false;
        const expected = createHash("sha256")
            .update(this.apiKey + jsonBody + this.apiSalt)
            .digest("hex");
        return expected === receivedSign;
    }

    // Make an authenticated POST request to Mango VPBX API
    async post<T>(
        endpoint: string,
        params: Record<string, unknown>,
    ): Promise<T> {
        const jsonBody = JSON.stringify(params);
        const sign = this.sign(jsonBody);

        const form = new URLSearchParams();
        form.set("vpbx_api_key", this.apiKey);
        form.set("sign", sign);
        form.set("json", jsonBody);

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
        });

        if (!response.ok) {
            throw new Error(
                `Mango API error ${response.status} ${response.statusText} at ${endpoint}`,
            );
        }

        return response.json() as Promise<T>;
    }

    // Download a call recording by recording_id
    // Uses POST /vpbx/queries/recording/post with action="download"
    // Returns raw audio as an ArrayBuffer
    async downloadRecording(recordingId: string): Promise<ArrayBuffer> {
        const params = { recording_id: recordingId, action: "download" };
        const jsonBody = JSON.stringify(params);
        const sign = this.sign(jsonBody);

        const form = new URLSearchParams();
        form.set("vpbx_api_key", this.apiKey);
        form.set("sign", sign);
        form.set("json", jsonBody);

        const response = await fetch(
            `${this.baseUrl}/vpbx/queries/recording/post`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: form.toString(),
            },
        );

        if (!response.ok) {
            throw new Error(
                `Failed to download recording ${recordingId}: ${response.status} ${response.statusText}`,
            );
        }

        return response.arrayBuffer();
    }
}
