import { IStorage } from "./interface";
class LocalStorage implements IStorage {
    constructor(private basePath: string) {}
    async upload(key: string, file: File): Promise<string> {
        await Bun.write(`${this.basePath}/${key}/${file.name}`, file);
        return `${this.basePath}/${key}/${file.name}`;
    }

    async delete(key: string): Promise<void> {}

    getUrl(key: string): string {}

    async readIntoFile(key: string): Promise<File> {}

    async readIntoBuffer(key: string): Promise<Buffer> {}
}

export default LocalStorage;
