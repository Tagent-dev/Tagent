"use client";

import { useEffect, useState } from "react";

interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    permissions: string[];
    token: string;
    createdAt: string;
    lastAccess: string | null;
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "", role: "Viewer", permissions: ["view"] });
    const [admin, setAdmin] = useState<any>(null);

    useEffect(() => {
        const adminData = localStorage.getItem("tagent_admin");
        if (adminData) setAdmin(JSON.parse(adminData));

        // Try to fetch users from backend first
        async function fetchUsers() {
            try {
                const res = await fetch("/api/proxy/users");
                if (res.ok) {
                    const data = await res.json();
                    if (data.users && data.users.length > 0) {
                        setUsers(data.users);
                        return;
                    }
                }
            } catch { }
            // Fallback to localStorage
            const usersData = localStorage.getItem("tagent_users");
            if (usersData) setUsers(JSON.parse(usersData));
        }
        fetchUsers();
    }, []);

    const createUser = async () => {
        const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        const newUser: User = {
            id: crypto.randomUUID(),
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: form.role,
            permissions: form.permissions,
            token: token,
            createdAt: new Date().toISOString(),
            lastAccess: null,
        };

        // Try backend first
        try {
            const res = await fetch("/api/proxy/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name, email: form.email, phone: form.phone, role: form.role, permissions: form.permissions }),
            });
            if (res.ok) {
                const data = await res.json();
                newUser.id = data.id;
                newUser.token = data.token;
            }
        } catch { }

        // Always save to localStorage as well
        const updated = [...users, newUser];
        setUsers(updated);
        localStorage.setItem("tagent_users", JSON.stringify(updated));

        // Send email with unique access link
        const accessLink = `${window.location.origin}/access/${newUser.token}`;
        try {
            await fetch("/api/proxy/notify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel: "email",
                    title: `Tagent Dashboard Access - ${admin?.company || "Your Organization"}`,
                    message: `Hi ${newUser.name},\n\nYou have been granted access to the Tagent AI Operations Dashboard.\n\nYour unique access link:\n${accessLink}\n\nRole: ${newUser.role}\nCompany: ${admin?.company || ""}\nGranted by: ${admin?.name || "Administrator"}\n\nThis link is unique to you. Do not share it with others.\n\n— Tagent AI Operations Command`,
                    severity: "low",
                    link: accessLink,
                }),
            });
        } catch { }

        setForm({ name: "", email: "", phone: "", role: "Viewer", permissions: ["view"] });
        setShowForm(false);
    };

    const deleteUser = (id: string) => {
        const updated = users.filter(u => u.id !== id);
        setUsers(updated);
        localStorage.setItem("tagent_users", JSON.stringify(updated));
    };

    const getAccessLink = (token: string) => {
        if (typeof window !== "undefined") {
            return `${window.location.origin}/access/${token}`;
        }
        return `/access/${token}`;
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[rgba(255,255,255,0.02)] p-6">
            {/* Admin Info */}
            {admin && (
                <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/40 to-purple-500/40 border border-blue-500/30 flex items-center justify-center">
                                <span className="text-[14px] text-blue-200 font-bold">{admin.name?.charAt(0)?.toUpperCase()}</span>
                            </div>
                            <div>
                                <p className="text-[14px] font-semibold text-[#f7f8f8]">{admin.name}</p>
                                <p className="text-[11px] text-[#64748b]">{admin.email} · {admin.role} · {admin.company}</p>
                            </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(63,185,80,0.15)", color: "#3fb950" }}>Administrator</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-[18px] font-bold text-[#f7f8f8]">User Management</h1>
                    <p className="text-[12px] text-[#64748b] mt-0.5">Create and manage team members who can access this dashboard.</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)" }}
                >
                    + Create User
                </button>
            </div>

            {/* Create User Form */}
            {showForm && (
                <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-5 mb-4">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8] mb-4">Create New User</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-[11px] text-[#64748b] block mb-1">Full Name *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Team member name" className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-[#7170ff]/50" />
                        </div>
                        <div>
                            <label className="text-[11px] text-[#64748b] block mb-1">Email *</label>
                            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-[#7170ff]/50" />
                        </div>
                        <div>
                            <label className="text-[11px] text-[#64748b] block mb-1">Phone</label>
                            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-[#7170ff]/50" />
                        </div>
                        <div>
                            <label className="text-[11px] text-[#64748b] block mb-1">Role</label>
                            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] focus:outline-none focus:border-[#7170ff]/50">
                                <option value="Viewer">Viewer (read-only)</option>
                                <option value="Operator">Operator (view + execute)</option>
                                <option value="Manager">Manager (view + execute + configure)</option>
                            </select>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="text-[11px] text-[#64748b] block mb-1.5">Permissions</label>
                        <div className="flex flex-wrap gap-2">
                            {["view", "execute-remediation", "manage-integrations", "manage-autoscaling", "view-costs", "manage-alerts"].map(p => (
                                <label key={p} className="flex items-center gap-1.5 text-[11px] text-[#f7f8f8] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.permissions.includes(p)}
                                        onChange={e => {
                                            if (e.target.checked) setForm(f => ({ ...f, permissions: [...f.permissions, p] }));
                                            else setForm(f => ({ ...f, permissions: f.permissions.filter(x => x !== p) }));
                                        }}
                                        className="w-3 h-3 rounded border-[rgba(15,23,42,0.14)]"
                                    />
                                    {p}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={createUser} disabled={!form.name || !form.email} className="px-4 py-2 rounded-lg text-[11px] font-semibold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)" }}>
                            Create User & Generate Link
                        </button>
                        <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[11px] text-[#64748b] border border-[rgba(15,23,42,0.14)] hover:text-[#f7f8f8]">Cancel</button>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-4">
                <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Team Members ({users.length})</h3>
                {users.length === 0 ? (
                    <div className="py-8 text-center">
                        <p className="text-[12px] text-[#64748b]">No team members yet. Click &quot;Create User&quot; to add your first team member.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {users.map(u => (
                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] hover:border-[rgba(15,23,42,0.14)] transition-colors">
                                <div className="w-8 h-8 rounded-full bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] flex items-center justify-center">
                                    <span className="text-[11px] text-[#64748b] font-bold">{u.name.charAt(0).toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-[#f7f8f8]">{u.name}</p>
                                    <p className="text-[10px] text-[#64748b]">{u.email} · {u.role}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[9px] text-[#64748b]">Access Link:</p>
                                    <code className="text-[9px] text-[#7170ff] font-mono break-all">{getAccessLink(u.token)}</code>
                                </div>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(getAccessLink(u.token)); }}
                                    className="px-2 py-1 rounded text-[9px] text-[#64748b] border border-[rgba(15,23,42,0.14)] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] shrink-0"
                                >
                                    Copy Link
                                </button>
                                <button
                                    onClick={() => deleteUser(u.id)}
                                    className="px-2 py-1 rounded text-[9px] text-[#f85149] border border-[#f85149]/30 hover:bg-[#f85149]/10 shrink-0"
                                >
                                    Delete
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
