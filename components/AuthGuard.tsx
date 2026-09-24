"use client";

import {useRouter} from "next/navigation";
import {useEffect, useState} from "react";
import {isAuthenticated} from "@/lib/auth";

export function AuthGuard({children}: { children: React.ReactNode }) {
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.replace("/login");
            return;
        }

        setReady(true);
    }, [router]);

    if (!ready) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-red-100">
                <div className="rounded-2xl bg-white/80 px-6 py-4 text-sm font-medium text-gray-600 shadow-lg backdrop-blur-sm">
                    正在检查登录状态...
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
