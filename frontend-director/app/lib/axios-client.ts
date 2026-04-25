import axios from "axios"

export const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
    timeout: Number(import.meta.env.VITE_TIMEOUT),
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
})
