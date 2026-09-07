# Tagent — UI Mockup Prompts (for image generators)


## GLOBAL STYLE (prepend or keep in mind for every prompt)

> Enterprise SaaS dashboard UI, dark-mode-native, inspired by Linear + Vercel +
> Datadog. Near-black layered backgrounds (#08090a page, #0f1011 sidebar,
> #191a1b cards), hairline semi-transparent white borders, one indigo-violet
> accent (#7170ff) used sparingly for primary actions and active states. Text
> never pure white (#f7f8f8 primary, #8a8f98 muted). Inter font for UI,
> JetBrains Mono for IDs/metrics/timestamps. Status colors used only for
> meaning: green #10b981, amber #f5a623, red #eb5757, cyan #22d3ee, purple
> #a371f7. Rounded corners 8–12px, generous spacing, crisp 1px separators,
> subtle glows on live elements, thin scrollbars. Clean, calm, information-dense
> but not cluttered. 16:9 desktop, high detail, pixel-perfect, realistic
> product screenshot, no lorem-ipsum — use realistic Kubernetes/SRE data.

---

## SHARED SHELL

### Sidebar + TopBar (global chrome)
> Design the app shell for a Kubernetes AI-SRE platform called "Tagent".
> Left fixed sidebar 200px wide (#0f1011): at top a small hexagon-with-lightning-
> bolt gradient logo mark + "Tagent" wordmark and tiny "AI Operations Command"
> subtitle. Below, a vertical nav grouped into 4 labeled sections with 10px
> uppercase gray labels: INFRASTRUCTURE (Dashboard, Clusters, Nodes, Workloads,
> Deployments, Service Graph), INTELLIGENCE (Incidents with red "12" badge, AI
> Insights, AI Models, Risk Scanner, Reports, Metrics), RECOVERY (Remediation,
> Night Guardian, Autoscaling, Chaos Testing), OPERATIONS (Alerts with amber "3"
> badge, Briefing, Cost, Knowledge Base, Audit Log, Integrations, User
> Management). Active item has violet text, a violet left indicator bar and soft
> glow. Bottom of sidebar: circular user avatar chip with name + role. Top bar
> 56px, blurred glass: left = page title + subtitle, center = search field
> "Search anything…" with ⌘K hint, right = Environment dropdown, Cluster
> dropdown, Time-range dropdown, green pulsing "Live" pill, bell icon with red
> "12" notification badge, gradient circular avatar. Enterprise dark SaaS style.

---

## PAGES

### 1. Dashboard `/`
> AI Kubernetes operations command center dashboard. Top: row of 4 KPI cards —
> "Cluster Health 94/100" with Excellent pill, "Active Incidents 3" with AI
> confidence pill, "Active Services 128", "Autonomous Remediations 17"; each card
> has an icon chip, large number, status pill, and a subtle violet "AI tip"
> footer with an arrow. Middle: two-column grid — left (wide) an interactive
> Kubernetes topology graph on a faint starfield with curved animated edges
> colored by protocol (HTTP/gRPC/TCP/Kafka/Redis), zoom controls and a 2D/3D
> toggle on a right rail, plus small legends; right (380px) an "AI Incident
> Analysis" panel with severity badge, incident headline, confidence progress
> bar, a mini timeline, a root-cause block with a radar-sweep graphic, a blast-
> radius mini-stat trio, and a violet "Apply Remediation" button. Bottom: a
> 4-column real-time operations feed (Anomaly, Remediation, Deployment, AI
> Reasoning) with mono timestamps, colored dots, and severity badges.

### 2. AI Insights `/ai`
> Full-page AI assistant for Kubernetes, ChatGPT-style. Left 260px chat-history
> sidebar with a violet "New Chat" button and a list of past sessions (title,
> time, message count, delete icon) and "Clear all history". Main area header:
> sparkle "Tagent AI" title with a green "Local LLM" pill. Empty state: a large
> centered sparkle icon and pre-built prompt cards arranged in three labeled
> categories (Quick Start, Performance, Troubleshoot & Investigate), each a 2×2
> grid of cards with emoji and a short prompt. Bottom: a chat input with a green
> "Send" button. Show one example conversation with a violet user bubble on the
> right and an AI bubble with a bot avatar on the left. Calm enterprise dark UI.

### 3. Audit Log `/audit`
> Audit log page for an SRE platform. Header "Audit Log" with a total count.
> A single full-width data table with uppercase 10px gray column headers:
> Action, Target, Status, Message, Time. Status column uses small colored pills
> (success green, blocked red, pending amber). Target and Time in mono font.
> Zebra-free translucent rows, hairline separators. Minimal, clean, dark.

### 4. Autoscaling `/autoscaling`
> "Autonomous Scaling Intelligence" dashboard. Row of 6 compact stat cards:
> Current Replicas, Scale Events Today (with sparkline), Predicted Scale Events,
> Efficiency Score (radial ring), Resource Savings, AI Confidence (radial ring).
> Second row: a wide "Live Scaling Overview" panel + a 340px "AI Capacity
> Insights" sidebar. Third row: three cards — a Recharts area chart "Predictive
> Demand Forecasting" (actual vs predicted with a dashed reference line and
> legend), "Workload Elasticity Map", "Cost vs Performance Analysis". Fourth row:
> three cards — Autoscaling Timeline, Scaling Anomaly Detection, AI Optimization
> Recommendations. Data-dense, dark, violet accents on AI panels.

### 5. Briefing `/briefing`
> "AI Agent Daily Briefing" page. Header with a friendly bot icon and greeting.
> Row of 4 KPI cards: Issues Fixed Today, Docs Generated, Teams Involved, Avg Fix
> Time. Left column: a "Meet with Atlas" meeting card featuring an animated AI
> agent avatar and a violet "Join Daily Meeting" button; below it two charts — a
> horizontal Recharts bar chart "Issues Fixed by Team" and a pie chart "By
> Severity"; below that a vertical timeline "What the agents fixed today". Right
> column: an "Ask the Agent" Q&A chat panel. Premium dark enterprise style.

### 5b. Briefing — Meeting Room overlay `/briefing` (modal)
> Full-screen video-meeting overlay like Zoom/Google Meet/Teams, dark theme. A
> grid of participant tiles: one AI agent avatar tile (animated, glowing), your
> own camera/avatar tile, and several teammate tiles with name labels and mic
> status. Top-left a red "REC" dot with a running meeting timer. Bottom control
> bar with circular buttons: mic, camera, raise-hand, screen-share, chat, and a
> red "Leave" button. Right side a "Meeting Chat" panel with messages. Sleek,
> modern, dark.

### 8. Clusters `/clusters`
> "Cluster Intelligence Center" fleet dashboard. Row of 6 stat cards: Connected
> Clusters, Fleet Health Score /100 (radial ring), Active Workloads, Open
> Incidents, AI Confidence % (ring), Total Pods (sparkline). Second row: a wide
> "Cluster Fleet Map" panel with animated dashed flow edges between cluster nodes
> + a 340px "AI Fleet Intelligence" sidebar. Third row: three cards — Autonomous
> Operations, Cluster Health Distribution (donut), Fleet Resource Overview (bars).
> Enterprise multi-cluster dark UI.

### 9. Cost `/cost`
> "Cloud Cost Intelligence" dashboard. Sub-header right-aligned with a time-range
> dropdown and an AWS/Azure/GCP provider toggle (small brand logos). Row of 6
> stat cards: Monthly Spend, Potential Savings, Efficiency Score (ring), Idle
> Resources, Tracked Items, Optimization Opportunities. Second row (3 cards):
> Cost Breakdown (stacked bars), AI Cost Insights, Cost Anomaly Detection. Third
> row (3 cards): a Kubernetes Cost Heatmap grid, Resource Efficiency Center, a
> Cost Forecasting Engine line chart. Fourth row (3 cards): Optimization
> Recommendations, Cost vs Reliability Analysis, Executive Summary. FinOps dark
> UI, green for savings.

### 10. Deployments `/deployments`
> "Deployment Intelligence" dashboard. Row of 6 stat cards: Active Deployments,
> Healthy, Degraded, Rollouts In Progress, AI Risk Score (ring), Incident
> Exposure Score (ring). Middle row (3 cards): a Deployment Health Matrix (grid
> of colored cells), a 320px AI Deployment Insights panel, a Dependency Impact
> Map (mini graph). Bottom row (3 cards): a live Rollout Timeline, Version
> Intelligence (version stat grid), Live Activity Feed. Dark enterprise UI.

### 11. Incidents `/incidents`
> "Incidents" list page. Row of 4 stat cards: Active, Critical, High, Resolved.
> Below, a list of clickable incident cards, each with a severity pill (critical
> red / high amber) and status pill, an incident title, a namespace/service line,
> and a gray italic root-cause preview quote. Show an "All Clear" empty state
> variant option. Clean dark incident-management UI.

### 11b. Incident Detail `/incidents/[id]`
> Incident detail page. Back link, incident title, a meta line (ID, namespace,
> service, time in mono) and severity + status pills. Three-column grid: left
> (2-wide) an "Evidence" card showing monospace log lines and a "Blast Radius"
> card with chip tags of affected resources; right column a "Root Cause" card
> with explanation text and a confidence progress bar, plus a "Live Source" card.
> Dark, focused, investigative UI.

### 12. Integrations `/integrations`
> "Integrations Command Center". Header with a Zap icon and Refresh. A stats bar
> ("6 connected · 12 available") and a search field. Two sections — "Connected"
> and "Available" — each a responsive grid of integration cards. Each card shows
> a real brand icon (Slack, PagerDuty, Jira, Microsoft Teams, Email, Opsgenie,
> Twilio, GitHub, GitLab, Webhook, Kafka), the name, a setup-type label, a
> Connected/Not-configured pill, a short description, a health dot with last-sync
> time, and Configure/Test/Set Up buttons. Include a configuration modal variant
> with dynamic fields and a show/hide secret eye icon. Dark enterprise UI.

### 13. Knowledge Base `/knowledge`
> "Knowledge Base" of incident patterns. Header with an "Auto-Ingest from
> Incidents" button. Row of 4 stat cards: Total Patterns, Categories, Services
> Covered, Top Service. A row of category filter pills. A search bar with a
> "Recommend Fix" button and an AI recommendation block (action→target, risk
> pill, confidence, reasoning). Below, a list of knowledge entries each with a
> book icon, title + "% match", severity/category/service pills, occurrence
> count, fix-rate %, root cause, fix action, and tag chips. Dark, library-like.

### 14. Alerts & Logs `/logs`
> "Alerts & Log Investigation" page. Header with a bell icon and a Live/Paused
> toggle. Row of 4 KPI cards: Critical, Warning, Acknowledged, Log Entries. Two-
> column layout: left = an "Active Alerts" section with severity filter tabs and
> alert rows (colored severity left-bar, title, Acknowledge button) followed by a
> "Log Stream" with a search box, level tabs (all/error/warning/info) and
> monospace log rows (timestamp | level | namespace/pod | message); right = an
> "AI Investigation" panel showing Likely Root Cause and a green Suggested Fix
> box with Acknowledge/Silence buttons. Dark observability UI.

### 15. Metrics `/metrics`
> "Metrics" page. Two large gauge cards — Cluster CPU % and Cluster Memory % —
> each with a big monospace percentage and a progress bar. An "Active Alerts"
> card listing rows with a severity dot, name, and message. Minimal, clean, dark.

### 16. AI Models `/models`
> "AI Model Management" page — local-first with optional cloud (BYOK). Header
> with the Ollama logo and Refresh. An "Active Models" banner showing the current
> chat model and embedding model, model count, and disk usage. Three tabs:
> Installed / Model Catalog / Cloud API Keys.
> - **Installed tab:** a "Pull a custom model" input with a progress bar and a
>   list of installed models (icon, model id in mono, ACTIVE badge,
>   size/params/quant, Activate/Delete buttons).
> - **Model Catalog tab:** collapsible category accordions (Small, Medium, Large,
>   Embedding) with model rows showing DEFAULT/ACTIVE/INSTALLED badges,
>   description, size, and Install/Activate buttons with pull progress.
> - **Cloud API Keys tab:** an amber "Optional — Cloud API Keys" notice
>   explaining local works offline and keys are stored as Kubernetes Secrets.
>   Below it, a list of provider cards (OpenAI, Anthropic, Google Gemini, Groq,
>   Together) each with a cloud icon, provider name, a CONNECTED / NOT CONFIGURED
>   status pill, the provider's model list in mono, a masked API-key input with a
>   key icon and show/hide eye, a violet "Save & Connect" button, and a red
>   "Remove" button for connected providers.
> Local is the default; cloud activates only when a key is added. Dark enterprise UI.

### 17. Night Guardian `/night-guardian`
> "Night Guardian" autonomous-overnight-remediation page. Row of 4 stat cards:
> Status (ENABLED/DISABLED pill), Mode, Confidence %, Reports count. A "Guardian
> Reports" card listing report rows (title, success status, namespace/target ·
> action · confidence). A shield empty state variant. Calm dark UI with a
> nighttime feel, subtle deep-blue glow.

### 18. Nodes `/nodes`
> "Infrastructure Compute Layer" node overview. Row of 4 cards: Total Nodes (+
> Ready count), Active Workloads (+ pods), Total Pods (+ running/failed), and an
> "Infrastructure Insight" AI text card. A grid: a 480px "Cluster Topology" SVG
> visualization with a green Live pill + an "AI Recommendations" panel with a
> star icon and a list of recommendations. Below, a "Kubernetes Nodes" table with
> columns: Node, Role & Info, CPU, Memory, Disk I/O, Pods, Health & AI Analysis
> (with inline mini bars). A bottom infrastructure status bar. Dark enterprise UI.

### 18b. Node Detail `/nodes/[name]`
> Kubernetes node detail page. Back link, node header (server icon, node name in
> mono, role · instance type · availability zone · uptime, Ready status pill).
> Row of 4 KPI cards: CPU %, Memory %, Pods, Health Score (each with a ring or
> bar). A tab bar: Details, Metrics, Pods, Cloud/Instance, Networking, Storage,
> Tags, Events. Show the Metrics tab active: a time-range selector and a grid of
> Recharts area charts (CPU %, Memory %, Network In/Out, Packets, Disk Read/Write
> IOPS). Dense cloud-console dark UI, AWS-EC2-like.

### 19. Workloads / Pods `/pods`
> "Workload Intelligence" page. A stat row, then a large "Workload Explorer"
> table with columns: Pod, Namespace, Status, CPU, Memory, Restarts (15m), Health
> Score, Risk Level, AI Analysis — with inline mini sparklines for CPU/Memory and
> mini bar charts for restarts, plus column toggles and search/filter controls.
> A "Workload Topology" SVG panel with a Live pill, and an "AI Insights — Powered
> by Tagent AI" sidebar with an AI recommendations badge. Data-dense dark UI.

### 20. Remediation `/remediation`
> "Remediation History" page. Header with an action count. A list of remediation
> rows, each with a status dot (success green / failed red / blocked amber), an
> "action → target" line, a message, a status label (with optional DRY-RUN tag)
> and a mono timestamp. A shield empty-state variant. Clean dark UI.

### 21. Reports `/reports`
> "AI Incident Knowledge Center" reports page. Header with a "Generate Reports
> for All Incidents" button and quick-generate chips for incidents without
> reports. A report detail view (title, IDs, a "Download PDF" button, and a
> rendered markdown content viewer). A reports list with a FileText icon, title +
> severity pill, ID/incident/duration/generated-at meta, and View + PDF buttons.
> Document-centric dark UI.

### 22. Risks `/risks`
> "Infrastructure Risk Intelligence" page. Row of 5 stat cards: Overall Risk
> Score /100, Services at Risk, Prevented Incidents, AI Confidence %, Trend
> arrow. An "AI Predictions — What Will Fail Next" list (service, namespace, time
> horizon, predicted issue, probability %). Two-column: a "Service Risk Scores"
> list (score, service, level pill, prediction, risk bar, Analyze button) and a
> sidebar with "Risk Categories" bars and "Top Risks". An "AI Analysis" result
> panel with a summary, 4 metric tiles, and recommended actions. Predictive dark
> UI, amber/red risk accents.

### 23. Settings — Escalation `/settings`
> "Escalation Chain" settings page. Tabs: Configuration / Active / History.
> Configuration tab active: an Enable toggle; a horizontal "Escalation Sequence"
> visual of step chips (Slack → Email → Phone Primary → Phone Secondary →
> Auto-Fix) each with a T+ timing label and connecting arrows; Primary and
> Secondary contact field sections; a "Timing & Rules" section (delays, quiet
> hours, minimum severity select); a Save button. Clean dark settings UI.

### 24. Setup `/setup` (standalone, no shell)
> First-time admin setup screen, standalone centered card on a dark radial-glow
> background. Tagent logo at top. A 2-step progress indicator. Step 1: "Welcome"
> heading and fields Full Name, Email, Phone, Company. Step 2 variant: Role
> select and Cluster Name with a violet "Complete Setup & Enter Dashboard"
> button. A small privacy note in the footer. Premium onboarding dark UI.

### 25. Service Graph `/topology`
> "Kubernetes Service Graph" full-page topology visualization, dark. Header with
> a green Live pill and counts (Nodes/Pods/Services/Deployments). A large SVG
> graph with three layers: node boxes at the top (with pod counts), hexagonal
> service/deployment nodes in the middle colored by health (green/amber/red), and
> namespace chips at the bottom; animated dashed orbital ellipses with moving
> dots connecting them. A legend (Healthy/Degraded/Critical) and a bottom-right
> stats overlay (Pods running/total, Services, Failing). Futuristic but clean.

### 26. User Management `/admin/users`
> "User Management" admin page. An admin-info card. Header with a "Create User"
> button. A create-user form (Name, Email, Phone, Role select
> Viewer/Operator/Manager, permission checkboxes). A "Team Members" list/table
> with avatar, name, email · role, a unique access-link code, and Copy Link +
> Delete buttons. Clean dark admin UI.

### 27. User Access `/access/[token]` (standalone, no shell)
> Access-link verification screen, standalone centered card on a dark radial-glow
> background. Tagent logo. Show the "Access Verified" success state: a green
> check, a welcome card with the user's name, company, and role, and a subtle
> redirect hint. Also describe alternate states: a "Verifying…" spinner and an
> "Invalid Access Link" error. Minimal premium dark UI.

---
