import { drizzle } from "drizzle-orm/node-postgres";

export function getDbConnection(databaseUrl: string) {
    return drizzle(databaseUrl);
}
