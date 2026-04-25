import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, count, eq, ne } from "drizzle-orm";
import { userTable } from "./model";
import {
    baseUserSchema,
    BaseUser,
    CreateUser,
    GetUser,
    getUserSchema,
    type UpdateUserPayload,
} from "./schema";
import type { UserRole } from "../guard";

class UserService {
    constructor(private readonly db: NodePgDatabase) {
        this.db = db;
    }

    static withoutPasswordHash(user: BaseUser): GetUser {
        const parsedUser = baseUserSchema.parse(user);
        const { password_hash: _, ...userWithoutPassword } = parsedUser;
        return getUserSchema.parse(userWithoutPassword);
    }

    async createUser(user: CreateUser): Promise<GetUser> {
        try {
            const passwordHash = await Bun.password.hash(user.password);

            const [newUser] = await this.db
                .insert(userTable)
                .values({
                    email: user.email,
                    name: user.name,
                    fio: user.fio ?? null,
                    role: user.role,
                    mangoUserId: user.mangoUserId ?? null,
                    password_hash: passwordHash,
                })
                .returning();

            if (!newUser) {
                throw new Error("Failed to create user");
            }

            return UserService.withoutPasswordHash(newUser);
        } catch (error: any) {
            const errorCode = error?.code || error?.cause?.code;
            if (errorCode === "23505") {
                throw new Error("Email already in use");
            }
            throw error;
        }
    }

    async getUserById(id: number): Promise<GetUser | undefined> {
        const [user] = await this.db
            .select()
            .from(userTable)
            .where(eq(userTable.id, id));

        if (!user) {
            return undefined;
        }

        return UserService.withoutPasswordHash(user);
    }

    async getUserByEmail(email: string): Promise<GetUser | undefined> {
        const [user] = await this.db
            .select()
            .from(userTable)
            .where(eq(userTable.email, email));

        if (!user) {
            return undefined;
        }

        return UserService.withoutPasswordHash(user);
    }

    async validateCredentials(
        email: string,
        password: string,
    ): Promise<GetUser | undefined> {
        const [user] = await this.db
            .select()
            .from(userTable)
            .where(eq(userTable.email, email));

        if (!user) {
            return undefined;
        }

        const validPassword = await Bun.password.verify(
            password,
            user.password_hash,
        );

        if (!validPassword) {
            return undefined;
        }

        return UserService.withoutPasswordHash(user);
    }

    async getAllUsers(): Promise<GetUser[]> {
        const users = await this.db.select().from(userTable);
        return users.map(UserService.withoutPasswordHash);
    }

    async getUserByMangoUserId(
        mangoUserId: number,
    ): Promise<GetUser | undefined> {
        const [user] = await this.db
            .select()
            .from(userTable)
            .where(eq(userTable.mangoUserId, mangoUserId));

        if (!user) {
            return undefined;
        }

        return UserService.withoutPasswordHash(user);
    }

    async setMangoUserId(
        userId: number,
        mangoUserId: number | null,
    ): Promise<GetUser> {
        const [updated] = await this.db
            .update(userTable)
            .set({ mangoUserId })
            .where(eq(userTable.id, userId))
            .returning();

        if (!updated) {
            throw new Error("User not found");
        }

        return UserService.withoutPasswordHash(updated);
    }

    async countDirectors(excludeUserId?: number): Promise<number> {
        const conditions = [eq(userTable.role, "director")];

        if (typeof excludeUserId === "number") {
            conditions.push(ne(userTable.id, excludeUserId));
        }

        const [result] = await this.db
            .select({ total: count() })
            .from(userTable)
            .where(and(...conditions));

        return result?.total ?? 0;
    }

    async updateUser(
        userId: number,
        payload: UpdateUserPayload,
    ): Promise<GetUser> {
        const existingUser = await this.getUserById(userId);

        if (!existingUser) {
            throw new Error("User not found");
        }

        if (
            existingUser.role === "director" &&
            payload.role === "manager" &&
            (await this.countDirectors(userId)) === 0
        ) {
            throw new Error("Cannot demote the last director");
        }

        try {
            const [updated] = await this.db
                .update(userTable)
                .set({
                    name: payload.name ?? existingUser.name,
                    fio:
                        payload.fio === undefined
                            ? existingUser.fio
                            : payload.fio,
                    email: payload.email ?? existingUser.email,
                    mangoUserId:
                        payload.mangoUserId === undefined
                            ? existingUser.mangoUserId
                            : payload.mangoUserId,
                    role: payload.role ?? existingUser.role,
                })
                .where(eq(userTable.id, userId))
                .returning();

            if (!updated) {
                throw new Error("User not found");
            }

            return UserService.withoutPasswordHash(updated);
        } catch (error: any) {
            const errorCode = error?.code || error?.cause?.code;
            if (errorCode === "23505") {
                throw new Error("Email or Mango user id already in use");
            }
            throw error;
        }
    }

    async deleteUser(userId: number): Promise<void> {
        const existingUser = await this.getUserById(userId);

        if (!existingUser) {
            throw new Error("User not found");
        }

        if (
            existingUser.role === "director" &&
            (await this.countDirectors(userId)) === 0
        ) {
            throw new Error("Cannot delete the last director");
        }

        const deleted = await this.db
            .delete(userTable)
            .where(eq(userTable.id, userId))
            .returning({ id: userTable.id });

        if (!deleted.length) {
            throw new Error("User not found");
        }
    }
}

export default UserService;
