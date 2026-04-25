import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, count, eq, ne } from "drizzle-orm";
import { userTable } from "./model";
import {
    CreateMangoLocalUser,
    CreateUser,
    GetUser,
    getUserSchema,
    type ResetUserPasswordPayload,
    type UpdateUserPayload,
} from "./schema";
import type { UserRole } from "../guard";

type MangoTelephonyNumber = {
    number: string;
    protocol?: string;
    order?: number;
    wait_sec?: number;
    status?: string;
};

type UserRow = typeof userTable.$inferSelect;

class UserService {
    constructor(private readonly db: NodePgDatabase) {
        this.db = db;
    }

    private static normalizeMangoProfile(user: UserRow): UserRow {
        return {
            ...user,
            mangoGroups: Array.isArray(user.mangoGroups)
                ? user.mangoGroups
                : null,
            mangoSips: Array.isArray(user.mangoSips) ? user.mangoSips : null,
            mangoTelephonyNumbers: Array.isArray(user.mangoTelephonyNumbers)
                ? user.mangoTelephonyNumbers
                : null,
        };
    }

    static withoutPasswordHash(user: UserRow): GetUser {
        const normalizedUser = UserService.normalizeMangoProfile(user);
        const { password_hash: _, ...userWithoutPassword } = normalizedUser;
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

    async createUserByDirector(user: CreateMangoLocalUser): Promise<GetUser> {
        try {
            const passwordHash = await Bun.password.hash(user.password);

            const [newUser] = await this.db
                .insert(userTable)
                .values({
                    email: user.email,
                    name: user.name,
                    fio: user.fio ?? null,
                    role: user.role,
                    mangoUserId: user.mangoUserId,
                    mangoLogin: user.mangoLogin ?? null,
                    mangoExtension: user.mangoExtension ?? null,
                    mangoPosition: user.mangoPosition ?? null,
                    mangoDepartment: user.mangoDepartment ?? null,
                    mangoMobile: user.mangoMobile ?? null,
                    mangoOutgoingLine: user.mangoOutgoingLine ?? null,
                    mangoAccessRoleId: user.mangoAccessRoleId ?? null,
                    mangoGroups: user.mangoGroups ?? null,
                    mangoSips: user.mangoSips ?? null,
                    mangoTelephonyNumbers:
                        (user.mangoTelephonyNumbers as
                            | MangoTelephonyNumber[]
                            | null
                            | undefined) ?? null,
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
                throw new Error("Email or Mango user id already in use");
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

    async resetUserPassword(
        userId: number,
        payload: ResetUserPasswordPayload,
    ): Promise<GetUser> {
        const existingUser = await this.getUserById(userId);

        if (!existingUser) {
            throw new Error("User not found");
        }

        const passwordHash = await Bun.password.hash(payload.password);

        const [updated] = await this.db
            .update(userTable)
            .set({ password_hash: passwordHash })
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
                    mangoLogin:
                        payload.mangoLogin === undefined
                            ? existingUser.mangoLogin
                            : payload.mangoLogin,
                    mangoExtension:
                        payload.mangoExtension === undefined
                            ? existingUser.mangoExtension
                            : payload.mangoExtension,
                    mangoPosition:
                        payload.mangoPosition === undefined
                            ? existingUser.mangoPosition
                            : payload.mangoPosition,
                    mangoDepartment:
                        payload.mangoDepartment === undefined
                            ? existingUser.mangoDepartment
                            : payload.mangoDepartment,
                    mangoMobile:
                        payload.mangoMobile === undefined
                            ? existingUser.mangoMobile
                            : payload.mangoMobile,
                    mangoOutgoingLine:
                        payload.mangoOutgoingLine === undefined
                            ? existingUser.mangoOutgoingLine
                            : payload.mangoOutgoingLine,
                    mangoAccessRoleId:
                        payload.mangoAccessRoleId === undefined
                            ? existingUser.mangoAccessRoleId
                            : payload.mangoAccessRoleId,
                    mangoGroups:
                        payload.mangoGroups === undefined
                            ? existingUser.mangoGroups
                            : payload.mangoGroups,
                    mangoSips:
                        payload.mangoSips === undefined
                            ? existingUser.mangoSips
                            : payload.mangoSips,
                    mangoTelephonyNumbers:
                        payload.mangoTelephonyNumbers === undefined
                            ? existingUser.mangoTelephonyNumbers
                            : payload.mangoTelephonyNumbers,
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
