import { IStorage } from "./interface";
import { mkdir, rm } from "node:fs/promises";
import {
    dirname,
    extname,
    isAbsolute,
    join,
    normalize,
    resolve,
} from "node:path";

class LocalStorage implements IStorage {
    constructor(private basePath: string) {}

    private resolvePath(key: string): string {
        const normalizedKey = normalize(key);
        const base = resolve(this.basePath);
        const absolutePath = isAbsolute(normalizedKey)
            ? resolve(normalizedKey)
            : resolve(base, normalizedKey);

        if (absolutePath !== base && !absolutePath.startsWith(`${base}/`)) {
            throw new Error("Path is outside of storage base path");
        }

        return absolutePath;
    }

    private resolveFilePath(key: string, file?: File): string {
        const resolvedPath = this.resolvePath(key);

        if (file) {
            if (extname(resolvedPath)) {
                return resolvedPath;
            }

            return join(resolvedPath, file.name);
        }

        return resolvedPath;
    }

    async upload(key: string, file: File): Promise<string> {
        const fullPath = this.resolveFilePath(key, file);
        await mkdir(dirname(fullPath), { recursive: true });
        await Bun.write(fullPath, file);
        return fullPath;
    }

    async delete(key: string): Promise<void> {
        const fullPath = this.resolveFilePath(key);
        await rm(fullPath, { force: true, recursive: true });
    }

    getUrl(key: string): string {
        return this.resolveFilePath(key);
    }

    async readIntoFile(key: string): Promise<File> {
        const fullPath = this.resolveFilePath(key);
        const source = Bun.file(fullPath);

        return new File([source], fullPath.split("/").pop() ?? "file", {
            type: source.type || "application/octet-stream",
        });
    }

    async readIntoBuffer(key: string): Promise<Buffer> {
        const fullPath = this.resolveFilePath(key);
        return Buffer.from(await Bun.file(fullPath).arrayBuffer());
    }
}

export default LocalStorage;
