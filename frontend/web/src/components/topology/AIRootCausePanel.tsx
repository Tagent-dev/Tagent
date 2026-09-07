"use client";

// ─── AI Root Cause Analysis Panel (right sidebar) ────────────────────────────

const TIMELINE = [
    { time: "7m ago", event: "Error rate spike", sub: "Payment Service", color: "#f85149" },
    { time: "6m ago", event: "Latency increase", sub: "Database Query", color: "#f0883e" },
    { time: "5m ago", event: "Connection pool", sub: "Exhausted", color: "#f0883e" },
    { time: "4m ago", event: "Automatic mitigation", sub: "Triggered", color: "#a371f7" },
    { time: "Now", event: "Issue identified", sub: "", color: "#3fb950" },
];

const FLOW_STEPS = ["High DB\nConnections", "Connection Pool\nExhausted", "Increased\nLatency", "Request\nFailures"];

export function AIRootCausePanel() {
    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(15,23,42,0.10)]">
                <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[#f7f8f8]">AI Root Cause Analysis</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ background: "rgba(248,81,73,0.15)", color: "#f85149", border: "1px solid rgba(248,81,73,0.4)" }}>Critical</span>
                </div>
                <span className="text-[10px] text-[#64748b] font-mono">Incident ID: INC-48291 ▾</span>
            </div>

            <div className="px-4 py-3 space-y-4 overflow-y-auto flex-1">
                {/* Headline */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(248,81,73,0.15)" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-[12px] font-semibold text-[#f7f8f8]">Database connection saturation detected</p>
                            <p className="text-[10px] text-[#64748b] mt-0.5">Started 7m ago</p>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[9px] text-[#64748b]">AI Confidence</p>
                        <p className="text-[18px] font-bold text-[#3fb950] font-mono leading-none">94%</p>
                    </div>
                </div>

                {/* Root Cause */}
                <div>
                    <h4 className="text-[11px] font-semibold text-[#f7f8f8] mb-1.5">Root Cause</h4>
                    <p className="text-[11px] text-[#64748b] leading-relaxed">Database connection pool exhaustion</p>
                    <p className="text-[10.5px] text-[#64748b] leading-relaxed mt-1">PostgreSQL connection pool has reached maximum capacity causing request queuing and timeouts.</p>
                </div>

                {/* Flow diagram */}
                <div className="flex items-center gap-1 overflow-x-auto py-2">
                    {FLOW_STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-1 shrink-0">
                            <div className="px-2 py-1.5 rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] text-center min-w-[70px]">
                                <p className="text-[9px] text-[#64748b] whitespace-pre-line leading-tight">{step}</p>
                            </div>
                            {i < FLOW_STEPS.length - 1 && (
                                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                                    <path d="M0 4H10M10 4L7 1M10 4L7 7" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                        </div>
                    ))}
                </div>

                {/* Affected Services + Blast Radius */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <h4 className="text-[11px] font-semibold text-[#f7f8f8] mb-2">Affected Services</h4>
                        <div className="flex items-center gap-3">
                            {["Checkout", "Orders", "Notifications"].map((s, i) => (
                                <div key={i} className="flex flex-col items-center gap-1">
                                    <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] flex items-center justify-center">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7170ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                        </svg>
                                    </div>
                                    <span className="text-[8.5px] text-[#64748b]">{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-[11px] font-semibold text-[#f7f8f8]">Blast Radius</h4>
                            <span className="text-[9px] text-[#f0883e]">Medium Impact</span>
                        </div>
                        <RadarMini />
                    </div>
                </div>

                {/* Recommended Action */}
                <div>
                    <h4 className="text-[11px] font-semibold text-[#f7f8f8] mb-1.5">Recommended Action</h4>
                    <p className="text-[11px] text-[#64748b]">Scale connection pool</p>
                    <p className="text-[10.5px] text-[#64748b]">Increase PostgreSQL connection pool from 20 to 50</p>
                    <div className="flex items-end justify-between mt-3 gap-3">
                        <button className="px-4 py-2 rounded-md text-[11px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #7170ff, #7c3aed)", boxShadow: "0 0 12px rgba(124,58,237,0.4)" }}>
                            Apply Remediation
                        </button>
                        <div className="text-right">
                            <p className="text-[9px] text-[#64748b]">Success Probability</p>
                            <p className="text-[16px] font-bold text-[#3fb950] font-mono leading-none">96%</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function RadarMini() {
    return (
        <svg width="70" height="70" viewBox="0 0 70 70">
            <defs>
                <radialGradient id="rca-radar">
                    <stop offset="0%" stopColor="#f85149" stopOpacity="0.5" />
                    <stop offset="60%" stopColor="#f85149" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#f85149" stopOpacity="0" />
                </radialGradient>
            </defs>
            {[10, 20, 30].map((r, i) => (
                <circle key={i} cx="35" cy="35" r={r} fill="none" stroke="#f85149" strokeWidth="0.5" strokeOpacity={0.4 - i * 0.1} />
            ))}
            <circle cx="35" cy="35" r="30" fill="url(#rca-radar)" />
            <line x1="35" y1="35" x2="60" y2="35" stroke="#f85149" strokeWidth="1" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 3px #f85149)" }}>
                <animateTransform attributeName="transform" type="rotate" from="0 35 35" to="360 35 35" dur="3s" repeatCount="indefinite" />
            </line>
            <circle cx="35" cy="35" r="2.5" fill="#f85149" style={{ filter: "drop-shadow(0 0 4px #f85149)" }} />
            {[{ x: 25, y: 28 }, { x: 42, y: 24 }, { x: 48, y: 42 }, { x: 28, y: 44 }].map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#f85149" opacity="0.8" />
            ))}
            <text x="35" y="60" textAnchor="middle" fontSize="8" fill="#64748b">~2 mins</text>
        </svg>
    );
}
