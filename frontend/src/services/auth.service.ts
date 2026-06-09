import api from "@/lib/axios";
import type { User } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const authService = {
  login: (credentials: LoginCredentials) =>
    api.post<LoginResponse>("/v1/auth/login", credentials),

  logout: () => api.post("/v1/auth/logout"),

  me: () => api.get<User>("/v1/auth/me"),

  updateProfile: (data: Partial<Pick<User, "name" | "phone" | "institution">>) =>
    api.put<User>("/v1/auth/profile", data),

  changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
    api.post("/v1/auth/change-password", data),
};
