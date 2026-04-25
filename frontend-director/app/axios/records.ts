import { api } from "~/lib/axios-client";
import { assertRequestCooldown } from "~/lib/request-guard";
import type { Record } from "~/types/record";

export interface RecordAudioMeta {
  url: string;
  downloadUrl: string;
}

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

  getAudioMeta: (id: number): RecordAudioMeta => {
    const downloadUrl = `/api/records/${id}/download`;
    return {
      url: downloadUrl,
      downloadUrl,
    };
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
    assertRequestCooldown("records:upload", 1500);
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
