import api from "@/lib/axios";
import type { Genotype, PaginatedResponse } from "@/types";

export const genotypeService = {
  getAll: (params?: Record<string, unknown>) =>
    api.get<PaginatedResponse<Genotype> | Genotype[]>("/v1/genotypes", { params }),

  getOne: (id: number) =>
    api.get<Genotype>(`/v1/genotypes/${id}`),

  create: (data: Partial<Genotype>) =>
    api.post<Genotype>("/v1/genotypes", data),

  update: (id: number, data: Partial<Genotype>) =>
    api.put<Genotype>(`/v1/genotypes/${id}`, data),

  delete: (id: number) =>
    api.delete(`/v1/genotypes/${id}`),
};
