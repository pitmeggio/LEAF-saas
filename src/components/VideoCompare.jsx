"use client";

/**
 * VideoCompare — comparazione di due video in stile "Coach's Eye".
 *
 * - Carichi due video (Clip A e Clip B). Restano SOLO in locale nel browser
 *   (URL.createObjectURL): nessun upload, niente che tocca il server.
 * - Scrub indipendente + avanzamento fotogramma per fotogramma su ogni clip.
 * - "Sincronizza": blocca lo sfasamento attuale e da lì play/pausa/scrub/frame
 *   muovono i due video insieme mantenendo l'allineamento.
 * - Cronometro sempre visibile (e impresso nel video esportato).
 * - Export: disegna i due video su un canvas, registra con MediaRecorder e
 *   scarica un unico .webm. L'URL del blob viene revocato dopo il download.
 */

import { useEffect, useRef, useState } from "react";

const fmt = (s) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s * 100) % 100);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

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

  const [layout, setLayout] = useState("side"); // "side" | "stacked"
  const [linked, setLinked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [fps, setFps] = useState(30);
  const [includeAudio, setIncludeAudio] = useState(true);

  const offsetRef = useRef(0); // offset = tempoB - tempoA al momento del sync

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
      setSrcA(url);
      setNameA(file.name);
    } else {
      if (srcB) URL.revokeObjectURL(srcB);
      setSrcB(url);
      setNameB(file.name);
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
      const a = vA.current;
      const b = vB.current;
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
    const a = vA.current;
    const b = vB.current;
    if (!a && !b) return;
    const shouldPlay = a ? a.paused : b?.paused;
    try {
      if (shouldPlay) {
        if (a) await a.play();
        if (linked && b) await b.play();
        setPlaying(true);
      } else {
        a?.pause();
        b?.pause();
        setPlaying(false);
      }
    } catch (_) {}
  };

  const pauseAll = () => {
    vA.current?.pause();
    vB.current?.pause();
    setPlaying(false);
  };

  const stepFrame = (dir, which) => {
    pauseAll();
    const dt = (1 / fps) * dir;
    const move = (el, max) => {
      if (!el) return;
      el.currentTime = Math.min(Math.max(0, el.currentTime + dt), max || el.duration || 0);
    };
    if (linked) {
      move(vA.current, durA);
      move(vB.current, durB);
    } else if (which === "A") {
      move(vA.current, durA);
    } else {
      move(vB.current, durB);
    }
  };

  const scrub = (val, which) => {
    pauseAll();
    if (linked) {
      const a = vA.current;
      const b = vB.current;
      if (a) a.currentTime = val;
      if (b) b.currentTime = Math.min(Math.max(0, val + offsetRef.current), b.duration || 0);
    } else if (which === "A" && vA.current) {
      vA.current.currentTime = val;
    } else if (which === "B" && vB.current) {
      vB.current.currentTime = val;
    }
  };

  const toggleLink = () => {
    const a = vA.current;
    const b = vB.current;
    if (!linked) {
      if (!a || !b) {
        setError("Carica entrambi i video prima di sincronizzare.");
        return;
      }
      offsetRef.current = b.currentTime - a.currentTime;
      setError("");
    }
    pauseAll();
    setLinked((v) => !v);
  };

  const exportVideo = async () => {
    const a = vA.current;
    const b = vB.current;
    const canvas = canvasRef.current;
    if (!a || !b || !canvas) {
      setError("Servono entrambi i video per esportare.");
      return;
    }
    setError("");
    setExporting(true);
    setExportPct(0);
    pauseAll();

    const offset = linked ? offsetRef.current : b.currentTime - a.currentTime;
    const startA = Math.max(0, -offset);
    const startB = startA + offset;
    const windowDur = Math.min(a.duration - startA, b.duration - startB);
    if (!isFinite(windowDur) || windowDur <= 0) {
      setExporting(false);
      setError("I due video non si sovrappongono con questo allineamento.");
      return;
    }

    const wA = a.videoWidth || 640;
    const hA = a.videoHeight || 360;
    const wB = b.videoWidth || 640;
    const hB = b.videoHeight || 360;
    const gap = 8;
    let W, H, posA, posB;
    if (layout === "side") {
      const h = Math.max(hA, hB);
      W = wA + wB + gap;
      H = h;
      posA = { x: 0, y: (h - hA) / 2, w: wA, h: hA };
      posB = { x: wA + gap, y: (h - hB) / 2, w: wB, h: hB };
    } else {
      const w = Math.max(wA, wB);
      W = w;
      H = hA + hB + gap;
      posA = { x: (w - wA) / 2, y: 0, w: wA, h: hA };
      posB = { x: (w - wB) / 2, y: hA + gap, w: wB, h: hB };
    }
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    a.playbackRate = 1;
    b.playbackRate = 1;
    a.currentTime = startA;
    b.currentTime = startB;
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
            const node = audioCtx.createMediaStreamSource(cap);
            node.connect(dest);
          }
        }
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch (_) {}
    }

    const mime = pickMime();
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch (err) {
      setExporting(false);
      setError("Il browser non supporta la registrazione video (MediaRecorder).");
      return;
    }
    recorderRef.current = recorder;
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

    const finalize = () =>
      new Promise((res) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime || "video/webm" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `comparazione-${Date.now()}.webm`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          audioCtx?.close();
          res();
        };
      });

    const endA = startA + windowDur;
    const draw = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      try {
        ctx.drawImage(a, posA.x, posA.y, posA.w, posA.h);
        ctx.drawImage(b, posB.x, posB.y, posB.w, posB.h);
      } catch (_) {}
      drawTimecode(ctx, a.currentTime - startA, W);

      const done = a.currentTime >= endA - 0.001 || a.ended;
      setExportPct(Math.min(100, Math.round(((a.currentTime - startA) / windowDur) * 100)));
      if (done) {
        a.pause();
        b.pause();
        recorder.stop();
      } else {
        rafRef.current = requestAnimationFrame(draw);
      }
    };

    recorder.start();
    cancelAnimationFrame(rafRef.current);
    await Promise.all([a.play(), b.play()]);
    rafRef.current = requestAnimationFrame(draw);

    await finalize();

    cancelAnimationFrame(rafRef.current);
    a.playbackRate = rate;
    b.playbackRate = rate;
    setExporting(false);
    setExportPct(100);
    rafRef.current = requestAnimationFrame(function tick() {
      if (vA.current) setTimeA(vA.current.currentTime);
      if (vB.current) setTimeB(vB.current.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    });
  };

  const masterTime = timeA;

  return (
    <div className="vc">
      <header className="vc-head">
        <div className="vc-title">
          <span className="dot" /> Comparazione video
        </div>
        <div className="vc-clock">{fmt(masterTime)}</div>
      </header>

      {error && <div className="vc-error">{error}</div>}

      <div className="vc-uploads">
        <Uploader label="Clip A" accent="a" name={nameA} onChange={(e) => loadFile(e, "A")} />
        <Uploader label="Clip B" accent="b" name={nameB} onChange={(e) => loadFile(e, "B")} />
      </div>

      <div className={`vc-stage ${layout}`}>
        <ClipPane
          accent="a"
          src={srcA}
          videoRef={vA}
          time={timeA}
          dur={durA}
          disabled={linked}
          onLoaded={(d) => setDurA(d)}
          onStep={(dir) => stepFrame(dir, "A")}
          onScrub={(v) => scrub(v, "A")}
        />
        <ClipPane
          accent="b"
          src={srcB}
          videoRef={vB}
          time={timeB}
          dur={durB}
          disabled={linked}
          onLoaded={(d) => setDurB(d)}
          onStep={(dir) => stepFrame(dir, "B")}
          onScrub={(v) => scrub(v, "B")}
        />
      </div>

      <div className="vc-controls">
        <button
          className={`btn link ${linked ? "on" : ""}`}
          onClick={toggleLink}
          title="Blocca l'allineamento attuale e muovi i due video insieme"
        >
          {linked ? "● Sincronizzati" : "Sincronizza"}
        </button>

        <button className="btn frame" onClick={() => stepFrame(-1, "A")} title="Fotogramma indietro">⏮</button>
        <button className="btn play" onClick={togglePlay}>{playing ? "Pausa" : "Play"}</button>
        <button className="btn frame" onClick={() => stepFrame(1, "A")} title="Fotogramma avanti">⏭</button>

        <div className="vc-rate">
          <label>Velocità</label>
          <select value={rate} onChange={(e) => setRate(parseFloat(e.target.value))}>
            <option value={0.1}>0.1×</option>
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
            <option value={2}>2×</option>
          </select>
        </div>

        <div className="vc-rate">
          <label>fps step</label>
          <select value={fps} onChange={(e) => setFps(parseInt(e.target.value, 10))}>
            <option value={24}>24</option>
            <option value={25}>25</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>
      </div>

      <div className="vc-export">
        <div className="vc-export-opts">
          <label className="chk">
            <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
            Includi audio
          </label>
          <div className="seg">
            <button className={layout === "side" ? "on" : ""} onClick={() => setLayout("side")}>Affiancati</button>
            <button className={layout === "stacked" ? "on" : ""} onClick={() => setLayout("stacked")}>Impilati</button>
          </div>
        </div>

        <button className="btn export" onClick={exportVideo} disabled={exporting || !srcA || !srcB}>
          {exporting ? `Esporto… ${exportPct}%` : "Esporta e scarica"}
        </button>
      </div>

      {exporting && (
        <div className="vc-progress">
          <div className="bar" style={{ width: `${exportPct}%` }} />
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style jsx>{`
        .vc {
          --bg: #0e0f12; --panel: #16181d; --line: #2a2d35; --text: #e7e9ee;
          --muted: #8a8f9a; --a: #ff9f1c; --b: #22d3ee;
          background: var(--bg); color: var(--text); border: 1px solid var(--line);
          border-radius: 14px; padding: 16px;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          max-width: 1100px; margin: 0 auto;
        }
        .vc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .vc-title { display: flex; align-items: center; gap: 8px; font-weight: 600; letter-spacing: .2px; }
        .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--a); box-shadow: 0 0 12px var(--a); }
        .vc-clock { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 28px;
          font-variant-numeric: tabular-nums; color: var(--a); letter-spacing: 1px; }
        .vc-error { background: #3a1418; border: 1px solid #6b2026; color: #ffb4b4;
          padding: 8px 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .vc-uploads { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .vc-stage { display: grid; gap: 10px; margin-bottom: 12px; }
        .vc-stage.side { grid-template-columns: 1fr 1fr; }
        .vc-stage.stacked { grid-template-columns: 1fr; }
        .vc-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px;
          background: var(--panel); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 12px; }
        .btn { background: #20232b; color: var(--text); border: 1px solid var(--line); border-radius: 8px;
          padding: 8px 14px; cursor: pointer; font-size: 14px; transition: background .15s, border-color .15s; }
        .btn:hover { background: #272b34; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn.play { background: var(--a); color: #1a1206; border-color: var(--a); font-weight: 600; min-width: 84px; }
        .btn.link.on { background: #103b2e; border-color: #1f7a5c; color: #6ee7b7; }
        .btn.export { background: var(--b); color: #042b33; border-color: var(--b); font-weight: 600; }
        .vc-rate { display: flex; align-items: center; gap: 6px; margin-left: auto; }
        .vc-rate + .vc-rate { margin-left: 0; }
        .vc-rate label { color: var(--muted); font-size: 12px; }
        select { background: #20232b; color: var(--text); border: 1px solid var(--line);
          border-radius: 7px; padding: 6px 8px; font-size: 13px; }
        .vc-export { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .vc-export-opts { display: flex; align-items: center; gap: 14px; }
        .chk { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); cursor: pointer; }
        .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
        .seg button { background: #20232b; color: var(--muted); border: none; padding: 7px 12px; cursor: pointer; font-size: 13px; }
        .seg button.on { background: #2b2f3a; color: var(--text); }
        .vc-progress { margin-top: 10px; height: 6px; background: #20232b; border-radius: 4px; overflow: hidden; }
        .vc-progress .bar { height: 100%; background: var(--b); transition: width .2s; }
        @media (max-width: 720px) {
          .vc-stage.side { grid-template-columns: 1fr; }
          .vc-uploads { grid-template-columns: 1fr; }
          .vc-clock { font-size: 22px; }
        }
      `}</style>
    </div>
  );
}

function Uploader({ label, accent, name, onChange }) {
  return (
    <label className={`up up-${accent}`}>
      <span className="up-label">{label}</span>
      <span className="up-name">{name || "Scegli un video…"}</span>
      <input type="file" accept="video/*" onChange={onChange} hidden />
      <style jsx>{`
        .up { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; background: #16181d;
          border: 1px dashed #2a2d35; border-radius: 10px; cursor: pointer; transition: border-color .15s; }
        .up:hover { border-color: #3a3e48; }
        .up-a { border-left: 3px solid #ff9f1c; }
        .up-b { border-left: 3px solid #22d3ee; }
        .up-label { font-size: 12px; color: #8a8f9a; text-transform: uppercase; letter-spacing: .5px; }
        .up-name { font-size: 14px; color: #e7e9ee; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      `}</style>
    </label>
  );
}

function ClipPane({ accent, src, videoRef, time, dur, disabled, onLoaded, onStep, onScrub }) {
  return (
    <div className={`pane pane-${accent}`}>
      <div className="frame">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            playsInline
            preload="auto"
            onLoadedMetadata={(e) => onLoaded(e.currentTarget.duration || 0)}
          />
        ) : (
          <div className="empty">Nessun video</div>
        )}
        <div className="stamp">{fmt(time)}</div>
      </div>

      <div className="row">
        <button onClick={() => onStep(-1)} disabled={disabled} title="Fotogramma indietro">◀</button>
        <input
          type="range"
          min={0}
          max={dur || 0}
          step={0.01}
          value={Math.min(time, dur || 0)}
          onChange={(e) => onScrub(parseFloat(e.target.value))}
          disabled={disabled}
        />
        <button onClick={() => onStep(1)} disabled={disabled} title="Fotogramma avanti">▶</button>
      </div>

      <style jsx>{`
        .pane { display: flex; flex-direction: column; gap: 8px; }
        .frame { position: relative; background: #000; border: 1px solid #2a2d35; border-radius: 10px;
          overflow: hidden; aspect-ratio: 16 / 9; }
        .pane-a .frame { box-shadow: inset 0 0 0 2px rgba(255,159,28,.5); }
        .pane-b .frame { box-shadow: inset 0 0 0 2px rgba(34,211,238,.5); }
        video { width: 100%; height: 100%; object-fit: contain; display: block; }
        .empty { width: 100%; height: 100%; display: grid; place-items: center; color: #4b4f59; font-size: 14px; }
        .stamp { position: absolute; left: 8px; bottom: 8px; padding: 3px 8px; background: rgba(0,0,0,.6);
          border-radius: 6px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 14px;
          font-variant-numeric: tabular-nums; color: ${accent === "a" ? "#ff9f1c" : "#22d3ee"}; }
        .row { display: flex; align-items: center; gap: 8px; }
        .row button { background: #20232b; color: #e7e9ee; border: 1px solid #2a2d35; border-radius: 7px;
          padding: 6px 10px; cursor: pointer; }
        .row button:disabled { opacity: .4; cursor: not-allowed; }
        input[type="range"] { flex: 1; accent-color: ${accent === "a" ? "#ff9f1c" : "#22d3ee"}; }
        input[type="range"]:disabled { opacity: .4; }
      `}</style>
    </div>
  );
}

function once(el, event) {
  return new Promise((res) => {
    const h = () => {
      el.removeEventListener(event, h);
      res();
    };
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
  const boxW = textW + padX * 2;
  const boxH = 40;
  const x = (W - boxW) / 2;
  const y = 12;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  roundRect(ctx, x, y, boxW, boxH, 8);
  ctx.fill();
  ctx.fillStyle = "#ff9f1c";
  ctx.textBaseline = "middle";
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
