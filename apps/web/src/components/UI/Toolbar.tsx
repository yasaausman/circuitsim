import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileImage,
  FolderOpen,
  MousePointer,
  Pencil,
  Redo2,
  RotateCcw,
  Save,
  ScanSearch,
  Share2,
  Trash2,
  Undo2,
} from "lucide-react";
import { EXAMPLE_CIRCUITS } from "../../lib/examples";
import {
  decodeCircuitFromUrl,
  downloadText,
  encodeCircuitToUrl,
  exportCircuitImage,
  exportCircuitSvg,
  exportNetlist,
} from "../../lib/circuit-tools";
import { useCircuitStore } from "../../store/circuit";
import { useViewStore } from "../../store/view";

export function Toolbar() {
  const {
    tool,
    setTool,
    clearCircuit,
    circuit,
    loadCircuit,
    setCircuitName,
    undo,
    redo,
    past,
    future,
  } = useCircuitStore();
  const requestFitView = useViewStore((state) => state.requestFitView);
  const [nameDraft, setNameDraft] = useState(circuit.name);
  const [status, setStatus] = useState<string | null>(null);
  const exampleRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setNameDraft(circuit.name);
  }, [circuit.name]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMeta = event.ctrlKey || event.metaKey;
      if (isMeta && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (isMeta && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  function saveCircuit() {
    downloadText(`${circuit.name || "circuit"}.json`, JSON.stringify(circuit, null, 2), "application/json");
    setStatus("Saved JSON export");
  }

  function loadCircuitFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        loadCircuit(JSON.parse(text));
        setStatus("Loaded circuit file");
      } catch {
        alert("Invalid circuit file.");
      }
    };
    input.click();
  }

  async function copyShareUrl() {
    const encoded = encodeCircuitToUrl(circuit);
    const url = `${window.location.origin}${window.location.pathname}?c=${encoded}`;
    await navigator.clipboard.writeText(url);
    setStatus("Share URL copied");
  }

  const tools = [
    { id: "select", icon: MousePointer, label: "Select" },
    { id: "wire", icon: Pencil, label: "Wire" },
    { id: "delete", icon: Trash2, label: "Delete" },
  ] as const;

  return (
    <div className="flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
      <div className="mr-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-xs font-bold text-emerald-700 shadow-sm">
          CS
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">CircuitSim</p>
          <p className="text-[11px] text-slate-500">Brighter local circuit sandbox</p>
        </div>
      </div>

      <input
        value={nameDraft}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={() => setCircuitName(nameDraft)}
        onKeyDown={(event) => event.key === "Enter" && setCircuitName(nameDraft)}
        className="w-44 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-400"
      />

      <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setTool({ type: id as "select" | "wire" | "delete" })}
            className={`rounded-xl p-2 transition ${
              tool.type === id
                ? "bg-white text-emerald-600 shadow-sm"
                : "text-slate-500 hover:bg-white hover:text-slate-800"
            }`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          title="Undo"
          onClick={undo}
          disabled={past.length === 0}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
        >
          <Undo2 size={16} />
        </button>
        <button
          title="Redo"
          onClick={redo}
          disabled={future.length === 0}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40"
        >
          <Redo2 size={16} />
        </button>
        <button
          title="Zoom to fit"
          onClick={requestFitView}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <ScanSearch size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          title="Save JSON"
          onClick={saveCircuit}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Save size={16} />
        </button>
        <button
          title="Load JSON"
          onClick={loadCircuitFromFile}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <FolderOpen size={16} />
        </button>
        <button
          title="Copy share URL"
          onClick={copyShareUrl}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Share2 size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          title="Export image"
          onClick={() => {
            if (exportCircuitImage()) {
              setStatus("Exported PNG image");
            } else {
              alert("No canvas found to export.");
            }
          }}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <FileImage size={16} />
        </button>
        <button
          title="Export SVG"
          onClick={() => {
            downloadText(`${circuit.name || "circuit"}.svg`, exportCircuitSvg(circuit), "image/svg+xml");
            setStatus("Exported SVG");
          }}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Download size={16} />
        </button>
        <button
          title="Export SPICE netlist"
          onClick={() => {
            downloadText(`${circuit.name || "circuit"}.cir`, exportNetlist(circuit));
            setStatus("Exported SPICE netlist");
          }}
          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
        >
          <Download size={16} />
        </button>
      </div>

      <select
        ref={exampleRef}
        defaultValue=""
        onChange={(event) => {
          const example = EXAMPLE_CIRCUITS.find((item) => item.name === event.target.value);
          if (example) loadCircuit(example.circuit);
          event.currentTarget.value = "";
        }}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-emerald-400"
      >
        <option value="">Example circuits</option>
        {EXAMPLE_CIRCUITS.map((example) => (
          <option key={example.name} value={example.name}>
            {example.name}
          </option>
        ))}
      </select>

      <button
        title="Clear circuit"
        onClick={() => window.confirm("Clear all components?") && clearCircuit()}
        className="ml-auto rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
      >
        <RotateCcw size={16} />
      </button>

      <div className="w-36 text-right text-xs text-slate-500">
        {status ?? "Ready"}
      </div>
    </div>
  );
}
