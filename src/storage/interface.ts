export interface IStorage {
    upload(key: string, file: File): Promise<string>;
    delete(key: string): Promise<void>;
    getUrl(key: string): string;
    readIntoFile(key: string): Promise<File>;
    readIntoBuffer(key: string): Promise<Buffer>;
}
