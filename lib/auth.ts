import request, {getRequestErrorMessage} from "@/lib/request";

const AUTH_KEY = "chef_auth_session";

export interface AuthSession {
  id?: number;
  username: string;
  email?: string;
  token: string;
  loginAt: number;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getAuthSession(): AuthSession | null {
  return readStorage<AuthSession | null>(AUTH_KEY, null);
}

export function isAuthenticated(): boolean {
  return !!getAuthSession();
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem("thread_id");
}

export async function registerUser(payload: { username: string; email: string; password: string }): Promise<AuthSession> {
  if (!payload.username.trim() || !payload.email.trim() || !payload.password.trim()) {
    throw new Error("请填写完整信息");
  }

  try {
    await request.post("/api/v1/auth/register", {
      username: payload.username.trim(),
      password: payload.password,
      email: payload.email.trim(),
    });
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "注册失败"));
  }

  return loginUser({username: payload.username.trim(), password: payload.password});
}

export async function loginUser(payload: { username: string; password: string }): Promise<AuthSession> {
  if (!payload.username.trim() || !payload.password.trim()) {
    throw new Error("请输入用户名和密码");
  }

  let data: { data?: { id?: number; username?: string; email?: string }; token?: string };
  try {
    const response = await request.post("/api/v1/auth/login", {
      username: payload.username.trim(),
      password: payload.password,
    });
    data = response.data;
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "登录失败"));
  }

  if (!data.token) {
    throw new Error("登录响应缺少 token");
  }

  const session: AuthSession = {
    id: data.data?.id,
    username: data.data?.username || payload.username.trim(),
    email: data.data?.email,
    token: data.token,
    loginAt: Date.now(),
  };

  saveAuthSession(session);
  return session;
}
