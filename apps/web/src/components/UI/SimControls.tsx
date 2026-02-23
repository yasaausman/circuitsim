import { useState } from "react";
import { Play, Square, Zap, RefreshCw } from "lucide-react";
import { useCircuitStore } from "../../store/circuit";
import { useSimStore } from "../../store/simulation";

export function SimControls() {
  const circuit = useCircuitStore((s) => s.circuit);
  const { status, result, error, run, reset, currentFrame, setFrame } = useSimStore();
  const [simType, setSimType] = useState<"dc" | "transient">("dc");
  const [stopTime, setStopTime] = useState("0.01");
  const [stepSize, setStepSize] = useState("0.0001");

  const isRunning = status === "running";
  const isDone = status === "done";

  function handleRun() {
    if (simType === "dc") {
      run(circuit, { type: "dc" });
    } else {
      run(circuit, {
        type: "transient",
        stopTime: parseFloat(stopTime) || 0.01,
        stepSize: parseFloat(stepSize) || 0.0001,
      });
    }
  }

  const frames = result?.converged && result.type === "transient" ? result.frames : null;

  return (
    <div className="p-3 flex flex-col gap-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Simulation</p>

      {/* Type selector */}
      <div className="flex gap-1">
        {(["dc", "transient"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSimType(t)}
            className={`flex-1 py-1 text-xs rounded border transition-all ${
              simType === t
                ? "bg-accent-blue/20 text-accent-blue border-accent-blue/40"
                : "text-gray-400 border-surface-border hover:border-gray-500"
            }`}
          >
            {t === "dc" ? "DC" : "Transient"}
          </button>
        ))}
      </div>

      {/* Transient options */}
      {simType === "transient" && (
        <div className="flex flex-col gap-1 text-xs">
          <label className="flex justify-between items-center">
            <span className="text-gray-400">Stop (s)</span>
            <input
              value={stopTime}
              onChange={(e) => setStopTime(e.target.value)}
              className="w-20 bg-surface-raised border border-surface-border rounded px-1 py-0.5 text-right text-gray-200 focus:outline-none focus:border-accent-blue"
            />
          </label>
          <label className="flex justify-between items-center">
            <span className="text-gray-400">Step (s)</span>
            <input
              value={stepSize}
              onChange={(e) => setStepSize(e.target.value)}
              className="w-20 bg-surface-raised border border-surface-border rounded px-1 py-0.5 text-right text-gray-200 focus:outline-none focus:border-accent-blue"
            />
          </label>
        </div>
      )}

      {/* Run / Reset */}
      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium bg-accent-green/20 text-accent-green border border-accent-green/30 hover:bg-accent-green/30 disabled:opacity-40 transition-all"
        >
          {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
          {isRunning ? "Running…" : "Run"}
        </button>
        <button
          onClick={reset}
          className="p-1.5 rounded text-gray-500 border border-surface-border hover:text-gray-300 hover:border-gray-500 transition-all"
        >
          <Square size={12} />
        </button>
      </div>

      {/* Error */}
      {status === "error" && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-900/40 rounded p-2">
          {error}
        </p>
      )}

      {/* Transient scrubber */}
      {isDone && frames && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>t = {frames[currentFrame]?.time.toExponential(2)}s</span>
            <span>{currentFrame + 1} / {frames.length}</span>
          </div>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentFrame}
            onChange={(e) => setFrame(Number(e.target.value))}
            className="w-full accent-accent-green"
          />
        </div>
      )}

      {/* DC done indicator */}
      {isDone && result?.converged && result.type === "dc" && (
        <div className="flex items-center gap-1.5 text-xs text-accent-green">
          <Zap size={10} />
          <span>DC analysis complete</span>
        </div>
      )}
    </div>
  );
}
