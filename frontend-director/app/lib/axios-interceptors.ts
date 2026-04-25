import type { AxiosError } from "axios";
import { getApiErrorMessage } from "~/lib/api-error";
import { useAuthStore } from "~/stores/useAuthStore";
import { api } from "./axios-client";

const handleAuthFailure = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  useAuthStore.getState().reset();

  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
};

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401) {
      handleAuthFailure();
    }

    error.message = getApiErrorMessage(error);
    return Promise.reject(error);
  },
);
