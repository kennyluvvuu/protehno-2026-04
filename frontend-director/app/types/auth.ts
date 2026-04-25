export type UserRole = "director" | "manager"

export interface User {
    id: number
    name: string
    email: string
    role: UserRole
    mangoUserId?: number | null
}

export interface LoginCredentials {
    email: string
    password: string
}
