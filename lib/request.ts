import axios, {AxiosError, AxiosInstance} from "axios";

export const API_BASE = "http://127.0.0.1:8001";
export const AUTH_STORAGE_KEY = "chef_auth_session";

export function getAuthToken(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const session = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || "null");
        return session?.token || null;
    } catch {
        return null;
    }
}

export const request: AxiosInstance = axios.create({
    baseURL: API_BASE,
    headers: {
        "Content-Type": "application/json",
    },
});

request.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

request.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ message?: string; detail?: string }>) => {
        if (error.response?.status === 401 && typeof window !== "undefined") {
            window.localStorage.removeItem(AUTH_STORAGE_KEY);
            window.localStorage.removeItem("thread_id");
        }
        return Promise.reject(error);
    },
);

export function getRequestErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError<{ message?: string; detail?: string }>(error)) {
        return error.response?.data?.message || error.response?.data?.detail || error.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
}

export default request;
