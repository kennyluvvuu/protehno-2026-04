import { count, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { userTable } from "../plugins/user/model";

const seedLog = (...args: unknown[]) => console.log("[seed:users]", ...args);

const DIRECTOR_EMAIL = "director@example.com";
const DIRECTOR_PASSWORD = "director123";
const DIRECTOR_NAME = "director";
const DIRECTOR_FIO = "Директор Демо";

export async function seedUsers(db: NodePgDatabase) {
    seedLog("checking users table");

    const usersCountResult = await db
        .select({ totalUsers: count() })
        .from(userTable);

    const totalUsers = usersCountResult[0]?.totalUsers ?? 0;

    if (totalUsers > 0) {
        seedLog("skip seeding: users already exist", { totalUsers });
        return;
    }

    seedLog("users table is empty, creating initial director user", {
        email: DIRECTOR_EMAIL,
        role: "director",
    });

    const passwordHash = await Bun.password.hash(DIRECTOR_PASSWORD);

    const [createdUser] = await db
        .insert(userTable)
        .values({
            email: DIRECTOR_EMAIL,
            name: DIRECTOR_NAME,
            fio: DIRECTOR_FIO,
            role: "director",
            mangoUserId: null,
            password_hash: passwordHash,
        })
        .returning({
            id: userTable.id,
            email: userTable.email,
            role: userTable.role,
        });

    if (!createdUser) {
        throw new Error("Failed to create initial director user");
    }

    const [directorInDb] = await db
        .select({
            id: userTable.id,
            email: userTable.email,
            role: userTable.role,
        })
        .from(userTable)
        .where(eq(userTable.id, createdUser.id));

    seedLog(
        "director user created",
        directorInDb ?? createdUser,
        DIRECTOR_PASSWORD,
    );
}
