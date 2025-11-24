import {
  baseWorldGenConfig,
  mergeWorldGenConfig,
} from "./runtimeGenerator.js";

const defaultWidth = 2048;
const defaultHeight = 1024;
const deepSeaLevel = 0.25;
const shallowSeaLevel = 0.38;

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("canvas")
);
const ctx = canvas.getContext("2d");
canvas.width = defaultWidth;
canvas.height = defaultHeight;

const statusEl = document.getElementById("status");
const renderCompositeBtn = document.getElementById("renderCompositeBtn");
const renderBiomeBtn = document.getElementById("renderBiomeBtn");
const renderHeightBtn = document.getElementById("renderHeightBtn");
const applyConfigBtn = document.getElementById("applyConfigBtn");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const seedInput = /** @type {HTMLInputElement} */ (
  document.getElementById("seedInput")
);
const randomSeedBtn = document.getElementById("randomSeedBtn");

const controlContainers = {
  continents: document.getElementById("continentsControls"),
  elevation: document.getElementById("elevationControls"),
  biomes: document.getElementById("biomeControls"),
};

const oceanBands = [
  { t: 0.25, color: [4, 24, 68] },
  { t: 0.5, color: [6, 44, 104] },
  { t: 0.75, color: [20, 80, 136] },
  { t: 0.9, color: [42, 118, 170] },
  { t: 1, color: [125, 202, 230] },
];

const palette = {
  beach: [218, 204, 140],
  plains: [196, 177, 96],
  desert: [211, 130, 78],
  scrub: [204, 167, 94],
  savanna: [194, 180, 96],
  grassland: [134, 168, 80],
  temperateForest: [99, 146, 76],
  tropicalForest: [76, 122, 69],
  rainforest: [60, 103, 62],
  taiga: [87, 120, 93],
  tundra: [178, 177, 153],
  mountainBase: [122, 116, 99],
  mountainRange: [139, 130, 112],
  mountainPeak: [181, 178, 170],
  highPeak: [214, 209, 198],
  snow: [233, 233, 232],
  wetlands: [96, 160, 140],
};

const controlDefinitions = {
  continents: [
    { path: "continents.count", label: "Số lục địa", min: 1, max: 12, step: 1 },
    { path: "continents.radius", label: "Bán kính vùng", min: 0.4, max: 1, step: 0.01 },
    { path: "continents.shapeNoiseFrequency", label: "Tần số shape noise", min: 0.001, max: 0.01, step: 0.0005 },
    { path: "continents.warpFrequency", label: "Tần số warp", min: 0.001, max: 0.01, step: 0.0005 },
    { path: "continents.warpStrength", label: "Độ méo warp", min: 0, max: 1.5, step: 0.05 },
  ],
  elevation: [
    { path: "elevation.averageHeight", label: "Độ cao trung bình", min: 0, max: 1, step: 0.01 },
    { path: "elevation.ridgeStrength", label: "Ridge strength", min: 0, max: 2, step: 0.05 },
    { path: "elevation.riftStrength", label: "Rift strength", min: 0, max: 2, step: 0.05 },
    { path: "elevation.mountainStrength", label: "Mountain strength", min: 0, max: 3, step: 0.05 },
    { path: "elevation.erosionIterations", label: "Số vòng erosion", min: 1, max: 12, step: 1 },
    { path: "elevation.erosionStrength", label: "Độ mạnh erosion", min: 0, max: 1, step: 0.02 },
    { path: "elevation.peakCount", label: "Số đỉnh núi thêm", min: 0, max: 30, step: 1 },
    { path: "elevation.peakRadius", label: "Bán kính đỉnh núi", min: 0.005, max: 0.25, step: 0.005 },
    { path: "elevation.peakSharpness", label: "Độ nhọn đỉnh núi", min: 0.5, max: 3, step: 0.05 },
    { path: "elevation.peakStrength", label: "Biên độ đỉnh núi", min: 0, max: 1, step: 0.02 },
  ],
  biomes: [
    { path: "biomes.latitudinalSoftness", label: "Latitudinal softness", min: 0.2, max: 2, step: 0.05 },
    { path: "biomes.temperatureNoiseWeight", label: "Trọng số nhiệt độ noise", min: 0, max: 1, step: 0.02 },
    { path: "biomes.humidityWidth", label: "Độ rộng vùng khô", min: 0.2, max: 3, step: 0.05 },
    { path: "biomes.wetlandRiverThreshold", label: "Ngưỡng wetland/river", min: 0, max: 1, step: 0.02 },
    { path: "biomes.temperatureBands.polar", label: "Nhiệt đới - Polar", min: 0, max: 0.4, step: 0.01 },
    { path: "biomes.temperatureBands.boreal", label: "Nhiệt đới - Boreal", min: 0.2, max: 0.6, step: 0.01 },
    { path: "biomes.temperatureBands.tropical", label: "Nhiệt đới - Tropical", min: 0.5, max: 0.9, step: 0.01 },
    { path: "biomes.humidityBands.desert", label: "Dryness - Desert", min: 0.3, max: 1, step: 0.02 },
    { path: "biomes.humidityBands.scrub", label: "Dryness - Scrub", min: 0.2, max: 0.9, step: 0.02 },
    { path: "biomes.humidityBands.savanna", label: "Dryness - Savanna", min: 0.2, max: 0.8, step: 0.02 },
    { path: "biomes.humidityBands.forest", label: "Độ ẩm - Forest", min: 0.3, max: 0.9, step: 0.02 },
    { path: "biomes.humidityBands.rainforest", label: "Độ ẩm - Rainforest", min: 0.4, max: 1, step: 0.02 },
    { path: "biomes.mountain.range", label: "Mountain range cutoff", min: 0.4, max: 0.9, step: 0.01 },
    { path: "biomes.mountain.highPeak", label: "High peak cutoff", min: 0.6, max: 0.95, step: 0.01 },
    { path: "biomes.mountain.snow", label: "Snow cutoff", min: 0.7, max: 1, step: 0.01 },
  ],
};

let currentConfig = mergeWorldGenConfig();
let currentSeed = "";
let currentWorld = null;
let regenTimer = null;
let isGenerating = false;
let queuedReason = null;
let activeRenderMode = "composite";
const controlRegistry = new Map();
let workerRequestId = 0;
let latestAppliedId = 0;

const worker = new Worker("./generatorWorker.js?v=3", { type: "module" });

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(c1, c2, t) {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function pickBand(bands, t) {
  const clamped = clamp01(t);
  for (const band of bands) {
    if (clamped <= band.t) return band.color;
  }
  return bands[bands.length - 1].color;
}

function biomeColor(biomeId, elev) {
  const e = clamp01(elev);
  if (e < shallowSeaLevel) {
    const normalized = e / shallowSeaLevel;
    return pickBand(oceanBands, normalized);
  }

  const beachBandEnd = shallowSeaLevel + 0.012;
  if (e < beachBandEnd) {
    return palette.beach;
  }

  switch (biomeId) {
    case 3:
      return palette.desert;
    case 4:
      return palette.scrub;
    case 5:
      return palette.savanna;
    case 6:
      return palette.grassland;
    case 7:
      return palette.temperateForest;
    case 8:
      return palette.tropicalForest;
    case 9:
      return palette.rainforest;
    case 10:
      return palette.taiga;
    case 11:
      return palette.tundra;
    case 12: {
      const t = clamp01((e - 0.62) / 0.25);
      return lerpColor(palette.mountainBase, palette.mountainPeak, t);
    }
    case 13:
      return palette.snow;
    case 14:
      return palette.wetlands;
    case 15: {
      const t = clamp01((e - 0.58) / 0.3);
      return lerpColor(palette.mountainRange, palette.mountainPeak, t);
    }
    case 16:
      return palette.highPeak;
    default:
      return palette.plains;
  }
}

function applyHeightShading(rgb) {
  // Cartoon map: giữ màu phẳng, không shading theo độ cao
  return rgb;
}

function drawComposite(elev, biome, river) {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const dst = img.data;

  for (let i = 0; i < elev.length; i++) {
    const h = elev[i];
    const b = biome[i];
    const r = river[i];

    const cBase = biomeColor(b, h);
    const isWater = h < shallowSeaLevel;
    const cShade = isWater ? cBase : applyHeightShading(cBase, h);

    let [R, G, B] = cShade;
    if (r > 0.15 && h >= shallowSeaLevel) {
      const intensity = clamp01((r - 0.15) / 0.5);
      const riverColor = [125, 198, 240];
      const alpha = 0.25 + intensity * 0.45;
      R = Math.round(R * (1 - alpha) + riverColor[0] * alpha);
      G = Math.round(G * (1 - alpha) + riverColor[1] * alpha);
      B = Math.round(B * (1 - alpha) + riverColor[2] * alpha);
    }

    const j = i * 4;
    dst[j] = R;
    dst[j + 1] = G;
    dst[j + 2] = B;
    dst[j + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

function drawBiomeOnly(elev, biome) {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const dst = img.data;

  for (let i = 0; i < elev.length; i++) {
    const h = elev[i];
    const b = biome[i];
    const [R, G, B] = biomeColor(b, h);
    const j = i * 4;
    dst[j] = R;
    dst[j + 1] = G;
    dst[j + 2] = B;
    dst[j + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

function drawHeightOnly(elev) {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const dst = img.data;

  for (let i = 0; i < elev.length; i++) {
    let v = clamp01(elev[i]);
    if (v < shallowSeaLevel) {
      v = v * 0.8;
    } else {
      v = 0.2 + ((v - shallowSeaLevel) / (1 - shallowSeaLevel)) * 0.8;
    }
    const c = Math.round(v * 255);
    const j = i * 4;
    dst[j] = c;
    dst[j + 1] = c;
    dst[j + 2] = c;
    dst[j + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
}

function setDeepValue(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    if (i === parts.length - 1) {
      cur[key] = value;
    } else {
      if (typeof cur[key] !== "object" || cur[key] === null) {
        cur[key] = {};
      }
      cur = cur[key];
    }
  }
}

function getDeepValue(obj, path) {
  return path.split(".").reduce((acc, key) => {
    if (acc && typeof acc === "object") return acc[key];
    return undefined;
  }, obj);
}

function syncControlValue(path, value) {
  const ref = controlRegistry.get(path);
  if (!ref) return;
  ref.range.value = value;
  ref.number.value = value;
}

function buildControls(config) {
  controlRegistry.clear();
  createControlsForSection(controlContainers.continents, controlDefinitions.continents, config);
  createControlsForSection(controlContainers.elevation, controlDefinitions.elevation, config);
  createControlsForSection(controlContainers.biomes, controlDefinitions.biomes, config);
}

function createControlsForSection(container, definitions, config) {
  if (!container) return;
  container.innerHTML = "";

  for (const def of definitions) {
    const row = document.createElement("div");
    row.className = "control-row";

    const label = document.createElement("label");
    label.textContent = def.label;

    const inputs = document.createElement("div");
    inputs.className = "control-inputs";

    const range = document.createElement("input");
    range.type = "range";
    range.min = def.min;
    range.max = def.max;
    range.step = def.step;

    const number = document.createElement("input");
    number.type = "number";
    number.min = def.min;
    number.max = def.max;
    number.step = def.step;

    const setValue = (val) => {
      range.value = val;
      number.value = val;
    };

    const initialValue = getDeepValue(config, def.path);
    setValue(initialValue);

    const updateValue = (raw) => {
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) return;
      setDeepValue(currentConfig, def.path, numeric);
      setValue(numeric);
      scheduleRegenerate("config change");
    };

    range.addEventListener("input", (e) => updateValue(e.target.value));
    number.addEventListener("change", (e) => updateValue(e.target.value));

    inputs.appendChild(range);
    inputs.appendChild(number);
    row.appendChild(label);
    row.appendChild(inputs);
    container.appendChild(row);

    controlRegistry.set(def.path, { range, number, setValue });
  }
}

function scheduleRegenerate(reason) {
  if (regenTimer) {
    clearTimeout(regenTimer);
  }
  regenTimer = setTimeout(() => {
    regenTimer = null;
    regenerateWorld(reason);
  }, 400);
}

function renderCurrent() {
  if (!currentWorld) {
    setStatus("Chưa có dữ liệu để vẽ");
    return;
  }

  if (activeRenderMode === "biome") {
    drawBiomeOnly(currentWorld.elevation, currentWorld.biome);
    setStatus(`Biome map | seed ${currentSeed}`);
  } else if (activeRenderMode === "height") {
    drawHeightOnly(currentWorld.elevation);
    setStatus(`Height map | seed ${currentSeed}`);
  } else {
    drawComposite(currentWorld.elevation, currentWorld.biome, currentWorld.river);
    setStatus(`Composite map | seed ${currentSeed}`);
  }
}

function regenerateWorld(reason = "") {
  if (regenTimer) {
    clearTimeout(regenTimer);
    regenTimer = null;
  }
  if (isGenerating) {
    queuedReason = reason || queuedReason || "pending";
    return;
  }
  isGenerating = true;
  queuedReason = null;

  const seedValue = (seedInput?.value || currentSeed || "world-seed").trim();
  currentSeed = seedValue || "world-seed";
  const configToUse = mergeWorldGenConfig(currentConfig);
  const requestId = ++workerRequestId;

  setStatus(`Worker đang sinh world (${reason || "apply"})...`);
  worker.postMessage({
    id: requestId,
    seed: currentSeed,
    config: configToUse,
  });
}

function saveConfigToFile() {
  const payload = {
    seed: currentSeed,
    config: mergeWorldGenConfig(currentConfig),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "world-config-export.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus("Đã chuẩn bị file world-config-export.json");
}

async function loadSeedFromFile() {
  try {
    const res = await fetch(`../../data/seed.txt?v=${Date.now()}`);
    if (res.ok) {
      return (await res.text()).trim();
    }
  } catch (err) {
    console.warn("Không đọc được seed.txt, dùng seed ngẫu nhiên", err);
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

async function loadConfigFromFile() {
  try {
    const res = await fetch(`../../world-config.json?v=${Date.now()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Không đọc được world-config.json, dùng base config", err);
  }
  return baseWorldGenConfig;
}

async function init() {
  setStatus("loading seed + config...");
  const [seed, cfg] = await Promise.all([
    loadSeedFromFile(),
    loadConfigFromFile(),
  ]);

  currentSeed = seed;
  currentConfig = mergeWorldGenConfig(cfg);
  if (seedInput) seedInput.value = currentSeed;

  buildControls(currentConfig);
  setStatus("đang render world đầu tiên...");
  await regenerateWorld("initial render");
}

renderCompositeBtn?.addEventListener("click", () => {
  activeRenderMode = "composite";
  renderCurrent();
});
renderBiomeBtn?.addEventListener("click", () => {
  activeRenderMode = "biome";
  renderCurrent();
});
renderHeightBtn?.addEventListener("click", () => {
  activeRenderMode = "height";
  renderCurrent();
});

applyConfigBtn?.addEventListener("click", () => {
  regenerateWorld("apply button");
});

saveConfigBtn?.addEventListener("click", () => {
  saveConfigToFile();
});

seedInput?.addEventListener("change", (e) => {
  currentSeed = (e.target.value || "").trim() || currentSeed;
  scheduleRegenerate("seed change");
});

randomSeedBtn?.addEventListener("click", () => {
  const newSeed = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  if (seedInput) seedInput.value = newSeed;
  currentSeed = newSeed;
  regenerateWorld("random seed");
});

worker.onmessage = (event) => {
  const data = event.data;
  if (typeof data !== "object" || data === null) return;
  const { id, error } = data;
  if (id && id < latestAppliedId) {
    return; // stale response
  }
  if (error) {
    console.error("Worker error", error);
    setStatus("error: " + error);
    isGenerating = false;
    return;
  }

  latestAppliedId = id || latestAppliedId;

  try {
    const world = {
      width: data.width,
      height: data.height,
      elevation: data.elevation instanceof Float32Array ? data.elevation : new Float32Array(data.elevation || []),
      temperature: data.temperature instanceof Float32Array ? data.temperature : new Float32Array(data.temperature || []),
      humidity: data.humidity instanceof Float32Array ? data.humidity : new Float32Array(data.humidity || []),
      rainfall: data.rainfall instanceof Float32Array ? data.rainfall : new Float32Array(data.rainfall || []),
      biome: data.biome instanceof Uint8Array ? data.biome : new Uint8Array(data.biome || []),
      windU: data.windU instanceof Float32Array ? data.windU : new Float32Array(data.windU || []),
      windV: data.windV instanceof Float32Array ? data.windV : new Float32Array(data.windV || []),
      river: data.river instanceof Float32Array ? data.river : new Float32Array(data.river || []),
    };

    if (canvas.width !== world.width || canvas.height !== world.height) {
      canvas.width = world.width;
      canvas.height = world.height;
    }

    currentWorld = world;
    renderCurrent();
    setStatus(`Rendered | seed ${currentSeed}`);
  } catch (err) {
    console.error("Render error", err);
    setStatus("error: " + err.message);
  } finally {
    isGenerating = false;
    if (queuedReason) {
      const nextReason = queuedReason;
      queuedReason = null;
      regenerateWorld(nextReason);
    }
  }
};

init();
