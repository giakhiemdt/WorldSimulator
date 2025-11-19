const width = 2048;
const height = 1024;

const deepSeaLevel = 0.25;
const shallowSeaLevel = 0.38;

const canvas = /** @type {HTMLCanvasElement} */ (
  document.getElementById("canvas")
);
const ctx = canvas.getContext("2d");
canvas.width = width;
canvas.height = height;

const statusEl = document.getElementById("status");
const renderCompositeBtn = document.getElementById("renderCompositeBtn");
const renderBiomeBtn = document.getElementById("renderBiomeBtn");
const renderHeightBtn = document.getElementById("renderHeightBtn");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

async function loadInt16Field(path, range) {
  setStatus(`loading ${path}...`);
  // Thêm query param để tránh cache của browser giữa các lần gen-world
  const res = await fetch(`${path}?v=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const i16 = new Int16Array(buf);
  const out = new Float32Array(i16.length);
  const scale = 1 / 32767;

  if (range === "0-1") {
    for (let i = 0; i < i16.length; i++) {
      let v = i16[i] * scale;
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      out[i] = v;
    }
  } else {
    for (let i = 0; i < i16.length; i++) {
      let v = i16[i] * scale;
      if (v < -1) v = -1;
      if (v > 1) v = 1;
      out[i] = v;
    }
  }

  setStatus(`loaded ${path}`);
  return out;
}

async function loadBiome(path) {
  setStatus(`loading ${path}...`);
  const res = await fetch(`${path}?v=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const u8 = new Uint8Array(buf);
  setStatus(`loaded ${path}`);
  return u8;
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
  mountainPeak: [181, 178, 170],
  snow: [233, 233, 232],
  wetlands: [96, 160, 140],
};
const beachBandEnd = shallowSeaLevel + 0.012;

function biomeColor(biomeId, elev) {
  // Elevation is 0..1, biomeId theo mapping trong generator
  // 0 deep ocean
  // 1 shelf (temperate / cold sea)
  // 2 tropical shelf / warm sea
  // 3 hot / cold desert
  // 4 semi-arid scrub
  // 5 savanna
  // 6 temperate grassland
  // 7 temperate forest
  // 8 tropical seasonal forest
  // 9 rainforest
  // 10 taiga
  // 11 tundra
  // 12 cold rocky mountain
  // 13 alpine snow
  // 14 river valley / wetlands
  const e = clamp01(elev);
  if (e < shallowSeaLevel) {
    const normalized = e / shallowSeaLevel;
    return pickBand(oceanBands, normalized);
  }

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
    default:
      return palette.plains;
  }
}

function applyHeightShading(rgb, elev) {
  // Cartoon map: giữ màu phẳng, không shading theo độ cao
  return rgb;
}

function drawComposite(elev, biome, river) {
  const img = ctx.createImageData(width, height);
  const dst = img.data;

  for (let i = 0; i < elev.length; i++) {
    const h = elev[i];
    const b = biome[i];
    const r = river[i];

    const cBase = biomeColor(b, h);
    // Land có shading theo độ cao, biển giữ màu base để không bị tối đen
    const isWater = h < shallowSeaLevel;
    const cShade = isWater ? cBase : applyHeightShading(cBase, h);

    // Overlay river (ưu tiên hiển thị trên land)
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
  const img = ctx.createImageData(width, height);
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
  const img = ctx.createImageData(width, height);
  const dst = img.data;

  for (let i = 0; i < elev.length; i++) {
    let v = clamp01(elev[i]);
    // Sử dụng gamma nhẹ để tách land/sea
    if (v < shallowSeaLevel) {
      v = v * 0.8;
    } else {
      v = 0.2 + (v - shallowSeaLevel) / (1 - shallowSeaLevel) * 0.8;
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

async function renderComposite() {
  try {
    setStatus("loading fields...");
    const [elev, biome, river] = await Promise.all([
      loadInt16Field("../../data/elevation.bin", "0-1"),
      loadBiome("../../data/biome.bin"),
      loadInt16Field("../../data/river.bin", "0-1"),
    ]);

    if (elev.length !== width * height) {
      console.warn("Unexpected elevation length", elev.length);
    }
    if (biome.length !== width * height) {
      console.warn("Unexpected biome length", biome.length);
    }
    if (river.length !== width * height) {
      console.warn("Unexpected river length", river.length);
    }

    setStatus("drawing composite...");
    drawComposite(elev, biome, river);
    setStatus("composite rendered");
  } catch (err) {
    console.error(err);
    setStatus("error: " + err.message);
  }
}

async function renderBiomeOnly() {
  try {
    setStatus("loading fields...");
    const [elev, biome] = await Promise.all([
      loadInt16Field("../../data/elevation.bin", "0-1"),
      loadBiome("../../data/biome.bin"),
    ]);
    setStatus("drawing biome...");
    drawBiomeOnly(elev, biome);
    setStatus("biome rendered");
  } catch (err) {
    console.error(err);
    setStatus("error: " + err.message);
  }
}

async function renderHeightOnly() {
  try {
    setStatus("loading elevation...");
    const elev = await loadInt16Field("../../data/elevation.bin", "0-1");
    setStatus("drawing height...");
    drawHeightOnly(elev);
    setStatus("height rendered");
  } catch (err) {
    console.error(err);
    setStatus("error: " + err.message);
  }
}

renderCompositeBtn?.addEventListener("click", renderComposite);
renderBiomeBtn?.addEventListener("click", renderBiomeOnly);
renderHeightBtn?.addEventListener("click", renderHeightOnly);

// Render lần đầu
renderComposite();
