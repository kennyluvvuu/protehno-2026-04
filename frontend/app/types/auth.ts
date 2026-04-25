export type UserRole = "admin" | "user"

export interface Credentials {
    name: string
    password: string
}

export interface UserData {
    name: string
    password: string
    role: UserRole
}