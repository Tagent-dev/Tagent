"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── First-Time Admin Setup Page ─────────────────────────────────────────────
// Shown after Helm install when no admin is configured yet.
// Admin fills in their details → stored → redirected to main dashboard.

export default function SetupPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        company: "",
        role: "",
        clusterName: "",
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        setSaving(true);

        // Store in localStorage (always works, even without backend)
        const adminData = {
            ...form,
            isAdmin: true,
            createdAt: new Date().toISOString(),
            id: crypto.randomUUID(),
        };
        localStorage.setItem("tagent_admin", JSON.stringify(adminData));
        localStorage.setItem("tagent_setup_complete", "true");

        // Also try to save to backend (PostgreSQL)
        try {
            await fetch("/api/proxy/auth/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    email: form.email,
                    phone: form.phone,
                    company: form.company,
                    role: form.role,
                    cluster_name: form.clusterName,
                }),
            });
        } catch {
            // Backend not available — localStorage is the fallback
        }

        setSaving(false);
        router.push("/");
    };

    const isValid = form.name && form.email && form.company && form.role;

    return (
        <div className="min-h-screen bg-[rgba(255,255,255,0.02)] flex items-center justify-center p-4">
            <div className="w-full max-w-[520px]">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <img src="/logo.png" alt="Tagent" width={48} height={48} className="rounded-xl" />
                    <div>
                        <h1 className="text-[22px] font-bold text-[#f7f8f8]">Tagent</h1>
                        <p className="text-[11px] text-[#64748b]">AI Operations Command</p>
                    </div>
                </div>

                {/* Setup Card */}
                <div className="rounded-xl border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-6" style={{ boxShadow: "0 16px 48px rgba(0,0,0,0.4)" }}>
                    {/* Progress */}
                    <div className="flex items-center gap-2 mb-6">
                        {[1, 2].map(s => (
                            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? "bg-[#7170ff]" : "bg-[rgba(15,23,42,0.10)]"}`} />
                        ))}
                    </div>

                    {step === 1 && (
                        <>
                            <h2 className="text-[18px] font-bold text-[#f7f8f8] mb-1">Welcome to Tagent</h2>
                            <p className="text-[12px] text-[#64748b] mb-6">Set up your administrator account to get started. This information is required to manage access to your Kubernetes monitoring platform.</p>

                            <div className="space-y-4">
                                <Field label="Full Name *" placeholder="e.g., Arjun Patel" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                                <Field label="Email Address *" placeholder="admin@yourcompany.com" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
                                <Field label="Phone Number" placeholder="+91 98765 43210" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                                <Field label="Company / Organization *" placeholder="Your Company Name" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
                            </div>

                            <button
                                onClick={() => setStep(2)}
                                disabled={!form.name || !form.email || !form.company}
                                className="w-full mt-6 py-2.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
                                style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)" }}
                            >
                                Continue →
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <h2 className="text-[18px] font-bold text-[#f7f8f8] mb-1">Your Role & Cluster</h2>
                            <p className="text-[12px] text-[#64748b] mb-6">Tell us about your role and the cluster you&apos;re monitoring.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] text-[#64748b] font-medium block mb-1.5">Your Role *</label>
                                    <select
                                        value={form.role}
                                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                        className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] focus:outline-none focus:border-[#7170ff]/50"
                                    >
                                        <option value="">Select your role...</option>
                                        <option value="SRE Engineer">SRE Engineer</option>
                                        <option value="DevOps Engineer">DevOps Engineer</option>
                                        <option value="Platform Engineer">Platform Engineer</option>
                                        <option value="Engineering Manager">Engineering Manager</option>
                                        <option value="CTO">CTO</option>
                                        <option value="VP Engineering">VP Engineering</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <Field label="Cluster Name (optional)" placeholder="e.g., prod-cluster-01" value={form.clusterName} onChange={v => setForm(f => ({ ...f, clusterName: v }))} />
                            </div>

                            <div className="flex items-center gap-3 mt-6">
                                <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-lg text-[12px] font-medium text-[#64748b] border border-[rgba(15,23,42,0.14)] hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.20)] transition-colors">
                                    ← Back
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!isValid || saving}
                                    className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
                                    style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)" }}
                                >
                                    {saving ? "Setting up..." : "Complete Setup & Enter Dashboard"}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                <p className="text-[10px] text-[#94a3b8] text-center mt-4">
                    Your data is stored securely in your cluster. No data leaves your infrastructure.
                </p>
            </div>
        </div>
    );
}

function Field({ label, placeholder, type = "text", value, onChange }: { label: string; placeholder: string; type?: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="text-[11px] text-[#64748b] font-medium block mb-1.5">{label}</label>
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] text-[12px] text-[#f7f8f8] placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-[#7170ff]/50"
            />
        </div>
    );
}
