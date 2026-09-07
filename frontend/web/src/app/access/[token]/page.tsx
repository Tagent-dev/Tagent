"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

// ─── User Access via Unique Link ─────────────────────────────────────────────
// Team members access the dashboard through their unique token link.
// e.g., https://tagent.company.com/access/abc123xyz

export default function AccessPage() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;
    const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");

    useEffect(() => {
        // Check if this token exists in the users list
        const usersStr = localStorage.getItem("tagent_users");
        if (!usersStr) {
            setStatus("invalid");
            return;
        }
        const users = JSON.parse(usersStr);
        const user = users.find((u: any) => u.token === token);
        if (user) {
            // Get admin/company info
            const adminStr = localStorage.getItem("tagent_admin");
            const admin = adminStr ? JSON.parse(adminStr) : {};

            // Store current user session (non-admin)
            localStorage.setItem("tagent_current_user", JSON.stringify({
                ...user,
                company: admin.company || "",
                isAdmin: false,
                accessedAt: new Date().toISOString(),
            }));
            setStatus("valid");
            setUserInfo({ name: user.name, role: user.role, company: admin.company || "" });
            // Redirect to dashboard after showing welcome
            setTimeout(() => router.push("/"), 2500);
        } else {
            setStatus("invalid");
        }
    }, [token, router]);

    const [userInfo, setUserInfo] = useState<{ name: string; role: string; company: string } | null>(null);

    return (
        <div className="min-h-screen bg-[rgba(255,255,255,0.02)] flex items-center justify-center p-4">
            <div className="text-center">
                <img src="/logo.png" alt="Tagent" width={48} height={48} className="rounded-xl mx-auto mb-4" />
                {status === "loading" && (
                    <div>
                        <p className="text-[14px] text-[#f7f8f8] font-semibold">Verifying access...</p>
                        <p className="text-[11px] text-[#64748b] mt-1">Checking your unique access token</p>
                    </div>
                )}
                {status === "valid" && (
                    <div>
                        <p className="text-[14px] text-[#3fb950] font-semibold">✓ Access Verified</p>
                        {userInfo && (
                            <div className="mt-4 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-4 text-left">
                                <p className="text-[16px] font-bold text-[#f7f8f8]">Welcome, {userInfo.name}</p>
                                <div className="mt-2 space-y-1 text-[11px]">
                                    <p className="text-[#64748b]">Company: <span className="text-[#f7f8f8]">{userInfo.company}</span></p>
                                    <p className="text-[#64748b]">Role: <span className="text-[#f7f8f8]">{userInfo.role}</span></p>
                                </div>
                            </div>
                        )}
                        <p className="text-[11px] text-[#64748b] mt-3">Redirecting to dashboard...</p>
                    </div>
                )}
                {status === "invalid" && (
                    <div>
                        <p className="text-[14px] text-[#f85149] font-semibold">✗ Invalid Access Link</p>
                        <p className="text-[11px] text-[#64748b] mt-1">This link is invalid or has expired. Contact your administrator.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
