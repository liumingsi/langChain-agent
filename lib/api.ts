/**
 * API 调用封装
 */
import axios from "axios";
import request, {
  API_BASE,
  getAuthToken,
  getRequestErrorMessage,
} from "@/lib/request";
import { getAuthSession } from "@/lib/auth";
import { getCurrentAddress } from "@/lib/utils";

export class AuthExpiredError extends Error {
  constructor() {
    super("登录已过期，请重新登录");
    this.name = "AuthExpiredError";
  }
}
/**
 * 创建新会话
 */
export async function createChatSession(
  title: string = "新会话",
): Promise<string> {
  try {
    const response = await request.post("/api/v1/chat/sessions", {
      title,
      user_id: getAuthSession()?.id,
    });
    const data = response.data;
    if (data.success === false) {
      throw new Error(data.message || "创建会话失败");
    }
    return data.thread_id;
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "创建会话失败"));
  }
}

/**
 * 获取 OSS 预签名上传地址
 */
async function getOssPresignUrl(
  filename: string,
): Promise<{ uploadUrl: string; contentType?: string; accessUrl: string }> {
  try {
    const response = await request.get("/api/v1/oss/presign", {
      params: { filename },
    });
    const data = response.data;
    if (!data.uploadUrl || !data.accessUrl) {
      throw new Error("OSS 预签名接口返回数据不完整");
    }
    return data;
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "获取图片上传地址失败"));
  }
}

/**
 * 上传图片到 OSS，并返回公网访问地址
 */
export async function uploadImageToOss(file: File): Promise<string> {
  const extension = file.name.split(".").pop() || "jpg";
  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { uploadUrl, contentType, accessUrl } =
    await getOssPresignUrl(filename);

  try {
    await axios.put(uploadUrl, file, {
      headers: contentType ? { "Content-Type": contentType } : undefined,
    });
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "图片上传 OSS 失败"));
  }

  return accessUrl;
}

/**
 * 获取会话列表
 */
export async function getChatSessions(): Promise<
  Array<{
    thread_id: string;
    updated_at: string;
    title?: string;
    user_id?: number | null;
  }>
> {
  try {
    const response = await request.get("/api/v1/chat/sessions");
    const data = response.data;
    return Array.isArray(data.sessions) ? data.sessions : [];
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "获取会话列表失败"));
  }
}

export interface KnowledgeDocument {
  url: string;
  key: string;
  title: string;
}

/** 上传文档到知识库 */
export async function uploadKnowledgeDocument(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    await request.post("/api/v1/kb/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "上传知识库文件失败"));
  }
}

/** 获取知识库文档列表 */
export async function getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  try {
    const response = await request.get("/api/v1/kb/docs");
    const data = response.data;
    const documents = Array.isArray(data?.docs) ? data.docs : [];
    return Array.isArray(documents) ? documents : [];
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "获取知识库列表失败"));
  }
}

/** 删除知识库文档 */
export async function deleteKnowledgeDocument(key: string): Promise<void> {
  try {
    await request.delete("/api/v1/kb/docs", { params: { key } });
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "删除知识库文件失败"));
  }
}

/** 停止指定会话的流式生成 */
export async function stopChat(threadId: string): Promise<void> {
  try {
    await request.post(`/api/v1/chat/stop/${encodeURIComponent(threadId)}`);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new AuthExpiredError();
    }
    throw new Error(getRequestErrorMessage(error, "停止生成失败"));
  }
}

/**
 * 流式聊天
 */
export async function streamChat(
  message: string,
  onChunk: (chunk: string) => void,
  image_url?: string,
  onError?: (error: Error) => void | Promise<void>,
  onComplete?: () => void,
  threadId?: string,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const currentAddress = await getCurrentAddress();
    const response = await fetch(`${API_BASE}/api/v1/chat/stream`, {
      method: "POST",
      body: JSON.stringify({
        message,
        image_url: image_url || null,
        thread_id: threadId,
        system_address: currentAddress,
      }),
      headers: {
        "Content-Type": "application/json",
        ...(getAuthToken()
          ? { Authorization: `Bearer ${getAuthToken()}` }
          : {}),
      },
          signal,
    });

    if (response.status === 401) {
      throw new AuthExpiredError();
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || "聊天请求失败");
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法读取响应流");
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onComplete?.();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    await onError?.(error as Error);
  }
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(
  threadId: string,
): Promise<{ role: string; content: string }[]> {
  try {
    const response = await request.get(
      `/api/v1/chat/session/${encodeURIComponent(threadId)}`,
    );
    const data = response.data;
    return Array.isArray(data.messages) ? data.messages : [];
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "获取历史消息失败"));
  }
}

/**
 * 删除聊天会话
 */
export async function deleteChatSession(threadId: string): Promise<void> {
  try {
    await request.delete(`/api/v1/chat/session/${encodeURIComponent(threadId)}`);
  } catch (error) {
    throw new Error(getRequestErrorMessage(error, "删除会话失败"));
  }
}
