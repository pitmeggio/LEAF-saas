"use client";

/**
 * VideoCompare — analisi video stile "Coach's Eye" per LEAF.
 *
 * - Due clip (A/B) caricati SOLO in locale (URL.createObjectURL): niente upload.
 * - Scrub indipendente + avanzamento fotogramma per fotogramma.
 * - "Sincronizza": blocca lo sfasamento e muove i due video insieme.
 * - TELESTRAZIONE: linea / freccia / angolo (con gradi) / tratto libero, colori,
 *   undo e cancella per clip. Tutto impresso anche nell'export.
 * - Cronometro sempre visibile, impresso nel video esportato.
 * - Export: video + disegni su canvas → MediaRecorder → scarica un .webm.
 */

import { useEffect, useRef, useState } from "react";

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s * 100) % 100);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

const TOOLS = [
  { key: "none", label: "Punta" },
  { key: "line", label: "Linea" },
  { key: "arrow", label: "Freccia" },
  { key: "angle", label: "Angolo" },
  { key: "free", label: "Libero" },
];
const COLORS = ["#ff3b30", "#ffcc00", "#34c759", "#0a84ff", "#ffffff"];

function ToolIcon({ k }) {
  const c = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (k === "none") return (<svg {...c} fill="currentColor" stroke="none"><path d="M5 3l15 8-6.5 1.4L10 20z" /></svg>);
  if (k === "line") return (<svg {...c}><line x1="4" y1="20" x2="20" y2="4" /></svg>);
  if (k === "arrow") return (<svg {...c}><line x1="4" y1="20" x2="18" y2="6" /><path d="M18 6l-6 0M18 6l0 6" /></svg>);
  if (k === "angle") return (<svg {...c}><path d="M5 4v15h15" /><path d="M5 13a6 6 0 0 0 6 6" /></svg>);
  if (k === "free") return (<svg {...c}><path d="M4 17c2.5-5 4 3 6.5-1.5S14 11 16 13s2.5-1 4-5" /></svg>);
  return null;
}

function containRect(vw, vh, cw, ch) {
  if (!vw || !vh || !cw || !ch) return { x: 0, y: 0, w: cw, h: ch };
  const scale = Math.min(cw / vw, ch / vh);
  const w = vw * scale, h = vh * scale;
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

// Draw telestration shapes (points normalized 0..1 over the video content) onto
// any ctx, mapped into `rect`. Reused by the live overlay AND the export canvas.
function drawShapesOnCtx(ctx, shapes, rect, lw) {
  const map = (p) => ({ x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h });
  for (const sh of shapes) {
    if (!sh.pts || sh.pts.length === 0) continue;
    const P = sh.pts.map(map);
    ctx.strokeStyle = sh.color;
    ctx.fillStyle = sh.color;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (sh.tool === "angle") {
      const v = P[0];
      ctx.beginPath();
      if (P[1]) { ctx.moveTo(P[1].x, P[1].y); ctx.lineTo(v.x, v.y); }
      if (P[2]) { ctx.lineTo(P[2].x, P[2].y); }
      ctx.stroke();
      if (P[1] && P[2]) {
        const a1 = Math.atan2(P[1].y - v.y, P[1].x - v.x);
        const a2 = Math.atan2(P[2].y - v.y, P[2].x - v.x);
        let deg = Math.abs((a1 - a2) * 180 / Math.PI);
        if (deg > 180) deg = 360 - deg;
        const r = Math.max(16, lw * 6);
        ctx.beginPath();
        ctx.arc(v.x, v.y, r, Math.min(a1, a2), Math.max(a1, a2));
        ctx.stroke();
        ctx.font = `700 ${Math.max(13, lw * 5)}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.round(deg)}°`, v.x + r + 4, v.y);
      }
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(P[0].x, P[0].y);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i].x, P[i].y);
    ctx.stroke();
    if (sh.tool === "arrow" && P.length >= 2) {
      const a = P[P.length - 2], b = P[P.length - 1];
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const len = Math.max(10, lw * 3.5);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - len * Math.cos(ang - 0.45), b.y - len * Math.sin(ang - 0.45));
      ctx.lineTo(b.x - len * Math.cos(ang + 0.45), b.y - len * Math.sin(ang + 0.45));
      ctx.closePath();
      ctx.fill();
    }
  }
}

export default function VideoCompare() {
  const vA = useRef(null);
  const vB = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const recorderRef = useRef(null);

  const [srcA, setSrcA] = useState(null);
  const [srcB, setSrcB] = useState(null);
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");

  const [layout, setLayout] = useState("side");
  const [linked, setLinked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [fps, setFps] = useState(30);
  const [includeAudio, setIncludeAudio] = useState(true);

  const [tool, setTool] = useState("none");
  const [color, setColor] = useState(COLORS[0]);
  const [shapesA, setShapesA] = useState([]);
  const [shapesB, setShapesB] = useState([]);

  const offsetRef = useRef(0);

  const [timeA, setTimeA] = useState(0);
  const [timeB, setTimeB] = useState(0);
  const [durA, setDurA] = useState(0);
  const [durB, setDurB] = useState(0);

  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [error, setError] = useState("");

  const loadFile = (e, which) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (which === "A") {
      if (srcA) URL.revokeObjectURL(srcA);
      setSrcA(url); setNameA(file.name); setShapesA([]);
    } else {
      if (srcB) URL.revokeObjectURL(srcB);
      setSrcB(url); setNameB(file.name); setShapesB([]);
    }
    setLinked(false);
  };

  useEffect(() => {
    return () => {
      if (srcA) URL.revokeObjectURL(srcA);
      if (srcB) URL.revokeObjectURL(srcB);
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => {
      const a = vA.current, b = vB.current;
      if (a) setTimeA(a.currentTime);
      if (b) setTimeB(b.currentTime);
      if (linked && a && b && !a.paused) {
        const target = a.currentTime + offsetRef.current;
        if (target >= 0 && target <= (b.duration || Infinity)) {
          if (Math.abs(b.currentTime - target) > 0.05) b.currentTime = target;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [linked]);

  useEffect(() => {
    if (vA.current) vA.current.playbackRate = rate;
    if (vB.current) vB.current.playbackRate = rate;
  }, [rate, srcA, srcB]);

  const togglePlay = async () => {
    const a = vA.current, b = vB.current;
    if (!a && !b) return;
    const shouldPlay = a ? a.paused : b?.paused;
    try {
      if (shouldPlay) {
        if (a) await a.play();
        if (linked && b) await b.play();
        setPlaying(true);
      } else { a?.pause(); b?.pause(); setPlaying(false); }
    } catch (_) {}
  };

  const pauseAll = () => { vA.current?.pause(); vB.current?.pause(); setPlaying(false); };

  const stepFrame = (dir, which) => {
    pauseAll();
    const dt = (1 / fps) * dir;
    const move = (el, max) => { if (!el) return; el.currentTime = Math.min(Math.max(0, el.currentTime + dt), max || el.duration || 0); };
    if (linked) { move(vA.current, durA); move(vB.current, durB); }
    else if (which === "A") move(vA.current, durA);
    else move(vB.current, durB);
  };

  const scrub = (val, which) => {
    pauseAll();
    if (linked) {
      const a = vA.current, b = vB.current;
      if (a) a.currentTime = val;
      if (b) b.currentTime = Math.min(Math.max(0, val + offsetRef.current), b.duration || 0);
    } else if (which === "A" && vA.current) vA.current.currentTime = val;
    else if (which === "B" && vB.current) vB.current.currentTime = val;
  };

  const toggleLink = () => {
    const a = vA.current, b = vB.current;
    if (!linked) {
      if (!a || !b) { setError("Carica entrambi i video prima di sincronizzare."); return; }
      offsetRef.current = b.currentTime - a.currentTime;
      setError("");
    }
    pauseAll();
    setLinked((v) => !v);
  };

  const exportVideo = async () => {
    const a = vA.current, b = vB.current, canvas = canvasRef.current;
    if (!a || !b || !canvas) { setError("Servono entrambi i video per esportare."); return; }
    setError(""); setExporting(true); setExportPct(0); pauseAll();

    const offset = linked ? offsetRef.current : b.currentTime - a.currentTime;
    const startA = Math.max(0, -offset);
    const startB = startA + offset;
    const windowDur = Math.min(a.duration - startA, b.duration - startB);
    if (!isFinite(windowDur) || windowDur <= 0) {
      setExporting(false);
      setError("I due video non si sovrappongono con questo allineamento.");
      return;
    }

    const wA = a.videoWidth || 640, hA = a.videoHeight || 360;
    const wB = b.videoWidth || 640, hB = b.videoHeight || 360;
    const gap = 8;
    let W, H, posA, posB;
    if (layout === "side") {
      const h = Math.max(hA, hB);
      W = wA + wB + gap; H = h;
      posA = { x: 0, y: (h - hA) / 2, w: wA, h: hA };
      posB = { x: wA + gap, y: (h - hB) / 2, w: wB, h: hB };
    } else {
      const w = Math.max(wA, wB);
      W = w; H = hA + hB + gap;
      posA = { x: (w - wA) / 2, y: 0, w: wA, h: hA };
      posB = { x: (w - wB) / 2, y: hA + gap, w: wB, h: hB };
    }
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    a.playbackRate = 1; b.playbackRate = 1;
    a.currentTime = startA; b.currentTime = startB;
    await Promise.all([once(a, "seeked"), once(b, "seeked")]);

    const stream = canvas.captureStream(fps);
    let audioCtx = null;
    if (includeAudio) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        for (const el of [a, b]) {
          const cap = el.captureStream ? el.captureStream() : el.mozCaptureStream?.();
          if (cap && cap.getAudioTracks().length) {
            audioCtx.createMediaStreamSource(cap).connect(dest);
          }
        }
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (_) {}
    }

    const mime = pickMime();
    let recorder;
    try { recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
    catch (err) { setExporting(false); setError("Il browser non supporta la registrazione video (MediaRecorder)."); return; }
    recorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const finalize = () => new Promise((res) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime || "video/webm" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `comparazione-${Date.now()}.webm`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        audioCtx?.close(); res();
      };
    });

    const lw = Math.max(2.5, W / 360);
    const endA = startA + windowDur;
    const draw = () => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      try {
        ctx.drawImage(a, posA.x, posA.y, posA.w, posA.h);
        ctx.drawImage(b, posB.x, posB.y, posB.w, posB.h);
        drawShapesOnCtx(ctx, shapesA, posA, lw);
        drawShapesOnCtx(ctx, shapesB, posB, lw);
      } catch (_) {}
      drawTimecode(ctx, a.currentTime - startA, W);
      const done = a.currentTime >= endA - 0.001 || a.ended;
      setExportPct(Math.min(100, Math.round(((a.currentTime - startA) / windowDur) * 100)));
      if (done) { a.pause(); b.pause(); recorder.stop(); }
      else rafRef.current = requestAnimationFrame(draw);
    };

    recorder.start();
    cancelAnimationFrame(rafRef.current);
    await Promise.all([a.play(), b.play()]);
    rafRef.current = requestAnimationFrame(draw);
    await finalize();

    cancelAnimationFrame(rafRef.current);
    a.playbackRate = rate; b.playbackRate = rate;
    setExporting(false); setExportPct(100);
    rafRef.current = requestAnimationFrame(function tick() {
      if (vA.current) setTimeA(vA.current.currentTime);
      if (vB.current) setTimeB(vB.current.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    });
  };

  return (
    <div className="vc">
      <header className="vc-head">
        <div className="vc-title"><span className="dot" /> Analisi video</div>
        <div className="vc-clock">{fmt(timeA)}</div>
      </header>

      {error && <div className="vc-error">{error}</div>}

      <div className="vc-uploads">
        <Uploader label="Clip A" accent="a" name={nameA} onChange={(e) => loadFile(e, "A")} />
        <Uploader label="Clip B" accent="b" name={nameB} onChange={(e) => loadFile(e, "B")} />
      </div>

      {/* Telestration toolbar */}
      <div className="vc-tools">
        <div className="toolset">
          {TOOLS.map((t) => (
            <button key={t.key} className={`tool ${tool === t.key ? "on" : ""}`} onClick={() => setTool(t.key)} title={t.label}>
              <ToolIcon k={t.key} /><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} className={`sw ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={`Colore ${c}`} />
          ))}
        </div>
        <span className="hint">{tool === "none" ? "Scegli uno strumento e disegna sul video" : tool === "angle" ? "Tocca 3 punti: vertice, poi le due estremità" : "Trascina sul video per disegnare"}</span>
      </div>

      <div className={`vc-stage ${layout}`}>
        <ClipPane accent="a" src={srcA} videoRef={vA} time={timeA} dur={durA} disabled={linked}
          tool={tool} color={color} shapes={shapesA} onShapes={setShapesA}
          onLoaded={(d) => setDurA(d)} onStep={(dir) => stepFrame(dir, "A")} onScrub={(v) => scrub(v, "A")} />
        <ClipPane accent="b" src={srcB} videoRef={vB} time={timeB} dur={durB} disabled={linked}
          tool={tool} color={color} shapes={shapesB} onShapes={setShapesB}
          onLoaded={(d) => setDurB(d)} onStep={(dir) => stepFrame(dir, "B")} onScrub={(v) => scrub(v, "B")} />
      </div>

      <div className="vc-controls">
        <button className={`btn link ${linked ? "on" : ""}`} onClick={toggleLink} title="Blocca l'allineamento e muovi i due video insieme">
          {linked ? "● Sincronizzati" : "Sincronizza"}
        </button>
        <button className="btn frame" onClick={() => stepFrame(-1, "A")} title="Fotogramma indietro">⏮</button>
        <button className="btn play" onClick={togglePlay}>{playing ? "Pausa" : "Play"}</button>
        <button className="btn frame" onClick={() => stepFrame(1, "A")} title="Fotogramma avanti">⏭</button>

        <div className="vc-rate">
          <label>Velocità</label>
          <select value={rate} onChange={(e) => setRate(parseFloat(e.target.value))}>
            <option value={0.1}>0.1×</option><option value={0.25}>0.25×</option><option value={0.5}>0.5×</option>
            <option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option>
          </select>
        </div>
        <div className="vc-rate">
          <label>fps step</label>
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))}>
            <option value={24}>24</option><option value={25}>25</option><option value={30}>30</option><option value={60}>60</option>
          </select>
        </div>
      </div>

      <div className="vc-export">
        <div className="vc-export-opts">
          <label className="chk"><input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />Includi audio</label>
          <div className="seg">
            <button className={layout === "side" ? "on" : ""} onClick={() => setLayout("side")}>Affiancati</button>
            <button className={layout === "stacked" ? "on" : ""} onClick={() => setLayout("stacked")}>Impilati</button>
          </div>
        </div>
        <button className="btn export" onClick={exportVideo} disabled={exporting || !srcA || !srcB}>
          {exporting ? `Esporto… ${exportPct}%` : "Esporta e scarica"}
        </button>
      </div>

      {exporting && <div className="vc-progress"><div className="bar" style={{ width: `${exportPct}%` }} /></div>}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style jsx>{`
        .vc {
          --bg: #0c0e13; --panel: #141720; --panel2: #1b1f29; --line: #272b36; --text: #eef0f5;
          --muted: #8b91a0; --a: #ff9f1c; --b: #22d3ee;
          background: linear-gradient(180deg, #10131a 0%, #0c0e13 100%); color: var(--text);
          border: 1px solid var(--line); border-radius: 18px; padding: 18px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 1100px; margin: 0 auto;
        }
        .vc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .vc-title { display: flex; align-items: center; gap: 9px; font-weight: 600; font-size: 15px; letter-spacing: .2px; }
        .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--a); box-shadow: 0 0 14px var(--a); }
        .vc-clock { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 26px;
          font-variant-numeric: tabular-nums; color: var(--a); letter-spacing: 1px;
          background: rgba(255,159,28,.10); border: 1px solid rgba(255,159,28,.25); padding: 4px 14px; border-radius: 10px; }
        .vc-error { background: #3a1418; border: 1px solid #6b2026; color: #ffb4b4; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .vc-uploads { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .vc-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 10px 12px;
          background: var(--panel); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 12px; }
        .toolset { display: inline-flex; gap: 4px; background: var(--panel2); padding: 4px; border-radius: 10px; }
        .tool { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: var(--muted);
          border: none; border-radius: 8px; padding: 7px 11px; cursor: pointer; font-size: 13px; transition: all .15s; }
        .tool:hover { color: var(--text); }
        .tool.on { background: var(--a); color: #1a1206; font-weight: 600; }
        .swatches { display: inline-flex; gap: 7px; }
        .sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid rgba(255,255,255,.15); cursor: pointer; padding: 0; transition: transform .12s; }
        .sw:hover { transform: scale(1.12); }
        .sw.on { border-color: #fff; box-shadow: 0 0 0 2px var(--panel), 0 0 0 3px #fff; }
        .hint { font-size: 12px; color: var(--muted); margin-left: auto; }
        .vc-stage { display: grid; gap: 10px; margin-bottom: 12px; }
        .vc-stage.side { grid-template-columns: 1fr 1fr; }
        .vc-stage.stacked { grid-template-columns: 1fr; }
        .vc-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px;
          background: var(--panel); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 12px; }
        .btn { background: var(--panel2); color: var(--text); border: 1px solid var(--line); border-radius: 9px;
          padding: 8px 14px; cursor: pointer; font-size: 14px; transition: background .15s, border-color .15s; }
        .btn:hover { background: #232733; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn.play { background: var(--a); color: #1a1206; border-color: var(--a); font-weight: 600; min-width: 88px; }
        .btn.link.on { background: #103b2e; border-color: #1f7a5c; color: #6ee7b7; }
        .btn.export { background: var(--b); color: #042b33; border-color: var(--b); font-weight: 600; }
        .vc-rate { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .vc-rate + .vc-rate { margin-left: 0; }
        .vc-rate label { color: var(--muted); font-size: 12px; }
        select { background: var(--panel2); color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 6px 8px; font-size: 13px; }
        .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
        .seg button { background: var(--panel2); color: var(--muted); border: none; padding: 7px 13px; cursor: pointer; font-size: 13px; }
        .seg button.on { background: #2b3040; color: var(--text); }
        .vc-export { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .vc-export-opts { display: flex; align-items: center; gap: 14px; }
        .chk { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); cursor: pointer; }
        .vc-progress { margin-top: 12px; height: 6px; background: var(--panel2); border-radius: 4px; overflow: hidden; }
        .vc-progress .bar { height: 100%; background: var(--b); transition: width .2s; }
        @media (max-width: 720px) {
          .vc-stage.side { grid-template-columns: 1fr; }
          .vc-uploads { grid-template-columns: 1fr; }
          .vc-clock { font-size: 21px; }
          .hint { display: none; }
        }
      `}</style>
    </div>
  );
}

function Uploader({ label, accent, name, onChange }) {
  return (
    <label className={`up up-${accent}`}>
      <span className="up-top"><span className="ic" /> {label}</span>
      <span className="up-name">{name || "Scegli un video…"}</span>
      <input type="file" accept="video/*" onChange={onChange} hidden />
      <style jsx>{`
        .up { display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; background: #141720;
          border: 1px solid #272b36; border-radius: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
        .up:hover { border-color: #3a3f4d; background: #171b25; }
        .up-top { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #8b91a0; text-transform: uppercase; letter-spacing: .6px; }
        .ic { width: 8px; height: 8px; border-radius: 50%; }
        .up-a .ic { background: #ff9f1c; box-shadow: 0 0 8px #ff9f1c; }
        .up-b .ic { background: #22d3ee; box-shadow: 0 0 8px #22d3ee; }
        .up-name { font-size: 14px; color: #eef0f5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </label>
  );
}

function ClipPane({ accent, src, videoRef, time, dur, disabled, tool, color, shapes, onShapes, onLoaded, onStep, onScrub }) {
  const frameRef = useRef(null);
  const overlayRef = useRef(null);
  const drawingRef = useRef(null);  // in-progress drag shape (line/arrow/free)
  const angleRef = useRef(null);    // in-progress angle (accumulating taps)
  const cursorRef = useRef(null);   // last pointer position (for angle preview)

  const redraw = () => {
    const cv = overlayRef.current, fr = frameRef.current, v = videoRef.current;
    if (!cv || !fr) return;
    const cw = fr.clientWidth, ch = fr.clientHeight;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cw, ch);
    const rect = containRect(v?.videoWidth, v?.videoHeight, cw, ch);
    let preview = drawingRef.current;
    if (tool === "angle" && angleRef.current && cursorRef.current) {
      preview = { tool: "angle", color, pts: [...angleRef.current.pts, cursorRef.current] };
    }
    const all = preview ? [...shapes, preview] : shapes;
    drawShapesOnCtx(ctx, all, rect, Math.max(2.5, cw / 320));
  };

  useEffect(() => { redraw(); });
  useEffect(() => {
    const ro = new ResizeObserver(() => redraw());
    if (frameRef.current) ro.observe(frameRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const norm = (e) => {
    const fr = frameRef.current, v = videoRef.current;
    const box = fr.getBoundingClientRect();
    const rect = containRect(v?.videoWidth, v?.videoHeight, box.width, box.height);
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left - rect.x) / rect.w)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top - rect.y) / rect.h)),
    };
  };

  const onDown = (e) => {
    if (tool === "none" || !src) return;
    e.preventDefault();
    overlayRef.current?.setPointerCapture?.(e.pointerId);
    if (tool === "angle") { cursorRef.current = norm(e); redraw(); return; }
    drawingRef.current = { tool, color, pts: [norm(e)] };
    redraw();
  };
  const onMove = (e) => {
    if (tool === "none" || !src) return;
    const p = norm(e);
    cursorRef.current = p;
    if (drawingRef.current) {
      if (tool === "free") drawingRef.current.pts.push(p);
      else drawingRef.current.pts = [drawingRef.current.pts[0], p];
      redraw();
    } else if (tool === "angle" && angleRef.current) {
      redraw();
    }
  };
  const onUp = (e) => {
    if (tool === "angle") {
      const cur = angleRef.current ?? { tool: "angle", color, pts: [] };
      cur.pts.push(norm(e));
      angleRef.current = cur;
      if (cur.pts.length >= 3) { onShapes([...shapes, { ...cur, pts: cur.pts.slice(0, 3) }]); angleRef.current = null; cursorRef.current = null; }
      redraw();
      return;
    }
    const d = drawingRef.current;
    drawingRef.current = null;
    if (d && d.pts.length >= 2) onShapes([...shapes, d]);
    else redraw();
  };
  const clearAll = () => { angleRef.current = null; cursorRef.current = null; onShapes([]); };

  const drawable = tool !== "none" && !!src;

  return (
    <div className={`pane pane-${accent}`}>
      <div className="frame" ref={frameRef}>
        {src ? (
          <video ref={videoRef} src={src} playsInline preload="auto" onLoadedMetadata={(e) => { onLoaded(e.currentTarget.duration || 0); redraw(); }} />
        ) : (
          <div className="empty">Nessun video</div>
        )}
        <canvas ref={overlayRef} className="overlay"
          style={{ pointerEvents: drawable ? "auto" : "none", cursor: drawable ? "crosshair" : "default" }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
        <div className="stamp">{fmt(time)}</div>
        {shapes.length > 0 && (
          <div className="tools-mini">
            <button onClick={() => onShapes(shapes.slice(0, -1))} title="Annulla ultimo">↶</button>
            <button onClick={clearAll} title="Cancella tutto">🗑</button>
          </div>
        )}
      </div>

      <div className="row">
        <button onClick={() => onStep(-1)} disabled={disabled} title="Fotogramma indietro">◀</button>
        <input type="range" min={0} max={dur || 0} step={0.01} value={Math.min(time, dur || 0)} onChange={(e) => onScrub(parseFloat(e.target.value))} disabled={disabled} />
        <button onClick={() => onStep(1)} disabled={disabled} title="Fotogramma avanti">▶</button>
      </div>

      <style jsx>{`
        .pane { display: flex; flex-direction: column; gap: 8px; }
        .frame { position: relative; background: #000; border: 1px solid #272b36; border-radius: 12px;
          overflow: hidden; aspect-ratio: 16 / 9; touch-action: none; }
        .pane-a .frame { box-shadow: inset 0 0 0 2px rgba(255,159,28,.45); }
        .pane-b .frame { box-shadow: inset 0 0 0 2px rgba(34,211,238,.45); }
        video { width: 100%; height: 100%; object-fit: contain; display: block; }
        .overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
        .empty { width: 100%; height: 100%; display: grid; place-items: center; color: #4b4f59; font-size: 14px; }
        .stamp { position: absolute; left: 9px; bottom: 9px; padding: 3px 9px; background: rgba(0,0,0,.62);
          border-radius: 7px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14px;
          font-variant-numeric: tabular-nums; color: ${accent === "a" ? "#ff9f1c" : "#22d3ee"}; }
        .tools-mini { position: absolute; right: 9px; top: 9px; display: flex; gap: 5px; }
        .tools-mini button { background: rgba(0,0,0,.6); color: #eef0f5; border: 1px solid #272b36;
          border-radius: 7px; padding: 4px 9px; cursor: pointer; font-size: 13px; backdrop-filter: blur(4px); }
        .row { display: flex; align-items: center; gap: 8px; }
        .row button { background: #1b1f29; color: #eef0f5; border: 1px solid #272b36; border-radius: 8px; padding: 6px 11px; cursor: pointer; }
        .row button:disabled { opacity: .4; cursor: not-allowed; }
        input[type="range"] { flex: 1; accent-color: ${accent === "a" ? "#ff9f1c" : "#22d3ee"}; }
        input[type="range"]:disabled { opacity: .4; }
      `}</style>
    </div>
  );
}

function once(el, event) {
  return new Promise((res) => {
    const h = () => { el.removeEventListener(event, h); res(); };
    el.addEventListener(event, h);
  });
}

function pickMime() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || "";
}

function drawTimecode(ctx, t, W) {
  const label = fmt(t);
  ctx.save();
  ctx.font = "bold 28px ui-monospace, Menlo, Consolas, monospace";
  const padX = 14;
  const textW = ctx.measureText(label).width;
  const boxW = textW + padX * 2, boxH = 40;
  const x = (W - boxW) / 2, y = 12;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  roundRect(ctx, x, y, boxW, boxH, 8); ctx.fill();
  ctx.fillStyle = "#ff9f1c"; ctx.textBaseline = "middle";
  ctx.fillText(label, x + padX, y + boxH / 2 + 1);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
