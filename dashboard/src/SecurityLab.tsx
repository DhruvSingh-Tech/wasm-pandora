
import { useState } from "react";
import { ShieldCheck, ShieldAlert, Play, LoaderCircle } from "lucide-react";
import "./SecurityLab.css";

type PluginResponse = {
  success: boolean;
  duration_us: number;
  fuel_remaining: number;
  message: string;
  runtime_exit_code?: number;
  logs?: string;
};

type TestId = "infinite_loop" | "unauthorized" | "memory";
type TestStatus = "PASS" | "FAIL" | "ERROR";

type TestResult = {
  status: TestStatus;
  response?: PluginResponse;
  detail: string;
};

const tests: {
  id: TestId;
  title: string;
  description: string;
}[] = [
    {
      id: "infinite_loop",
      title: "Fuel Exhaustion Protection",
      description:
        "Checks whether an infinite-loop plugin is stopped by the execution fuel budget.",
    },
    {
      id: "unauthorized",
      title: "Capability Isolation",
      description:
        "Checks whether a plugin importing an ungranted host function is rejected.",
    },
    {
      id: "memory",
      title: "Memory Growth Protection",
      description:
        "Checks whether a plugin's attempt to exceed the 128 KiB memory limit is denied.",
    },
  ];

function evaluateResult(id: TestId, response: PluginResponse): TestResult {
  if (id === "infinite_loop") {
    const passed =
      response.success === false &&
      response.fuel_remaining === 0 &&
      /all fuel consumed by WebAssembly/i.test(response.message);

    return {
      status: passed ? "PASS" : "FAIL",
      response,
      detail: passed
        ? "Execution was terminated after exhausting its fuel budget."
        : "The response did not match the expected fuel-exhaustion behavior.",
    };
  }
  if (id === "memory") {
    const passed =
      response.success === true &&
      /PASS: memory growth beyond the 128 KiB limit was rejected/i.test(
        response.message,
      );

    return {
      status: passed ? "PASS" : "FAIL",
      response,
      detail: passed
        ? "The plugin's memory growth request was denied by the configured limit."
        : "The response did not confirm that memory growth was denied.",
    };
  }

  const passed =
    response.success === false &&
    /read_secret_file/i.test(response.message) &&
    /unknown import|has not been defined/i.test(response.message);

  return {
    status: passed ? "PASS" : "FAIL",
    response,
    detail: passed
      ? "The ungranted host function was rejected."
      : "The response did not confirm rejection of the unauthorized import.",
  };
}

export default function SecurityLab() {
  const [results, setResults] = useState<
    Partial<Record<TestId, TestResult>>
  >({});
  const [running, setRunning] = useState(false);
  const [activeTest, setActiveTest] = useState<TestId | null>(null);

  async function runTest(id: TestId) {
    setActiveTest(id);
    setResults((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });

    try {
      const res = await fetch("/api/plugins/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plugin: id }),
      });

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const response = (await res.json()) as PluginResponse;
      setResults((previous) => ({
        ...previous,
        [id]: evaluateResult(id, response),
      }));
    } catch (error) {
      setResults((previous) => ({
        ...previous,
        [id]: {
          status: "ERROR",
          detail:
            error instanceof Error ? error.message : "Unexpected API error",
        },
      }));
    } finally {
      setActiveTest(null);
    }
  }

  async function runAll() {
    if (running) return;
    setRunning(true);
    setResults({});

    try {
      for (const test of tests) {
        await runTest(test.id);
      }
    } finally {
      setRunning(false);
    }
  }

  const completed = tests.filter((test) => results[test.id]).length;
  const passed = tests.filter(
    (test) => results[test.id]?.status === "PASS",
  ).length;
  const allComplete = completed === tests.length;
  const allPassed = allComplete && passed === tests.length;
  const passRate =
    completed === 0 ? 0 : Math.round((passed / completed) * 100);
  return (
    <section className="security-lab">
      <div className="security-lab__header">
        <div>
          <p className="security-lab__eyebrow">RUNTIME VALIDATION</p>
          <h2>
            <ShieldCheck size={23} aria-hidden="true" />
            Security Lab
          </h2>
          <p className="security-lab__subtitle">
            Verify runtime protections with controlled adversarial plugins.
          </p>
        </div>

        <button
          className="security-lab__run"
          onClick={runAll}
          disabled={running || activeTest !== null}
        >
          {running ? (
            <LoaderCircle size={16} className="security-lab__spinner" />
          ) : (
            <Play size={16} />
          )}
          {running ? "Running tests…" : "Run all tests"}
        </button>
      </div>

      <div className="security-lab__summary" aria-live="polite">
        <div>
          <span className="security-lab__summary-label">Tests passed</span>
          <strong>
            {passed} / {tests.length}
          </strong>
        </div>
        <div>
          <span className="security-lab__summary-label">
            Checks passing
          </span>
          <strong>{passRate}%</strong>
        </div>
        <div>
          <span className="security-lab__summary-label">Test status</span>
          <strong>
            {allPassed
              ? "All passed"
              : allComplete
                ? "Issues detected"
                : completed === 0
                  ? "Not run"
                  : "In progress"}
          </strong>
        </div>
      </div>

      <div className="security-lab__tests">
        {tests.map((test) => {
          const result = results[test.id];
          const isActive = activeTest === test.id;

          return (
            <article className="security-lab__test" key={test.id}>
              <div className="security-lab__test-icon">
                {result?.status === "PASS" ? (
                  <ShieldCheck size={21} />
                ) : result?.status === "FAIL" ||
                  result?.status === "ERROR" ? (
                  <ShieldAlert size={21} />
                ) : isActive ? (
                  <LoaderCircle
                    size={21}
                    className="security-lab__spinner"
                  />
                ) : (
                  <ShieldCheck size={21} />
                )}
              </div>

              <div className="security-lab__test-content">
                <div className="security-lab__test-title">
                  <h3>{test.title}</h3>
                  <span
                    className={`security-lab__badge ${result
                      ? `security-lab__badge--${result.status.toLowerCase()}`
                      : "security-lab__badge--idle"
                      }`}
                  >
                    {result?.status ?? (isActive ? "RUNNING" : "NOT RUN")}
                  </span>
                </div>

                <p>{test.description}</p>

                {result && (
                  <div className="security-lab__result">
                    <strong>{result.detail}</strong>

                    {result.response && (
                      <div className="security-lab__metrics">
                        <span>
                          Duration:{" "}
                          {(result.response.duration_us / 1000).toFixed(2)} ms
                        </span>
                        <span>
                          Fuel remaining: {result.response.fuel_remaining}
                        </span>
                      </div>
                    )}

                    {result.response && (
                      <pre>{result.response.message}</pre>
                    )}
                  </div>
                )}

                {!result && !isActive && (
                  <button
                    className="security-lab__individual-run"
                    disabled={running}
                    onClick={() => runTest(test.id)}
                  >
                    Run this test
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="security-lab__note">
        These checks demonstrate fuel metering and import restrictions. They
        are proof-of-concept tests, not a complete security audit.
      </p>
    </section>
  );
}
