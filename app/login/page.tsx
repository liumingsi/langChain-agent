"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {FormEvent, useEffect, useState} from "react";
import {isAuthenticated, loginUser} from "@/lib/auth";
import {Bot} from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated()) {
            router.replace("/");
        }
    }, [router]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");

        if (!username.trim() || !password.trim()) {
            setError("请输入用户名和密码");
            return;
        }

        try {
            setLoading(true);
            await loginUser({username, password});
            router.push("/");
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "登录失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-100 p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg">
                        <Bot className="text-white" size={32} />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">AI 多功能智能体</h1>
                    <p className="mt-2 text-sm text-gray-500">登录后继续使用 AI 多功能智能体</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">用户名</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                            placeholder="请输入用户名"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                            placeholder="请输入密码"
                        />
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 font-medium text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {loading ? "登录中..." : "登录"}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-gray-500">
                    还没有账号？
                    <Link href="/register" className="ml-1 font-semibold text-orange-500 hover:text-orange-600">
                        立即注册
                    </Link>
                </p>
            </div>
        </main>
    );
}
