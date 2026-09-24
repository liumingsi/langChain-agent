"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Message } from "@/types/chat";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { AuthGuard } from "@/components/AuthGuard";
import {
  streamChat,
  getChatHistory,
  createChatSession,
  getChatSessions,
  deleteChatSession,
  deleteKnowledgeDocument,
  getKnowledgeDocuments,
  uploadImageToOss,
  uploadKnowledgeDocument,
  AuthExpiredError,
  stopChat,
} from "@/lib/api";
import type { KnowledgeDocument } from "@/lib/api";
import {
  BrainCircuit,
  Bot,
  Plus,
  LogOut,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Trash2,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { clearAuthSession, getAuthSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [processing, setProcessing] = useState(false);
  const [threadId, setThreadId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [sessions, setSessions] = useState<
      Array<{ thread_id: string; updated_at: string; title?: string; user_id?: number | null }>
  >([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([]);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotice = (type: "success" | "error", message: string) => {
    setNotice({ type, message });
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, 3000);
  };

  // 加载历史消息
  const loadHistory = async (id: string) => {
    try {
      const history = await getChatHistory(id);
      if (history && history.length > 0) {
        const loadedMessages: Message[] = history.map((msg, index) => {
          // 处理多模态消息
          let content = "";
          let imageUrl: string | undefined;

          if (typeof msg.content === "string") {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            // 提取文本和图片
            const parts = msg.content as {
              type: string;
              text?: string;
              url?: string;
            }[];
            for (const part of parts) {
              if (part.type === "text" && part.text) {
                content += part.text;
              } else if (part.type === "image" && part.url) {
                imageUrl = part.url;
              }
            }
          }

          return {
            id: `history_${index}_${Date.now()}`,
            role: msg.role as "user" | "assistant",
            content,
            imageUrl,
            timestamp: Date.now() - (history.length - index) * 1000,
          };
        });
        setMessages(loadedMessages);
        messageIdCounter.current = loadedMessages.length;
      }
    } catch (error) {
      console.error("加载历史消息失败:", error);
    }
  };

  const loadSessions = async () => {
    try {
        const list = await getChatSessions();
        console.log("加载会话列表:", list);
      setSessions(list);
    } catch (error) {
      console.error("加载会话列表失败:", error);
    }
  };

  const loadKnowledgeDocuments = async () => {
    try {
      setKnowledgeDocuments(await getKnowledgeDocuments());
    } catch (error) {
      console.error("加载知识库列表失败:", error);
    }
  };

  const selectSession = async (selectedThreadId: string) => {
    try {
      localStorage.setItem("thread_id", selectedThreadId);
      setThreadId(selectedThreadId);
      setMessages([]);
      messageIdCounter.current = 0;
      await loadHistory(selectedThreadId);
      setMobileHistoryOpen(false);
    } catch (error) {
      console.error("切换会话失败:", error);
    }
  };

  const handleDeleteSession = async (selectedThreadId: string) => {
    if (!window.confirm("确定要删除这条历史对话吗？")) return;

    try {
      await deleteChatSession(selectedThreadId);
      if (threadId === selectedThreadId) {
        localStorage.removeItem("thread_id");
        setThreadId("");
        setMessages([]);
        messageIdCounter.current = 0;
      }
      await loadSessions();
      showNotice("success", "历史对话已删除");
    } catch (error) {
      console.error("删除会话失败:", error);
      showNotice("error", "历史对话删除失败，请稍后重试");
    }
  };

  // 页面加载时保持空白新会话；只有用户点击历史记录或发送消息时才进入具体会话
  useEffect(() => {
    const session = getAuthSession();
    if (session) {
      setUserName(session.username);
    }

    const initSession = async () => {
      try {
        localStorage.removeItem("thread_id");
        setThreadId("");
        setMessages([]);
        messageIdCounter.current = 0;
        await loadSessions();
      } catch (error) {
        console.error("初始化会话失败:", error);
      }
      await loadKnowledgeDocuments();
    };

    void initSession();
  }, []);

  // 新建会话：仅清空当前会话，不提前创建后端会话
  const handleNewChat = async () => {
    try {
      localStorage.removeItem("thread_id");
      setThreadId("");
      setMessages([]);
      messageIdCounter.current = 0;
    } catch (error) {
      console.error("创建新会话失败:", error);
    }
  };

  const handleKnowledgeFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      await uploadKnowledgeDocument(file);
      await loadKnowledgeDocuments();
      showNotice("success", "文件上传成功");
    } catch (error) {
      console.error("上传知识库文件失败:", error);
      showNotice("error", "文件上传失败，请稍后重试");
    }
  };

  const handleDeleteKnowledgeDocument = async (key: string) => {
    if (!window.confirm("确定要删除这个知识库文件吗？")) return;

    try {
      await deleteKnowledgeDocument(key);
      await loadKnowledgeDocuments();
      showNotice("success", "知识库文件已删除");
    } catch (error) {
      console.error("删除知识库文件失败:", error);
      showNotice("error", "知识库文件删除失败，请稍后重试");
    }
  };

  const ensureThreadForSend = async (text:string): Promise<string> => {
    if (threadId) {
      return threadId;
    }

    const newThreadId = await createChatSession(text);
    localStorage.setItem("thread_id", newThreadId);
    setThreadId(newThreadId);
    return newThreadId;
  };

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 添加消息
  const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
    messageIdCounter.current += 1;
    const newMessage: Message = {
      ...message,
      id: `msg_${messageIdCounter.current}_${Date.now()}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  };

  const handleLogout = () => {
    clearAuthSession();
    localStorage.removeItem("thread_id");
    router.push("/login");
  };

  const handleStop = async () => {
    if (!processing || !threadId) return;

    try {
      await stopChat(threadId);
    } catch (error) {
      if (error instanceof AuthExpiredError) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      console.error("停止生成失败:", error);
    } finally {
      streamAbortControllerRef.current?.abort();
      streamAbortControllerRef.current = null;
      setMessages((prev) =>
        prev.map((message) =>
          message.streaming
            ? { ...message, streaming: false, content: message.content || "已停止生成" }
            : message,
        ),
      );
      setProcessing(false);
    }
  };

  // 处理发送消息
  const handleSend = async (text: string, file?: File) => {
    if (processing) return;
    const newText = text || "根据图片内容分析";
    const isNewConversation = !threadId;
    const activeThreadId = await ensureThreadForSend(newText);

    const removeFailedNewConversation = async () => {
      if (!isNewConversation) return;

      try {
        await deleteChatSession(activeThreadId);
      } catch (deleteError) {
        console.error("清理失败会话失败:", deleteError);
      }
      localStorage.removeItem("thread_id");
      setThreadId("");
      setMessages([]);
      messageIdCounter.current = 0;
    };

    let imageUrl: string | undefined;

    // 如果有图片，先上传到 OSS，再把公网地址发送给 agent
    if (file) {
      try {
        imageUrl = await uploadImageToOss(file);
      } catch (error) {
        console.error("图片上传失败:", error);
        await removeFailedNewConversation();
        addMessage({
          role: "assistant",
          content: "图片上传失败，请稍后重试。",
        });
        return;
      }
    }

    // 添加用户消息
    addMessage({
      role: "user",
      content: newText,
      imageUrl,
    });

    setProcessing(true);

    // 添加助手消息（流式输出）
    const assistantMessageId = addMessage({
      role: "assistant",
      content: "",
      streaming: true,
    }).id;
    let authExpired = false;
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    try {
      await streamChat(
        newText,
        (chunk) => {
          // 更新消息内容
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg,
            ),
          );
        },
        imageUrl,
        async (error) => {
          console.error("聊天失败:", error);
          if (error instanceof AuthExpiredError) {
            authExpired = true;
            clearAuthSession();
            router.replace("/login");
            return;
          }
          await removeFailedNewConversation();
          if (isNewConversation) {
            return;
          }
          try {
            await loadHistory(activeThreadId);
          } catch (historyError) {
            console.error("聊天失败后同步历史消息失败:", historyError);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: msg.content + `\n[错误]: ${error.message}`,
                      streaming: false,
                    }
                  : msg,
              ),
            );
          }
        },
        () => {
          // 流式输出完成
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, streaming: false }
                : msg,
            ),
          );
        },
        activeThreadId,
        abortController.signal,
      );
    } finally {
      if (streamAbortControllerRef.current === abortController) {
        streamAbortControllerRef.current = null;
      }
      if (!authExpired) {
        await loadSessions();
      }
      setProcessing(false);
    }
  };

  return (
    <AuthGuard>
      <div className="relative h-screen overflow-hidden">
        {notice && (
          <div
            className={`fixed left-1/2 top-4 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur-sm ${
              notice.type === "success"
                ? "border-green-200 bg-green-50/95 text-green-700"
                : "border-red-200 bg-red-50/95 text-red-700"
            }`}
            role="status"
          >
            {notice.type === "success" ? (
              <CheckCircle2 size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{notice.message}</span>
          </div>
        )}
        {/* 背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl animate-pulse" />
          <div
            className="absolute top-40 right-10 w-96 h-96 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
          <div
            className="absolute bottom-20 left-1/3 w-80 h-80 bg-red-100 rounded-full mix-blend-multiply filter blur-xl animate-pulse"
            style={{ animationDelay: "2s" }}
          />
        </div>

        <div className="relative z-10 flex h-screen flex-col">
          {/* 顶部标题栏 */}
          <header className="shrink-0 px-4 pt-4 pb-2">
            <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/50 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
                  <Bot className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    AI 多功能智能体
                  </h1>
                  <p className="text-sm text-gray-500">
                    {userName
                      ? `欢迎，${userName}`
                      : "智能方向私厨、基金，知识库、穿搭，支持多模态输入"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => knowledgeFileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-orange-200 bg-white text-orange-600 hover:bg-orange-50 rounded-xl transition-colors"
                  disabled={processing}
                >
                  <Upload size={18} />
                  <span>上传文件</span>
                </button>
                <input
                  ref={knowledgeFileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx,.md"
                  onChange={handleKnowledgeFileChange}
                  className="hidden"
                />
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors"
                >
                  <Plus size={18} />
                  <span>新建会话</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <LogOut size={18} />
                  <span>退出</span>
                </button>
              </div>
            </div>
          </header>

          {/* 主内容区域 */}
          <main className="flex-1 overflow-hidden px-4 pb-4 pt-2">
            <div className="mx-auto flex h-full w-full max-w-7xl gap-4">
              <aside
                className={`hidden xl:flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-lg transition-[width] duration-200 ${historyOpen ? "w-[300px] p-3" : "w-14 p-2"}`}
              >
                <div className={`flex items-center px-1 pt-1 ${historyOpen ? "justify-between" : "justify-center"}`}>
                  {historyOpen && <span className="font-semibold text-gray-700">工作区</span>}
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((open) => !open)}
                    className="rounded-lg p-2 text-gray-500 transition hover:bg-orange-50 hover:text-orange-600"
                    aria-label={historyOpen ? "收起左侧栏" : "展开左侧栏"}
                    title={historyOpen ? "收起左侧栏" : "展开左侧栏"}
                  >
                    {historyOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                  </button>
                </div>
                {historyOpen && (
                  <div className="mt-2 flex min-h-0 flex-1 flex-col divide-y divide-gray-200/70">
                    <section className="flex min-h-0 flex-1 flex-col pb-3">
                      <div className="mb-2 flex items-center gap-2 px-1 text-gray-700">
                        <MessageSquareText size={18} className="text-orange-500" />
                        <span className="font-semibold">对话历史</span>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {sessions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-3 text-sm text-gray-400">暂无会话记录</div>
                        ) : sessions.map((session) => (
                          <div key={session.thread_id} className={`w-full rounded-xl border p-3 transition ${threadId === session.thread_id ? "border-orange-200 bg-orange-50 text-orange-700 shadow-sm" : "border-gray-200 bg-white/70 text-gray-700"}`}>
                            <div className="flex items-start gap-2">
                              <button type="button" onClick={() => void selectSession(session.thread_id)} className="min-w-0 flex-1 text-left">
                                <p className="truncate text-sm font-medium">{session.title || "新会话"}</p>
                                <p className="mt-1 truncate text-[11px] text-gray-400">{new Date(session.updated_at).toLocaleString()}</p>
                              </button>
                              <button type="button" onClick={() => void handleDeleteSession(session.thread_id)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="删除会话" title="删除会话"><Trash2 size={15} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section className="flex min-h-0 flex-1 flex-col pt-3">
                      <div className="mb-2 flex items-center gap-2 px-1 text-gray-700">
                        <FileText size={18} className="text-orange-500" />
                        <span className="font-semibold">知识库</span>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {knowledgeDocuments.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-3 text-sm text-gray-400">暂无知识库文件</div>
                        ) : knowledgeDocuments.map((document) => (
                          <div key={document.key} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 p-3 text-gray-700">
                            <a href={document.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:text-orange-600">{document.title || document.key}</a>
                            <button type="button" onClick={() => void handleDeleteKnowledgeDocument(document.key)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="删除知识库文件" title="删除知识库文件"><Trash2 size={15} /></button>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </aside>

              <button
                type="button"
                onClick={() => setMobileHistoryOpen(true)}
                className="fixed left-4 top-24 z-30 rounded-full border border-white/70 bg-white/90 p-3 text-orange-600 shadow-lg backdrop-blur-sm transition hover:bg-orange-50 xl:hidden"
                aria-label="打开对话历史"
                title="打开对话历史"
              >
                <MessageSquareText size={20} />
              </button>

              {mobileHistoryOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => setMobileHistoryOpen(false)}
                    className="fixed inset-0 z-40 bg-black/20 xl:hidden"
                    aria-label="关闭对话历史"
                  />
                  <aside className="fixed inset-y-24 left-4 z-50 flex w-[min(300px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur-sm xl:hidden">
                    <div className="mb-3 flex items-center justify-between px-1 pt-1">
                      <div className="flex items-center gap-2 text-gray-700">
                        <MessageSquareText
                          size={18}
                          className="text-orange-500"
                        />
                        <span className="font-semibold">对话历史</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMobileHistoryOpen(false)}
                        className="rounded-lg p-2 text-gray-500 transition hover:bg-orange-50 hover:text-orange-600"
                        aria-label="关闭对话历史"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                      {sessions.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-3 text-sm text-gray-400">
                          暂无会话记录
                        </div>
                      ) : (
                        sessions.map((session) => (
                          <div
                            key={session.thread_id}
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              threadId === session.thread_id
                                ? "border-orange-200 bg-orange-50 text-orange-700 shadow-sm"
                                : "border-gray-200 bg-white/70 text-gray-700 hover:border-orange-200 hover:bg-orange-50/60"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => void selectSession(session.thread_id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <p className="truncate text-sm font-medium">
                                  {session.title || "新会话"}
                                </p>
                                <p className="mt-1 truncate text-[11px] text-gray-400">
                                  {new Date(session.updated_at).toLocaleString()}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteSession(session.thread_id)}
                                className="shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                aria-label="删除会话"
                                title="删除会话"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-gray-200/70 pt-3">
                      <div className="mb-2 flex items-center gap-2 px-1 text-gray-700">
                        <FileText size={18} className="text-orange-500" />
                        <span className="font-semibold">知识库</span>
                      </div>
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {knowledgeDocuments.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 p-3 text-sm text-gray-400">暂无知识库文件</div>
                        ) : knowledgeDocuments.map((document) => (
                          <div key={document.key} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/70 p-3 text-gray-700">
                            <a href={document.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:text-orange-600">{document.title || document.key}</a>
                            <button type="button" onClick={() => void handleDeleteKnowledgeDocument(document.key)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500" aria-label="删除知识库文件" title="删除知识库文件"><Trash2 size={15} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </aside>
                </>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/50 bg-white/60 shadow-lg backdrop-blur-sm">
                  <div className="h-full overflow-y-auto p-4">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-3">
                        <div className="p-4 bg-white/80 rounded-full mb-4">
                          <BrainCircuit
                            size={48}
                            className="text-orange-400"
                          />
                        </div>
                        <p className="text-lg font-medium text-gray-600">
                          智能方向私厨、基金，知识库、穿搭，支持多模态输入
                        </p>
                        <p className="text-sm mt-2 text-gray-400">
                          根据输入内容进行分析推荐
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message) => (
                          <ChatMessage key={message.id} message={message} />
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </div>
                </div>

                {/* 底部输入区域 */}
                <footer className="shrink-0 rounded-2xl bg-white/80 shadow-lg backdrop-blur-sm">
                  <ChatInput onSend={handleSend} onStop={() => void handleStop()} disabled={processing} />
                </footer>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
