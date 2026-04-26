import { IStorage } from "./interface";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type S3StorageOptions = {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
    publicBaseUrl?: string;
    signedUrlExpiresInSec?: number;
};

class S3Storage implements IStorage {
    private readonly client: S3Client;
    private readonly bucket: string;
    private readonly endpoint: string;
    private readonly region: string;
    private readonly forcePathStyle: boolean;
    private readonly publicBaseUrl?: string;
    private readonly signedUrlExpiresInSec: number;

    constructor(options: S3StorageOptions) {
        this.endpoint = options.endpoint;
        this.region = options.region;
        this.bucket = options.bucket;
        this.forcePathStyle = options.forcePathStyle ?? true;
        this.publicBaseUrl = options.publicBaseUrl;
        this.signedUrlExpiresInSec = options.signedUrlExpiresInSec ?? 3600;

        this.client = new S3Client({
            endpoint: this.endpoint,
            region: this.region,
            forcePathStyle: this.forcePathStyle,
            credentials: {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
            },
        });
    }

    private normalizeKey(key: string): string {
        const normalized = key.replace(/^\/+/, "").replace(/\\/g, "/");
        if (!normalized) {
            throw new Error("S3 key cannot be empty");
        }

        return normalized;
    }

    async upload(key: string, file: File): Promise<string> {
        const objectKey = this.normalizeKey(key);
        const body = new Uint8Array(await file.arrayBuffer());

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
                Body: body,
                ContentType: file.type || "application/octet-stream",
            }),
        );

        return objectKey;
    }

    async delete(key: string): Promise<void> {
        const objectKey = this.normalizeKey(key);

        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            }),
        );
    }

    getUrl(key: string): string {
        const objectKey = this.normalizeKey(key);

        if (this.publicBaseUrl) {
            return `${this.publicBaseUrl.replace(/\/+$/, "")}/${objectKey}`;
        }

        const base = this.endpoint.replace(/\/+$/, "");
        if (this.forcePathStyle) {
            return `${base}/${this.bucket}/${objectKey}`;
        }

        try {
            const url = new URL(base);
            return `${url.protocol}//${this.bucket}.${url.host}/${objectKey}`;
        } catch {
            return `${base}/${this.bucket}/${objectKey}`;
        }
    }

    async readIntoFile(key: string): Promise<File> {
        const objectKey = this.normalizeKey(key);

        const response = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            }),
        );

        if (!response.Body) {
            throw new Error(`S3 object "${objectKey}" has empty body`);
        }

        const bytes = await response.Body.transformToByteArray();
        const fileName = objectKey.split("/").pop() ?? "file";
        const contentType = response.ContentType || "application/octet-stream";

        return new File([Buffer.from(bytes)], fileName, { type: contentType });
    }

    async readIntoBuffer(key: string): Promise<Buffer> {
        const objectKey = this.normalizeKey(key);

        const response = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            }),
        );

        if (!response.Body) {
            throw new Error(`S3 object "${objectKey}" has empty body`);
        }

        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
    }

    async getSignedGetUrl(
        key: string,
        expiresInSec = this.signedUrlExpiresInSec,
    ): Promise<string> {
        const objectKey = this.normalizeKey(key);

        return getSignedUrl(
            this.client,
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            }),
            { expiresIn: expiresInSec },
        );
    }
}

export type { S3StorageOptions };
export default S3Storage;
