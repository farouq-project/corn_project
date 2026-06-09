import api from "@/lib/axios";
import type { PaginatedResponse, Trial } from "@/types";

export const trialService = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Trial> | Trial[]>("/v1/trials", { params }),

  getOne: (id: number) =>
    api.get<Trial>(`/v1/trials/${id}`),

  create: (data: Partial<Trial>) =>
    api.post<Trial>("/v1/trials", data),

  update: (id: number, data: Partial<Trial>) =>
    api.put<Trial>(`/v1/trials/${id}`, data),

  delete: (id: number) =>
    api.delete(`/v1/trials/${id}`),

  assignGenotypes: (trialId: number, genotypes: Array<{ genotype_id: number; entry_number?: number; treatment_label?: string; is_check?: boolean }>) =>
    api.post(`/v1/trials/${trialId}/genotypes`, { genotypes }),

  assignResearchers: (trialId: number, researchers: Array<{ user_id: number; role: string }>) =>
    api.post(`/v1/trials/${trialId}/researchers`, { researchers }),
};
