"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard, Server, Network, AlertTriangle, Activity,
    ScrollText, ShieldAlert, MessageSquare, Video, Wrench,
    Moon, BookOpen, FileText, Settings, GitBranch, DollarSign,
    ClipboardList, Box, Scaling, Bell, User,
    HardDrive, Cpu,
} from "lucide-react";

const links = [
    {
        group: "Infrastructure", items: [
            { href: "/", icon: LayoutDashboard, label: "Dashboard" },
            { href: "/clusters", icon: Server, label: "Clusters" },
            { href: "/nodes", icon: HardDrive, label: "Nodes" },
            { href: "/pods", icon: Box, label: "Workloads" },
            { href: "/deployments", icon: GitBranch, label: "Deployments" },
            { href: "/topology", icon: Network, label: "Service Graph" },
        ]
    },
    {
        group: "Intelligence", items: [
            { href: "/incidents", icon: AlertTriangle, label: "Incidents", badge: 12 },
            { href: "/ai", icon: MessageSquare, label: "AI Insights" },
            { href: "/models", icon: Cpu, label: "AI Models" },
            { href: "/risks", icon: ShieldAlert, label: "Risk Scanner" },
            { href: "/reports", icon: FileText, label: "Reports" },
            { href: "/metrics", icon: Activity, label: "Metrics" },
        ]
    },
    {
        group: "Recovery", items: [
            { href: "/remediation", icon: Wrench, label: "Remediation" },
            { href: "/night-guardian", icon: Moon, label: "Night Guardian" },
            { href: "/autoscaling", icon: Scaling, label: "Autoscaling" },
        ]
    },
    {
        group: "Operations", items: [
            { href: "/logs", icon: Bell, label: "Alerts", badge: 3 },
            { href: "/briefing", icon: Video, label: "Briefing" },
            { href: "/cost", icon: DollarSign, label: "Cost" },
            { href: "/knowledge", icon: BookOpen, label: "Knowledge Base" },
            { href: "/audit", icon: ClipboardList, label: "Audit Log" },
            { href: "/integrations", icon: Settings, label: "Integrations" },
            { href: "/admin/users", icon: User, label: "User Management", adminOnly: true },
        ]
    },
];

export function Nav() {
    const path = usePathname();
    const [admin, setAdmin] = useState<{ name: string; role: string } | null>(null);
    const [isAdminUser, setIsAdminUser] = useState(true);

    useEffect(() => {
        const data = localStorage.getItem("tagent_admin");
        if (data) {
            const parsed = JSON.parse(data);
            setAdmin({ name: parsed.name, role: parsed.role });
        }
        // Check if current session is admin (not a user via unique link)
        const currentUser = localStorage.getItem("tagent_current_user");
        if (currentUser) {
            const user = JSON.parse(currentUser);
            setIsAdminUser(user.isAdmin === true);
        } else {
            // No current_user means they're the admin (accessed directly)
            setIsAdminUser(true);
        }
    }, []);
    return (
        <aside className="w-[200px] bg-[#0f1011] border-r border-[rgba(255,255,255,0.06)] flex flex-col shrink-0 relative z-10">
            {/* Logo */}
            <div className="px-4 py-3.5 border-b border-[rgba(255,255,255,0.06)]">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg, #5e6ad2, #7170ff)", boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 4px 12px -4px rgba(94,106,210,0.6)" }}
                    >
                        {/* Hexagon + bolt mark */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" opacity="0.9" />
                            <path d="M12.5 7.5 9 13h2.7l-.9 4 4-6h-2.6l.9-3.5Z" fill="#fff" />
                        </svg>
                    </span>
                    <div>
                        <span className="text-[14px] font-semibold text-[#f7f8f8] tracking-tight" style={{ fontWeight: 590 }}>Tagent</span>
                        <p className="text-[9px] text-[#62666d] -mt-0.5">AI Operations Command</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto scrollbar py-3 px-2.5 space-y-1">
                {links.map((g, gi) => (
                    <div key={gi} className={g.group ? "mt-4" : gi > 0 ? "mt-2 pt-2 border-t border-[rgba(15,23,42,0.06)]" : ""}>
                        {g.group && (
                            <p className="px-2.5 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                                {g.group}
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {g.items.map((l) => {
                                const active = path === l.href || (l.href !== "/" && path.startsWith(l.href));
                                return (
                                    <Link key={l.href} href={l.href} className={cn(
                                        "flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-200 group relative",
                                        active
                                            ? "bg-[#7170ff]/10 text-[#7170ff] font-semibold"
                                            : "text-slate-500 hover:text-slate-900 hover:bg-[rgba(15,23,42,0.04)]"
                                    )}>
                                        {active && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[#8b5cf6]" style={{ boxShadow: "0 0 8px rgba(101,49,247,0.6)" }} />
                                        )}
                                        <l.icon className={cn(
                                            "w-4 h-4 transition-colors shrink-0",
                                            active ? "text-[#7170ff]" : "text-slate-400 group-hover:text-slate-600"
                                        )} strokeWidth={active ? 2 : 1.5} />
                                        <span className="truncate">{l.label}</span>
                                        {"badge" in l && l.badge && (
                                            <span className={cn(
                                                "ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                                                l.badge > 5
                                                    ? "bg-red-500/20 border border-red-500/30 text-red-400"
                                                    : "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                                            )}>
                                                {l.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Bottom - User */}
            <div className="px-3 py-3 border-t border-[rgba(15,23,42,0.08)] space-y-2.5">

                {/* User */}
                <div className="flex items-center gap-2.5 px-2 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7170ff]/25 to-[#828fff]/25 border border-[#7170ff]/25 flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-[#7170ff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-800 font-medium truncate">{admin?.name || "Admin"}</p>
                        <p className="text-[9px] text-slate-500">{admin?.role || "Administrator"}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
