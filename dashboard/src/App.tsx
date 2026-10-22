
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Cpu,
  Gauge,
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import "./App.css";
import SecurityLab from "./SecurityLab";

type PluginId = "add" | "logger" | "infinite_loop" | "unauthorized";

type RunReport = {
  success: boolean;
  duration_us: number;
  fuel_remaining: number;
  message: string;
  runtime_exit_code?: number;
  logs?: string;
};

const plugins: {
  id: PluginId;
  name: string;
  description: string;
  category: string;
}[] = [
  {
    id: "add",
    name: "Addition",
    description: "Compute the sum of two integers",
    category: "COMPUTATION",
  },
  {
    id: "logger",
    name: "Host Logger",
    description: "Call the permitted Pandora host capability",
    category: "CAPABILITIES",
  },
  {
    id: "infinite_loop",
    name: "Infinite Loop",
    description: "Verify fuel exhaustion containment",
    category: "SECURITY TEST",
  },
  {
    id: "unauthorized",
    name: "Unauthorized Capability",
    description: "Attempt to import a host function that is not granted",
    category: "SECURITY TEST",
  },
];

const FUEL_BUDGET = 10_000;

function App() {
  const [plugin, setPlugin] = useState<PluginId>("add");
  const [a, setA] = useState("10");
  const [b, setB] = useState("20");
  const [report, setReport] = useState<RunReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<"checking" | "online" | "offline">(
    "checking",
  );
  const [runs, setRuns] = useState(0);
  const [lastPlugin, setLastPlugin] = useState<string>("None");

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await fetch("/health");
        if (!response.ok) throw new Error("API unavailable");
        if (active) setHealth("online");
      } catch {
        if (active) setHealth("offline");
      }
    };

    void checkHealth();
    const interval = window.setInterval(checkHealth, 10_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function executePlugin() {
    setRunning(true);
    setError("");
    setReport(null);

    try {
      const body: {
        plugin: PluginId;
        input?: { a: number; b: number };
      } = { plugin };

      if (plugin === "add") {
        const first = Number(a);
        const second = Number(b);

        if (
          !a.trim() ||
          !b.trim() ||
          !Number.isInteger(first) ||
          !Number.isInteger(second) ||
          first < -2_147_483_648 ||
          first > 2_147_483_647 ||
          second < -2_147_483_648 ||
          second > 2_147_483_647
        ) {
          throw new Error("Enter valid 32-bit integers for both inputs.");
        }

        body.input = { a: first, b: second };
      }

      const response = await fetch("/api/plugins/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Plugin request failed.");
      }

      setReport(data as RunReport);
      setRuns((previous) => previous + 1);
      setLastPlugin(plugins.find((item) => item.id === plugin)?.name ?? plugin);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unexpected execution error.",
      );
    } finally {
      setRunning(false);
    }
  }

  const fuelUsed = report
    ? Math.max(0, FUEL_BUDGET - report.fuel_remaining)
    : 0;
  const fuelPercent = Math.min(100, (fuelUsed / FUEL_BUDGET) * 100);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Pandora Runtime home">
          <span className="brand-mark">
            <Cpu size={23} strokeWidth={1.8} />
          </span>
          <span>
            <strong>PANDORA</strong>
            <small>RUNTIME</small>
          </span>
        </a>

        <div className="side-label">WORKSPACE</div>
        <div className="nav-item active">
          <Activity size={17} />
          Runtime overview
        </div>
        <div className="nav-item">
          <ShieldCheck size={17} />
          Security lab
          <span className="nav-tag">3</span>
        </div>
        <div className="nav-item">
          <Terminal size={17} />
          Execution logs
        </div>

        <div className="sidebar-bottom">
          <div className="runtime-card">
            <div className="runtime-card-heading">
              <span className={`status-dot ${health}`} />
              Runtime status
            </div>
            <strong>
              {health === "online"
                ? "Operational"
                : health === "offline"
                  ? "Disconnected"
                  : "Connecting..."}
            </strong>
            <small>Wasmtime · Rust</small>
            <div className="runtime-version">
              <span>FUEL METERING</span>
              <Check size={13} />
            </div>
          </div>
          <div className="sidebar-footer">FOSS FORGE · PROJECT BUILD</div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <span>/</span> <strong>Runtime overview</strong>
          </div>
          <div className="topbar-right">
            <span className="environment">
              <span className="status-dot online" />
              LOCAL ENVIRONMENT
            </span>
            <span className="avatar">P</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                WASM EXECUTION PLATFORM
              </div>
              <h1>Runtime overview</h1>
              <p>
                Execute sandboxed plugins. Observe resource consumption.
                Verify runtime isolation.
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                setReport(null);
                setError("");
              }}
            >
              <RotateCcw size={15} />
              Reset results
            </button>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-top">
                <span>Total executions</span>
                <Activity size={17} />
              </div>
              <div className="stat-value">{runs}</div>
              <div className="stat-caption">This dashboard session</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Fuel budget</span>
                <Gauge size={17} />
              </div>
              <div className="stat-value">10,000</div>
              <div className="stat-caption">Instructions fuel budget / run</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Memory ceiling</span>
                <Cpu size={17} />
              </div>
              <div className="stat-value">128 <small>KiB</small></div>
              <div className="stat-caption">Guest linear memory limit</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">
                <span>Last execution</span>
                <Clock3 size={17} />
              </div>
              <div className="stat-value time-value">
                {report ? `${(report.duration_us / 1000).toFixed(2)}` : "—"}
                <small>{report ? "ms" : "Awaiting run"}</small>
              </div>
              <div className="stat-caption">{lastPlugin}</div>
            </article>
          </div>

          <div className="workspace-grid">
            <section className="panel execution-panel">
              <div className="panel-heading">
                <div className="panel-title-group">
                  <span className="panel-icon">
                    <Play size={16} />
                  </span>
                  <div>
                    <h2>Plugin execution</h2>
                    <p>Configure and run a sandboxed module</p>
                  </div>
                </div>
                <span className="micro-badge">WASM</span>
              </div>

              <div className="form-body">
                <label className="field-label" htmlFor="plugin-select">
                  SELECT PLUGIN
                </label>
                <div className="select-wrap">
                  <select
                    id="plugin-select"
                    value={plugin}
                    onChange={(event) => {
                      setPlugin(event.target.value as PluginId);
                      setReport(null);
                      setError("");
                    }}
                  >
                    {plugins.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>

                <div className="plugin-description">
                  <div className="plugin-description-top">
                    <span>{plugins.find((item) => item.id === plugin)?.category}</span>
                    <span className="plugin-id">{plugin}</span>
                  </div>
                  <p>{plugins.find((item) => item.id === plugin)?.description}</p>
                </div>

                {plugin === "add" && (
                  <div className="inputs-row">
                    <div className="input-group">
                      <label className="field-label" htmlFor="input-a">
                        INPUT A
                      </label>
                      <input
                        id="input-a"
                        type="number"
                        value={a}
                        onChange={(event) => setA(event.target.value)}
                      />
                    </div>
                    <div className="operator">+</div>
                    <div className="input-group">
                      <label className="field-label" htmlFor="input-b">
                        INPUT B
                      </label>
                      <input
                        id="input-b"
                        type="number"
                        value={b}
                        onChange={(event) => setB(event.target.value)}
                      />
                    </div>
                  </div>
                )}

                {plugin === "infinite_loop" && (
                  <div className="notice warning-notice">
                    <ShieldCheck size={17} />
                    <span>
                      <strong>Security test</strong>
                      <small>
                        This plugin loops indefinitely. Fuel metering should
                        terminate execution.
                      </small>
                    </span>
                  </div>
                )}

                {plugin === "logger" && (
                  <div className="notice">
                    <ShieldCheck size={17} />
                    <span>
                      <strong>Capability test</strong>
                      <small>
                        Invokes the explicitly registered pandora:host log
                        function.
                      </small>
                    </span>
                  </div>
                )}

                <button
                  className="run-button"
                  onClick={() => void executePlugin()}
                  disabled={running || health !== "online"}
                >
                  {running ? (
                    <span className="spinner" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                  {running ? "Executing plugin..." : "Execute plugin"}
                  {!running && <ArrowUpRight size={16} />}
                </button>
                <p className="run-hint">
                  <span className="key-hint">WASM</span>
                  Runs through the local Rust + Wasmtime runtime
                </p>
              </div>
            </section>

            <section className="panel result-panel">
              <div className="panel-heading">
                <div className="panel-title-group">
                  <span className="panel-icon">
                    <Terminal size={17} />
                  </span>
                  <div>
                    <h2>Execution result</h2>
                    <p>Live runtime response</p>
                  </div>
                </div>
                {report && (
                  <span className={`result-status ${report.success ? "passed" : "failed"}`}>
                    <span className="status-dot" />
                    {report.success ? "SUCCESS" : "TRAPPED"}
                  </span>
                )}
              </div>

              <div className="console-toolbar">
                <span><span className="console-dot" /> OUTPUT CONSOLE</span>
                <span>JSON / RUNTIME</span>
              </div>

              <div className="console">
                {!report && !error && !running && (
                  <div className="empty-console">
                    <span className="empty-icon"><Terminal size={23} /></span>
                    <strong>Awaiting execution</strong>
                    <p>Choose a plugin and execute it to inspect the runtime response.</p>
                  </div>
                )}

                {running && (
                  <div className="running-console">
                    <span className="spinner" />
                    <span>Invoking Wasmtime runtime...</span>
                  </div>
                )}

                {error && (
                  <div className="error-block">
                    <strong>Request error</strong>
                    <p>{error}</p>
                  </div>
                )}

                {report && (
                  <div className="result-content">
                    <div className="result-line">
                      <span className="line-number">01</span>
                      <span className="json-key">"success"</span>
                      <span>:</span>
                      <span className={report.success ? "json-true" : "json-false"}>
                        {String(report.success)}
                      </span>
                      <span>,</span>
                    </div>
                    <div className="result-line">
                      <span className="line-number">02</span>
                      <span className="json-key">"duration_us"</span>
                      <span>:</span>
                      <span className="json-number">{report.duration_us}</span>
                      <span>,</span>
                    </div>
                    <div className="result-line">
                      <span className="line-number">03</span>
                      <span className="json-key">"fuel_remaining"</span>
                      <span>:</span>
                      <span className="json-number">{report.fuel_remaining}</span>
                      <span>,</span>
                    </div>
                    <div className="result-line message-line">
                      <span className="line-number">04</span>
                      <span className="json-key">"message"</span>
                      <span>:</span>
                      <span className="json-string">
                        {JSON.stringify(report.message)}
                      </span>
                    </div>
                    {report.logs && (
                      <div className="log-output">
                        <span className="log-label">HOST LOG</span>
                        <pre>{report.logs}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="result-footer">
                <span>
                  <span className={`status-dot ${report ? (report.success ? "online" : "failed-dot") : ""}`} />
                  {report
                    ? report.success
                      ? "Execution completed"
                      : "Execution trapped safely"
                    : "No execution data"}
                </span>
                <span>UTF-8</span>
              </div>
            </section>
          </div>

          <section className="panel metrics-panel">
            <div className="panel-heading">
              <div className="panel-title-group">
                <span className="panel-icon">
                  <Gauge size={17} />
                </span>
                <div>
                  <h2>Resource telemetry</h2>
                  <p>Metrics reported by the runtime for the last execution</p>
                </div>
              </div>
              <span className="micro-badge">PER EXECUTION</span>
            </div>

            <div className="telemetry-grid">
              <div className="telemetry-card">
                <div className="telemetry-label">
                  <Zap size={15} /> FUEL CONSUMED
                </div>
                <div className="telemetry-value">
                  {report ? fuelUsed.toLocaleString() : "—"}
                  <small> / {FUEL_BUDGET.toLocaleString()}</small>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill ${report && !report.success ? "danger-fill" : ""}`}
                    style={{ width: `${report ? fuelPercent : 0}%` }}
                  />
                </div>
                <div className="telemetry-caption">
                  {report ? `${fuelPercent.toFixed(2)}% of fuel budget consumed` : "Run a plugin to measure fuel"}
                </div>
              </div>

              <div className="telemetry-card">
                <div className="telemetry-label">
                  <Clock3 size={15} /> EXECUTION DURATION
                </div>
                <div className="telemetry-value">
                  {report ? report.duration_us.toLocaleString() : "—"}
                  <small> µs</small>
                </div>
                <div className="duration-track">
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                  <span className="duration-indicator" />
                </div>
                <div className="telemetry-caption">
                  {report ? `${(report.duration_us / 1000).toFixed(2)} ms wall-clock duration` : "Awaiting first measurement"}
                </div>
              </div>

              <div className="telemetry-card">
                <div className="telemetry-label">
                  <ShieldCheck size={15} /> EXECUTION STATUS
                </div>
                <div className={`telemetry-value status-value ${report ? (report.success ? "text-success" : "text-danger") : ""}`}>
                  {report ? (report.success ? "Passed" : "Trapped") : "—"}
                </div>
                <div className="telemetry-caption">
                  {report
                    ? report.success
                      ? "Plugin returned without a trap"
                      : "Plugin failed; runtime returned a report"
                    : "No result available"}
                </div>
              </div>
            </div>
          </section>
          <section>
            <SecurityLab />
          </section>

          <footer className="page-footer">
            <span>© 2026 PANDORA RUNTIME</span>
            <span><ShieldCheck size={14} /> WASMTIME-POWERED SANDBOX</span>
            <span>BUILT FOR FOSS FORGE</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default App;
