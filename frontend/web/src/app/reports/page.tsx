"use client";

import { useEffect, useState } from "react";
import {
    getGeneratedReports,
    getReportDetail,
    generateReport,
    generateAllReports,
    getIncidents,
    type GeneratedReport,
    type Incident,
} from "@/lib/api";
import { FileText, Download, RefreshCw, Loader2, WifiOff, Eye, Sparkles } from "lucide-react";

export default function ReportsPage() {
    const [reports, setReports] = useState<GeneratedReport[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [selectedReport, setSelectedReport] = useState<GeneratedReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [reportsData, incidentsData] = await Promise.all([
                getGeneratedReports().catch(() => ({ reports: [], total: 0 })),
                getIncidents().catch(() => ({ incidents: [], total: 0 })),
            ]);
            setReports(reportsData.reports || []);
            setIncidents(incidentsData.incidents || []);
            setError(null);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleGenerateAll() {
        setGenerating(true);
        try {
            const result = await generateAllReports();
            alert(`Generated ${result.total} reports.`);
            await fetchData();
        } catch (e: any) {
            alert(`Failed: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    }

    async function handleGenerate(incidentId: string) {
        setGenerating(true);
        try {
            await generateReport(incidentId);
            await fetchData();
        } catch (e: any) {
            alert(`Failed: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    }

    async function handleView(reportId: string) {
        try {
            const detail = await getReportDetail(reportId);
            setSelectedReport(detail);
        } catch (e: any) {
            alert(`Failed to load report: ${e.message}`);
        }
    }

    function handleDownloadPdf(reportId: string) {
        // Opens the PDF-ready HTML in a new tab — user can Print → Save as PDF
        window.open(`/api/proxy/reports/${encodeURIComponent(reportId)}/pdf`, "_blank");
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar bg-[rgba(255,255,255,0.02)]">
            <header className="px-6 py-5 border-b border-zinc-800/60">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold text-zinc-100">Incident Reports</h1>
                        <p className="text-sm text-zinc-500 mt-0.5">Auto-generated incident postmortems with AI analysis</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {loading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
                        {error && <WifiOff className="w-4 h-4 text-amber-400" />}
                        <button
                            onClick={handleGenerateAll}
                            disabled={generating}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                            <Sparkles className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
                            {generating ? "Generating..." : "Generate Reports for All Incidents"}
                        </button>
                    </div>
                </div>
            </header>

            <div className="px-6 py-5 space-y-4">
                {/* Quick Generate from Incidents */}
                {incidents.length > 0 && reports.length === 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                        <p className="text-[12px] text-zinc-400 mb-3">Active incidents without reports — click to generate:</p>
                        <div className="flex flex-wrap gap-2">
                            {incidents.slice(0, 5).map((inc) => (
                                <button
                                    key={inc.id}
                                    onClick={() => handleGenerate(inc.id)}
                                    disabled={generating}
                                    className="px-3 py-1.5 text-[11px] font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 disabled:opacity-50"
                                >
                                    📋 {inc.id}: {inc.title.slice(0, 30)}...
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Report Detail View */}
                {selectedReport && (
                    <div className="bg-zinc-900/50 border border-emerald-500/30 rounded-lg p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-[15px] font-semibold text-zinc-100">{selectedReport.title}</h2>
                                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">{selectedReport.id} · {selectedReport.incident_id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleDownloadPdf(selectedReport.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md hover:bg-blue-500/20"
                                >
                                    <Download className="w-3 h-3" />Download PDF
                                </button>
                                <button
                                    onClick={() => setSelectedReport(null)}
                                    className="text-[11px] text-zinc-500 hover:text-zinc-300 px-2 py-1"
                                >
                                    ✕ Close
                                </button>
                            </div>
                        </div>
                        {/* Render markdown content */}
                        <div className="bg-[rgba(255,255,255,0.02)] border border-zinc-800 rounded-lg p-5 max-h-[600px] overflow-y-auto scrollbar">
                            <pre className="text-[12px] text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
                                {selectedReport.content || "No content available."}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Reports List */}
                {reports.length === 0 && !loading ? (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-6 py-12 text-center">
                        <FileText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500">
                            {error
                                ? "Start API Gateway and AI Engine to generate reports."
                                : "No reports generated yet. Click \"Generate Reports\" above to create postmortems from live incidents."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {reports.map((report) => (
                            <div key={report.id} className="flex items-center gap-4 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                                <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[13px] font-medium text-zinc-200 truncate">{report.title}</p>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${report.severity === "critical" ? "bg-red-500/10 text-red-400" : report.severity === "high" ? "bg-orange-500/10 text-orange-400" : "bg-amber-500/10 text-amber-400"}`}>{report.severity}</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                        {report.id} · Incident: {report.incident_id} · Duration: {report.duration || "—"} · Generated: {report.generated_at?.slice(0, 19) || "—"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => handleView(report.id)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700"
                                    >
                                        <Eye className="w-3 h-3" />View
                                    </button>
                                    <button
                                        onClick={() => handleDownloadPdf(report.id)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded hover:bg-blue-500/20"
                                    >
                                        <Download className="w-3 h-3" />PDF
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
