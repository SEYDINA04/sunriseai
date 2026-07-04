const API_BASE = "https://asr.afriklang.com";

/* ---------- Thème ---------- */
(function initTheme() {
  const toggle = document.getElementById("themeToggle");
  const iconDark = document.getElementById("themeIconDark");
  const iconLight = document.getElementById("themeIconLight");
  const root = document.documentElement;
  const saved = localStorage.getItem("afriklang-theme");
  if (saved) root.setAttribute("data-theme", saved);

  function reflectIcon() {
    const isDark = (root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    iconDark.style.display = isDark ? "none" : "block";
    iconLight.style.display = isDark ? "block" : "none";
  }
  reflectIcon();

  toggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("afriklang-theme", next);
    reflectIcon();
  });
})();

/* ---------- Tabs de la démo ---------- */
const tabTranscribe = document.getElementById("tabTranscribe");
const tabSpeak = document.getElementById("tabSpeak");
const panelTranscribe = document.getElementById("panelTranscribe");
const panelSpeak = document.getElementById("panelSpeak");

function selectTab(name) {
  const isTranscribe = name === "transcribe";
  tabTranscribe.setAttribute("aria-selected", String(isTranscribe));
  tabSpeak.setAttribute("aria-selected", String(!isTranscribe));
  panelTranscribe.classList.toggle("is-active", isTranscribe);
  panelSpeak.classList.toggle("is-active", !isTranscribe);
}
tabTranscribe.addEventListener("click", () => selectTab("transcribe"));
tabSpeak.addEventListener("click", () => selectTab("speak"));

/* ---------- Sélecteur de langue (transcription) ---------- */
let currentLang = "wo";
document.querySelectorAll(".lang-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".lang-pill").forEach((p) => p.setAttribute("aria-pressed", "false"));
    pill.setAttribute("aria-pressed", "true");
    currentLang = pill.dataset.lang;
  });
});

/* ---------- Enregistrement micro + waveform live ---------- */
const micBtn = document.getElementById("micBtn");
const canvas = document.getElementById("waveform");
const canvasCtx = canvas.getContext("2d");
const statusEl = document.getElementById("statusTranscribe");
const outputEl = document.getElementById("outputTranscribe");

let mediaRecorder, chunks = [], audioCtx, analyser, rafId, stream;
let recording = false;

function drawIdleWaveform() {
  const w = canvas.width, h = canvas.height;
  canvasCtx.clearRect(0, 0, w, h);
  canvasCtx.strokeStyle = getComputedStyle(document.body).getPropertyValue("--border");
  canvasCtx.lineWidth = 1.5;
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, h / 2);
  canvasCtx.lineTo(w, h / 2);
  canvasCtx.stroke();
}
drawIdleWaveform();

function drawLiveWaveform() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const w = canvas.width, h = canvas.height;
  const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#F4A261";

  function frame() {
    rafId = requestAnimationFrame(frame);
    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = accent;
    canvasCtx.beginPath();
    const slice = w / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;
      i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
      x += slice;
    }
    canvasCtx.stroke();
  }
  frame();
}

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    statusEl.textContent = "Micro inaccessible : autorisez l'accès dans votre navigateur.";
    return;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  drawLiveWaveform();

  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.onstop = async () => {
    cancelAnimationFrame(rafId);
    drawIdleWaveform();
    stream.getTracks().forEach((t) => t.stop());
    audioCtx.close();
    const blob = new Blob(chunks, { type: "audio/webm" });
    await sendForTranscription(blob);
  };
  mediaRecorder.start();
  recording = true;
  micBtn.classList.add("is-recording");
  micBtn.setAttribute("aria-label", "Arrêter l'enregistrement");
  statusEl.textContent = "Enregistrement… reparlez, puis cliquez à nouveau pour arrêter.";
}

function stopRecording() {
  recording = false;
  micBtn.classList.remove("is-recording");
  micBtn.setAttribute("aria-label", "Démarrer l'enregistrement");
  mediaRecorder.stop();
}

micBtn.addEventListener("click", () => (recording ? stopRecording() : startRecording()));

async function sendForTranscription(blob) {
  statusEl.textContent = "Transcription en cours…";
  outputEl.classList.remove("is-empty");
  outputEl.textContent = "…";
  const fd = new FormData();
  fd.append("file", blob, "recording.webm");
  try {
    const r = await fetch(`${API_BASE}/transcribe/${currentLang}?target_lang=fr`, { method: "POST", body: fd });
    const j = await r.json();
    if (!j.text) {
      outputEl.textContent = "Rien d'exploitable n'a été entendu — réessayez plus près du micro.";
      statusEl.textContent = "Cliquez sur le micro et parlez une phrase courte.";
      return;
    }
    outputEl.innerHTML = "";
    const main = document.createElement("div");
    main.textContent = j.text;
    outputEl.appendChild(main);
    if (j.translation) {
      const tr = document.createElement("div");
      tr.className = "translation";
      tr.textContent = j.translation;
      outputEl.appendChild(tr);
    }
    statusEl.textContent = `Modèle ${j.model}`;
  } catch (e) {
    outputEl.textContent = "Erreur réseau — le service est peut-être temporairement indisponible.";
  }
}

/* ---------- Synthèse vocale (Twi) ---------- */
const ttsInput = document.getElementById("ttsInput");
const ttsBtn = document.getElementById("ttsBtn");
const statusSpeak = document.getElementById("statusSpeak");
const outputSpeak = document.getElementById("outputSpeak");

ttsBtn.addEventListener("click", async () => {
  const text = ttsInput.value.trim();
  if (!text) {
    statusSpeak.textContent = "Écrivez un texte en twi d'abord.";
    return;
  }
  ttsBtn.disabled = true;
  statusSpeak.textContent = "Génération audio en cours…";
  outputSpeak.classList.remove("is-empty");
  outputSpeak.textContent = "…";
  try {
    const r = await fetch(`${API_BASE}/tts/twi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      outputSpeak.textContent = "Erreur : " + (j.error || r.statusText);
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    outputSpeak.innerHTML = "";
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = url;
    audio.style.width = "100%";
    outputSpeak.appendChild(audio);
    audio.play().catch(() => {});
    statusSpeak.textContent = "afriklang_twi_ttsv1 · 48 kHz";
  } catch (e) {
    outputSpeak.textContent = "Erreur réseau — le service est peut-être temporairement indisponible.";
  } finally {
    ttsBtn.disabled = false;
  }
});
