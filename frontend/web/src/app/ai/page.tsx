"use client";

import { useState, useEffect, useRef } from "react";
import { sendChat } from "@/lib/api";
import {
    Send, Sparkles, Plus, Trash2, MessageSquare, Clock,
    ChevronRight, Bot, User, Loader2,
} from "lucide-react";

// ===== Types =====

interface ChatMessage {
    role: "user" | "ai";
    text: string;
    timestamp: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

// ===== Local Storage Helpers =====

function loadSessions(): ChatSession[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem("tagent-ai-sessions");
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem("tagent-ai-sessions", JSON.stringify(sessions));
}

function generateId(): string {
    return crypto.randomUUID();
}

function generateTitle(message: string): string {
    // Use first 40 chars of first message as title
    const clean = message.replace(/\n/g, " ").trim();
    return clean.length > 40 ? clean.slice(0, 40) + "..." : clean;
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
}

// ===== Main Page =====

export default function AIPage() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load sessions from localStorage on mount
    useEffect(() => {
        const loaded = loadSessions();
        setSessions(loaded);
        if (loaded.length > 0) {
            setActiveSessionId(loaded[0].id);
        }
    }, []);

    // Save sessions whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            saveSessions(sessions);
        }
    }, [sessions]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [sessions, activeSessionId]);

    const activeSession = sessions.find(s => s.id === activeSessionId) || null;
    const messages = activeSession?.messages || [];

    function startNewChat() {
        const newSession: ChatSession = {
            id: generateId(),
            title: "New Chat",
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setInput("");
    }

    function deleteSession(id: string) {
        setSessions(prev => {
            const updated = prev.filter(s => s.id !== id);
            saveSessions(updated);
            return updated;
        });
        if (activeSessionId === id) {
            const remaining = sessions.filter(s => s.id !== id);
            setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
        }
    }

    function clearAllHistory() {
        setSessions([]);
        setActiveSessionId(null);
        localStorage.removeItem("tagent-ai-sessions");
    }

    async function handleSend() {
        if (!input.trim() || loading) return;
        const q = input.trim();
        setInput("");
        setLoading(true);

        // If no active session, create one
        let sessionId = activeSessionId;
        if (!sessionId) {
            const newSession: ChatSession = {
                id: generateId(),
                title: generateTitle(q),
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            setSessions(prev => [newSession, ...prev]);
            sessionId = newSession.id;
            setActiveSessionId(sessionId);
        }

        // Add user message
        const userMsg: ChatMessage = { role: "user", text: q, timestamp: new Date().toISOString() };
        setSessions(prev => prev.map(s => {
            if (s.id === sessionId) {
                const title = s.messages.length === 0 ? generateTitle(q) : s.title;
                return { ...s, title, messages: [...s.messages, userMsg], updatedAt: new Date().toISOString() };
            }
            return s;
        }));

        try {
            const result = await sendChat(q);
            const aiMsg: ChatMessage = { role: "ai", text: result.response, timestamp: new Date().toISOString() };
            setSessions(prev => prev.map(s => {
                if (s.id === sessionId) {
                    return { ...s, messages: [...s.messages, aiMsg], updatedAt: new Date().toISOString() };
                }
                return s;
            }));
        } catch (e: any) {
            const errMsg: ChatMessage = { role: "ai", text: `Error: ${e.message}. Make sure Ollama is running.`, timestamp: new Date().toISOString() };
            setSessions(prev => prev.map(s => {
                if (s.id === sessionId) {
                    return { ...s, messages: [...s.messages, errMsg], updatedAt: new Date().toISOString() };
                }
                return s;
            }));
        } finally {
            setLoading(false);
        }
    }

    function handleSuggestionClick(q: string) {
        setInput(q);
    }

    return (
        <div className="flex-1 flex overflow-hidden bg-[rgba(255,255,255,0.02)]">
            {/* ===== Sidebar: Chat History ===== */}
            {sidebarOpen && (
                <div className="w-[260px] shrink-0 border-r border-[rgba(15,23,42,0.10)] flex flex-col bg-[rgba(255,255,255,0.02)]">
                    {/* Sidebar Header */}
                    <div className="px-3 py-3 border-b border-[rgba(15,23,42,0.10)]">
                        <button
                            onClick={startNewChat}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-[#f7f8f8] bg-[rgba(15,23,42,0.10)] border border-[rgba(15,23,42,0.14)] hover:border-[rgba(15,23,42,0.20)] hover:bg-[rgba(15,23,42,0.14)] transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Chat
                        </button>
                    </div>

                    {/* Sessions List */}
                    <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                        {sessions.length === 0 ? (
                            <div className="text-center py-8">
                                <MessageSquare className="w-6 h-6 text-[rgba(15,23,42,0.20)] mx-auto mb-2" />
                                <p className="text-[11px] text-[#94a3b8]">No chat history</p>
                                <p className="text-[10px] text-[rgba(15,23,42,0.20)] mt-0.5">Start a conversation below</p>
                            </div>
                        ) : (
                            sessions.map(session => (
                                <div
                                    key={session.id}
                                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${activeSessionId === session.id ? "bg-[#7170ff]/10 border border-[#7170ff]/30" : "hover:bg-[rgba(255,255,255,0.02)] border border-transparent"}`}
                                    onClick={() => setActiveSessionId(session.id)}
                                >
                                    <MessageSquare className="w-3.5 h-3.5 text-[#64748b] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-[#f7f8f8] truncate font-medium">{session.title}</p>
                                        <p className="text-[9px] text-[#94a3b8] flex items-center gap-1 mt-0.5">
                                            <Clock className="w-2.5 h-2.5" />
                                            {formatTime(session.updatedAt)}
                                            <span className="ml-1">· {session.messages.length} msgs</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#94a3b8] hover:text-red-400 transition-all"
                                        title="Delete chat"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Sidebar Footer */}
                    {sessions.length > 0 && (
                        <div className="px-3 py-2 border-t border-[rgba(15,23,42,0.10)]">
                            <button
                                onClick={clearAllHistory}
                                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] text-[#94a3b8] hover:text-red-400 hover:bg-red-500/5 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" />
                                Clear all history
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ===== Main Chat Area ===== */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="px-5 py-3 border-b border-[rgba(15,23,42,0.10)] shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-1.5 rounded-md text-[#64748b] hover:text-[#f7f8f8] hover:bg-[rgba(15,23,42,0.10)] transition-colors"
                            title={sidebarOpen ? "Hide history" : "Show history"}
                        >
                            <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            <div>
                                <h1 className="text-[14px] font-semibold text-[#f7f8f8]">Tagent AI</h1>
                                <p className="text-[10px] text-[#94a3b8]">Your Kubernetes assistant with real-time infrastructure awareness</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] font-medium text-emerald-400">Local LLM</span>
                        </span>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                                <Sparkles className="w-7 h-7 text-emerald-400" />
                            </div>
                            <p className="text-[14px] text-[#f7f8f8] font-medium mb-1">Ask me anything about your cluster</p>
                            <p className="text-[11px] text-[#94a3b8] mb-6">I have real-time access to your K8s resources, metrics, and incidents</p>

                            {/* Pre-built Prompt Categories */}
                            <div className="w-full max-w-2xl space-y-4">
                                {/* Quick Starters */}
                                <div>
                                    <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3 text-emerald-400" /> Quick Start
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { q: "What is the cluster health?", icon: "🏥" },
                                            { q: "How many pods are failing?", icon: "⚠️" },
                                            { q: "Show me high-restart pods", icon: "🔄" },
                                            { q: "Any active incidents?", icon: "🚨" },
                                        ].map(item => (
                                            <button
                                                key={item.q}
                                                onClick={() => handleSuggestionClick(item.q)}
                                                className="flex items-center gap-2.5 px-4 py-3 text-left text-[12px] text-[#c9d1d9] bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] rounded-xl hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.14)] hover:bg-[#1c2129] transition-all group"
                                            >
                                                <span className="text-[16px]">{item.icon}</span>
                                                <span className="group-hover:translate-x-0.5 transition-transform">{item.q}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Performance & Resources */}
                                <div>
                                    <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                                        Performance
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { q: "Which nodes have high CPU usage?", icon: "🖥️" },
                                            { q: "Show memory pressure across nodes", icon: "💾" },
                                            { q: "Why is my service slow?", icon: "🐢" },
                                            { q: "What deployments are not ready?", icon: "📦" },
                                        ].map(item => (
                                            <button
                                                key={item.q}
                                                onClick={() => handleSuggestionClick(item.q)}
                                                className="flex items-center gap-2.5 px-4 py-3 text-left text-[12px] text-[#c9d1d9] bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] rounded-xl hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.14)] hover:bg-[#1c2129] transition-all group"
                                            >
                                                <span className="text-[16px]">{item.icon}</span>
                                                <span className="group-hover:translate-x-0.5 transition-transform">{item.q}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Troubleshooting & AI */}
                                <div>
                                    <p className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                        Troubleshoot & Investigate
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { q: "Root cause analysis for CrashLoopBackOff pods", icon: "🔍" },
                                            { q: "What changed in the last hour?", icon: "📋" },
                                            { q: "Show risk scores for all services", icon: "⚡" },
                                            { q: "Predict which service will fail next", icon: "🔮" },
                                        ].map(item => (
                                            <button
                                                key={item.q}
                                                onClick={() => handleSuggestionClick(item.q)}
                                                className="flex items-center gap-2.5 px-4 py-3 text-left text-[12px] text-[#c9d1d9] bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] rounded-xl hover:text-[#f7f8f8] hover:border-[rgba(15,23,42,0.14)] hover:bg-[#1c2129] transition-all group"
                                            >
                                                <span className="text-[16px]">{item.icon}</span>
                                                <span className="group-hover:translate-x-0.5 transition-transform">{item.q}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                            {m.role === "ai" && (
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="w-4 h-4 text-emerald-400" />
                                </div>
                            )}
                            <div className={`max-w-[75%] ${m.role === "user" ? "order-first" : ""}`}>
                                <div className={`px-4 py-3 rounded-xl text-[13px] leading-relaxed whitespace-pre-wrap ${m.role === "user"
                                    ? "bg-[#7170ff]/15 border border-[#7170ff]/30 text-[#f7f8f8]"
                                    : "bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] text-[#c9d1d9]"
                                    }`}>
                                    {m.text}
                                </div>
                                <p className="text-[9px] text-[rgba(15,23,42,0.20)] mt-1 px-1">
                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                            </div>
                            {m.role === "user" && (
                                <div className="w-7 h-7 rounded-lg bg-[#7170ff]/15 border border-[#7170ff]/30 flex items-center justify-center shrink-0 mt-0.5">
                                    <User className="w-4 h-4 text-blue-400" />
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div className="px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)]">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                    <span className="text-[12px] text-[#64748b]">Analyzing your cluster...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-5 py-3 border-t border-[rgba(15,23,42,0.10)] shrink-0">
                    <div className="flex gap-2 items-center">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                            placeholder="Ask about your cluster..."
                            className="flex-1 h-10 bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.14)] rounded-lg px-4 text-[13px] text-[#f7f8f8] placeholder:text-[rgba(15,23,42,0.20)] focus:outline-none focus:border-emerald-500/50 transition-colors"
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="h-10 px-5 bg-emerald-500 text-[rgba(255,255,255,0.02)] text-[12px] font-semibold rounded-lg hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
