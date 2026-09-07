"use client";

import { useEffect, useState } from "react";
import { getDeployments, DeploymentInfo } from "@/lib/api";

interface VersionData {
    currentVersion: string;
    currentAge: string;
    previousVersion: string;
    previousAge: string;
    rolloutHistory: number;
    failedRollouts: number;
}

function deriveVersionData(deployments: DeploymentInfo[]): VersionData {
    if (deployments.length === 0) {
        return {
            currentVersion: "—",
            currentAge: "—",
            previousVersion: "—",
            previousAge: "—",
            rolloutHistory: 0,
            failedRollouts: 0,
        };
    }

    // Sort by age (shortest age = most recent deployment)
    const sorted = [...deployments].sort((a, b) => {
        return parseAge(a.age) - parseAge(b.age);
    });

    const current = sorted[0];
    const previous = sorted.length > 1 ? sorted[1] : null;
    const failedRollouts = deployments.filter(d => d.ready === 0).length;

    return {
        currentVersion: `${current.name} (${current.ready}/${current.replicas})`,
        currentAge: `Deployed ${current.age} ago`,
        previousVersion: previous ? `${previous.name} (${previous.ready}/${previous.replicas})` : "—",
        previousAge: previous ? `Deployed ${previous.age} ago` : "—",
        rolloutHistory: deployments.length,
        failedRollouts,
    };
}

function parseAge(age: string): number {
    // Convert age strings like "2h 15m", "45m", "15.4h" to minutes for comparison
    let totalMinutes = 0;
    const hourMatch = age.match(/([\d.]+)\s*h/);
    const minMatch = age.match(/([\d.]+)\s*m/);
    const dayMatch = age.match(/([\d.]+)\s*d/);
    if (dayMatch) totalMinutes += parseFloat(dayMatch[1]) * 1440;
    if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;
    if (minMatch) totalMinutes += parseFloat(minMatch[1]);
    return totalMinutes;
}

export function VersionIntelligence() {
    const [versionData, setVersionData] = useState<VersionData | null>(null);

    useEffect(() => {
        function fetchData() {
            getDeployments()
                .then((data) => setVersionData(deriveVersionData(data)))
                .catch(() => setVersionData({
                    currentVersion: "—",
                    currentAge: "—",
                    previousVersion: "—",
                    previousAge: "—",
                    rolloutHistory: 0,
                    failedRollouts: 0,
                }));
        }
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    const data = versionData;

    return (
        <div className="rounded-[12px] border border-[rgba(15,23,42,0.10)] bg-[rgba(255,255,255,0.02)] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#f7f8f8] mb-3">Version Intelligence</h3>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 text-center">
                    <p className="text-[9px] text-[#64748b]">Current Version</p>
                    <p className="text-[20px] font-bold text-[#f7f8f8] font-mono leading-none mt-1">{data ? data.currentVersion : "—"}</p>
                    <p className="text-[9px] text-[#64748b] mt-1">{data ? data.currentAge : "—"}</p>
                </div>
                <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 text-center">
                    <p className="text-[9px] text-[#64748b]">Previous Version</p>
                    <p className="text-[20px] font-bold text-[#94a3b8] font-mono leading-none mt-1">{data ? data.previousVersion : "—"}</p>
                    <p className="text-[9px] text-[#64748b] mt-1">{data ? data.previousAge : "—"}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 text-center">
                    <p className="text-[9px] text-[#64748b]">Rollout History</p>
                    <p className="text-[20px] font-bold text-[#22d3ee] font-mono leading-none mt-1">{data ? data.rolloutHistory : "—"}</p>
                    <p className="text-[9px] text-[#64748b] mt-1">total deployments</p>
                </div>
                <div className="rounded-md bg-[rgba(255,255,255,0.02)] border border-[rgba(15,23,42,0.10)] p-2.5 text-center">
                    <p className="text-[9px] text-[#64748b]">Failed Rollouts</p>
                    <p className="text-[20px] font-bold text-[#f85149] font-mono leading-none mt-1">{data ? data.failedRollouts : "—"}</p>
                    <p className="text-[9px] text-[#64748b] mt-1">ready = 0</p>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[rgba(15,23,42,0.10)]">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#f0883e] font-semibold">⚠ Rollback Available</span>
                    <button className="text-[10px] text-[#7170ff] hover:text-[#79c0ff]">Instant rollback ready</button>
                </div>
            </div>
        </div>
    );
}
