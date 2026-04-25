import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { userTable } from "./model";
import { BaseUser, CreateUser, GetUser } from "./schema";

class UserService {
    constructor(private readonly db: NodePgDatabase) {
        this.db = db;
    }
    static withoutPasswordHash(user: BaseUser): GetUser {
        const { password_hash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    async createUser(user: CreateUser): Promise<GetUser> {
        try {
            const passwordHash = await Bun.password.hash(user.password);
            const [newUser] = await this.db
                .insert(userTable)
                .values({
                    email: user.email,
                    name: user.name,
                    mangoUserId: user.mangoUserId ?? null,
                    password_hash: passwordHash,
                })
                .returning();
            if (!newUser) {
                throw new Error("Failed to create user");
            }
            let { password_hash: _, ...userWithoutPassword } = newUser;
            return userWithoutPassword;
        } catch (error: any) {
            let errorCode = error?.code || error?.cause.code;
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
        return user;
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
}

export default UserService;
