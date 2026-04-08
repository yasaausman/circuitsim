import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Pause, Play, RefreshCw, Square, Waves, Zap } from "lucide-react";
import { diagnoseCircuit } from "@circuitsim/engine";
import { useCircuitStore } from "../../store/circuit";
import { useSimStore } from "../../store/simulation";

function ScopePlot({
  samples,
  stroke,
}: {
  samples: Array<{ x: number; y: number }>;
  stroke: string;
}) {
  if (samples.length < 2) return <div className="text-xs text-slate-500">Run a transient simulation to plot a waveform.</div>;
  const values = samples.map((sample) => sample.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = samples
    .map((sample, index) => {
      const x = (index / Math.max(samples.length - 1, 1)) * 300;
      const y = 96 - ((sample.y - min) / range) * 84;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 300 100" className="h-28 w-full rounded-xl border border-slate-200 bg-white">
      <line x1="0" y1="50" x2="300" y2="50" stroke="#e2e8f0" strokeWidth="1" />
      <polyline fill="none" stroke={stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
      <text x="6" y="14" fill="#64748b" fontSize="10">
        {max.toFixed(2)} V
      </text>
      <text x="6" y="96" fill="#64748b" fontSize="10">
        {min.toFixed(2)} V
      </text>
    </svg>
  );
}

export function SimControls() {
  const circuit = useCircuitStore((state) => state.circuit);
  const selectedId = useCircuitStore((state) => state.selectedId);
  const {
    status,
    result,
    error,
    run,
    reset,
    currentFrame,
    setFrame,
    autoplay,
    setAutoplay,
  } = useSimStore();

  const [simType, setSimType] = useState<"dc" | "ac" | "transient">("dc");
  const [stopTime, setStopTime] = useState("0.01");
  const [stepSize, setStepSize] = useState("0.0001");
  const [frequency, setFrequency] = useState("1000");

  const liveWarnings = useMemo(() => diagnoseCircuit(circuit), [circuit]);
  const warnings = result?.warnings?.length ? result.warnings : liveWarnings;
  const frames = result?.converged && result.type === "transient" ? result.frames : [];

  useEffect(() => {
    if (!autoplay || frames.length <= 1) return;
    const timer = window.setInterval(() => {
      useSimStore.setState((state) => {
        if (!state.result?.converged || state.result.type !== "transient") return state;
        const nextFrame = state.currentFrame + 1;
        if (nextFrame >= state.result.frames.length) {
          return { ...state, currentFrame: state.result.frames.length - 1, autoplay: false };
        }
        return { ...state, currentFrame: nextFrame };
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [autoplay, frames.length]);

  function handleRun() {
    if (simType === "dc") {
      run(circuit, { type: "dc" });
      return;
    }
    if (simType === "ac") {
      run(circuit, { type: "ac", frequency: parseFloat(frequency) || 1000 });
      return;
    }
    run(circuit, {
      type: "transient",
      stopTime: parseFloat(stopTime) || 0.01,
      stepSize: parseFloat(stepSize) || 0.0001,
    });
  }

  const waveform = useMemo(() => {
    if (!result?.converged || result.type !== "transient" || frames.length === 0) return [];
    const selected = circuit.components.find((component) => component.id === selectedId) ?? circuit.components[0];
    if (!selected) return [];
    return frames.map((frame) => ({
      x: frame.time,
      y: frame.branchCurrents[selected.id] ?? 0,
    }));
  }, [result, frames, circuit.components, selectedId]);

  const guidedText = useMemo(() => {
    if (!result?.converged) return "Run a simulation to get guided feedback.";
    if (result.type === "dc") return "DC mode shows the steady-state operating point after the circuit settles.";
    if (result.type === "ac") return `AC mode solves the steady-state sinusoidal response at ${result.frequency.toFixed(0)} Hz. Capacitors and inductors now react to frequency.`;
    const frame = frames[currentFrame];
    if (!frame) return "Transient mode steps through time so you can watch energy move through the circuit.";
    const peakCurrent = Object.entries(frame.branchCurrents).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
    return peakCurrent
      ? `At ${frame.time.toExponential(2)}s, the strongest current is through ${peakCurrent[0]} at ${peakCurrent[1].toExponential(2)} A.`
      : "At this moment, current flow is minimal.";
  }, [result, frames, currentFrame]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Simulation</p>

      <div className="grid grid-cols-3 gap-2">
        {(["dc", "ac", "transient"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSimType(type)}
            className={`rounded-xl border px-2 py-2 text-xs font-medium transition ${
              simType === type
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      {simType === "ac" && (
        <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-sm">
          <span className="text-slate-500">Frequency (Hz)</span>
          <input
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
            className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-slate-700 outline-none focus:border-sky-400"
          />
        </label>
      )}

      {simType === "transient" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
          <label className="flex items-center justify-between">
            <span className="text-slate-500">Stop time</span>
            <input
              value={stopTime}
              onChange={(event) => setStopTime(event.target.value)}
              className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-slate-700 outline-none focus:border-sky-400"
            />
          </label>
          <label className="mt-2 flex items-center justify-between">
            <span className="text-slate-500">Step size</span>
            <input
              value={stepSize}
              onChange={(event) => setStepSize(event.target.value)}
              className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-right text-slate-700 outline-none focus:border-sky-400"
            />
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={status === "running"}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {status === "running" ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
          {status === "running" ? "Running" : "Run"}
        </button>
        <button
          onClick={reset}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Square size={14} />
        </button>
      </div>

      {(status === "error" || warnings.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-amber-800">
            <AlertTriangle size={12} />
            Warnings
          </p>
          {status === "error" && error && (
            <p className="mb-2 text-sm text-rose-700">{error}</p>
          )}
          <div className="flex flex-col gap-2">
            {warnings.slice(0, 5).map((warning) => (
              <div key={warning.id} className="rounded-xl bg-white/80 p-2 text-sm">
                <p className="font-medium text-slate-800">{warning.title}</p>
                <p className="text-slate-500">{warning.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result?.converged && result.type === "transient" && frames.length > 0 && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
            <span>t = {frames[currentFrame]?.time.toExponential(2)}s</span>
            <button
              onClick={() => setAutoplay(!autoplay)}
              className="flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 text-sky-700"
            >
              {autoplay ? <Pause size={12} /> : <Play size={12} />}
              {autoplay ? "Pause" : "Play"}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentFrame}
            onChange={(event) => setFrame(Number(event.target.value))}
            className="w-full accent-emerald-600"
          />
          <p className="mt-2 text-sm text-slate-600">{guidedText}</p>
        </div>
      )}

      {result?.converged && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
            <Waves size={12} />
            Oscilloscope
          </p>
          <ScopePlot samples={waveform} stroke="#0284c7" />
          <p className="mt-2 text-xs text-slate-500">
            Plotting branch current over time for the selected component. Select a component before running transient mode for a more useful trace.
          </p>
        </div>
      )}

      {result?.converged && result.type !== "transient" && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 text-sm text-emerald-700">
          {result.type === "ac" ? <Waves size={14} /> : <Zap size={14} />}
          <span>{guidedText}</span>
        </div>
      )}
    </div>
  );
}
