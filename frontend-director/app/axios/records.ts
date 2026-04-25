import { api } from "~/lib/axios-client";
import type { Record } from "~/types/record";

export interface UploadRecordPayload {
  file: File;
  title?: string;
  callTo?: string;
}

export interface UploadRecordResponse {
  id: number;
  userId: number | null;
  fileUri: string | null;
  status: "queued";
  message: string;
}

export const recordsApi = {
  getAdminFeed: async (): Promise<Record[]> => {
    const { data } = await api.get<Record[]>("/records/admin-feed");
    return data;
  },

  getById: async (id: number): Promise<Record> => {
    const { data } = await api.get<Record>(`/records/${id}`);
    return data;
  },

  getByMangoEntry: async (entryId: string): Promise<Record> => {
    const { data } = await api.get<Record>(
      `/records/by-mango-entry/${encodeURIComponent(entryId)}`,
    );
    return data;
  },

  upload: async (
    payload: UploadRecordPayload,
  ): Promise<UploadRecordResponse> => {
    const formData = new FormData();
    formData.append("file", payload.file);

    if (payload.title?.trim()) {
      formData.append("title", payload.title.trim());
    }

    if (payload.callTo?.trim()) {
      formData.append("callTo", payload.callTo.trim());
    }

    const { data } = await api.post<UploadRecordResponse>(
      "/records/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );

    return data;
  },
};
