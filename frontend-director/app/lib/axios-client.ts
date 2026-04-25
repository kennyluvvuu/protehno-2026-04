import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  timeout: Number(import.meta.env.VITE_TIMEOUT ?? 10000),
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});
