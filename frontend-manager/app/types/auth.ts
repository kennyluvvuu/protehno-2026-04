export type UserRole = "director" | "manager"

export interface User {
    id: number
    name: string
    fio: string | null
    email: string
    role: UserRole[]
    mangoUserId: number | null
}

export interface LoginCredentials {
    email: string
    password: string
}
