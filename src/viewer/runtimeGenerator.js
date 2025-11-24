import Alea from "./vendor/alea.js";
import { createNoise2D } from "../../node_modules/simplex-noise/dist/esm/simplex-noise.js";

export const baseWorldGenConfig = {
  continents: {
    count: 7,
    radius: 0.8,
    shapeNoiseFrequency: 0.004,
    warpFrequency: 0.003,
    warpStrength: 0.6,
  },
  elevation: {
    averageHeight: 0.52,
    ridgeStrength: 0.7,
    riftStrength: 0.5,
    mountainStrength: 1,
    erosionIterations: 6,
    erosionStrength: 0.45,
    peakCount: 12,
    peakRadius: 0.05,
    peakSharpness: 1.6,
    peakStrength: 0.45,
  },
  biomes: {
    latitudinalSoftness: 1.2,
    temperatureNoiseWeight: 0.35,
    humidityWidth: 1,
    temperatureBands: {
      polar: 0.18,
      boreal: 0.35,
      tropical: 0.7,
    },
    humidityBands: {
      desert: 0.75,
      scrub: 0.55,
      savanna: 0.45,
      forest: 0.65,
      rainforest: 0.8,
    },
    mountain: {
      range: 0.68,
      highPeak: 0.82,
      snow: 0.9,
    },
    wetlandRiverThreshold: 0.45,
  },
};

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item));
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = clone(value[key]);
    }
    return out;
  }
  return value;
}

function deepMerge(base, override) {
  if (!override) {
    return clone(base);
  }

  if (!isPlainObject(base)) {
    return override !== undefined ? override : clone(base);
  }

  const result = {};
  const baseKeys = new Set([...Object.keys(base), ...Object.keys(override)]);

  for (const key of baseKeys) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (overrideValue === undefined) {
      result[key] = clone(baseValue);
    } else if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else {
      result[key] = overrideValue;
    }
  }

  return result;
}

export function mergeWorldGenConfig(override) {
  return deepMerge(baseWorldGenConfig, override);
}

function createSeededNoise(seed) {
  const rng = Alea(seed);
  const noise2D = createNoise2D(rng);
  return noise2D;
}

// Helper: clamp value into [min, max]
function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

const width = 2048;
const height = 1024;
const size = width * height;

// Working buffers reused between runs to remove allocation overhead.
const working = createWorkingBuffers();

function createWorkingBuffers() {
  const buf = {
    continentalMask: new Float32Array(size),
    baseElev: new Float32Array(size),
    shaped: new Float32Array(size),
    beautified: new Float32Array(size),
    elevation: new Float32Array(size),
    temperature: new Float32Array(size),
    humidity: new Float32Array(size),
    rainfall: new Float32Array(size),
    biome: new Uint8Array(size),
    windU: new Float32Array(size),
    windV: new Float32Array(size),
    river: new Float32Array(size),
    downstream: new Int32Array(size),
    indices: new Int32Array(size),
    erosionBuffer: new Float32Array(size),
  };

  for (let i = 0; i < size; i++) {
    buf.indices[i] = i;
  }
  return buf;
}

export function generateCoarseGrid(seed = "world-seed", configOverride) {
  const {
    continentalMask,
    baseElev,
    shaped,
    beautified,
    elevation,
    temperature,
    humidity,
    rainfall,
    biome,
    windU,
    windV,
    river,
    downstream,
    indices,
    erosionBuffer,
  } = working;

  const config = mergeWorldGenConfig(configOverride);
  const baseCount = Math.max(1, baseWorldGenConfig.continents.count);
  const continentDensity = Math.max(0.2, config.continents.count) / baseCount;
  const worldRadius = clamp(config.continents.radius, 0.4, 1);
  const shapeFrequency = config.continents.shapeNoiseFrequency * continentDensity;
  const warpFrequency = config.continents.warpFrequency * continentDensity;
  const warpStrength = clamp(config.continents.warpStrength, 0, 1.5);

  const erosionIterations = Math.max(1, Math.round(config.elevation.erosionIterations));
  const erosionStrength = clamp(config.elevation.erosionStrength, 0, 1);
  const mountainStrength = clamp(config.elevation.mountainStrength, 0, 3);
  const ridgeStrength = config.elevation.ridgeStrength;
  const riftStrength = config.elevation.riftStrength;
  const peakCount = Math.max(0, Math.round(config.elevation.peakCount));
  const peakRadiusPx = clamp(config.elevation.peakRadius, 0.005, 0.3) * Math.min(width, height);
  const peakSharpness = Math.max(0.5, config.elevation.peakSharpness);
  const peakStrength = config.elevation.peakStrength;
  const elevationBias = clamp(config.elevation.averageHeight - 0.5, -0.4, 0.4);

  const biomesConfig = config.biomes;
  const latSoftness = Math.max(0.2, biomesConfig.latitudinalSoftness);
  const tempNoiseWeight = clamp(biomesConfig.temperatureNoiseWeight, 0, 1);
  const humidityWidth = Math.max(0.1, biomesConfig.humidityWidth);
  const wetlandThreshold = clamp(biomesConfig.wetlandRiverThreshold, 0, 1);

  // Noise fields
  const continentalNoise = createSeededNoise(seed + "_continental");
  const warpNoise = createSeededNoise(seed + "_warp");
  const plateNoise = createSeededNoise(seed + "_plate");

  const tempNoise = createSeededNoise(seed + "_temp");
  const humidityNoise = createSeededNoise(seed + "_humidity");
  const windNoiseU = createSeededNoise(seed + "_windU");
  const windNoiseV = createSeededNoise(seed + "_windV");
  const detailNoise1 = createSeededNoise(seed + "_detail1");
  const detailNoise2 = createSeededNoise(seed + "_detail2");
  const beautyWarp1 = createSeededNoise(seed + "_beautyWarp1");
  const beautyWarp2 = createSeededNoise(seed + "_beautyWarp2");

  // ============================================================
  // Step 1: Generate continental mask
  // ============================================================
  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1)) * 2 - 1; // -1..1

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nx = (x / (width - 1)) * 2 - 1; // -1..1

      // Radial falloff để giữ mọi thứ ở trung tâm
      const rNorm = Math.sqrt(nx * nx + ny * ny) / worldRadius;
      let radial = 1 - Math.pow(rNorm, 2.5); // falloff khá gắt
      radial = clamp(radial, 0, 1);

      // Noise tần số thấp cho shape tổng thể (nhiều "bong bóng" lục địa)
      const shape = (continentalNoise(x * shapeFrequency, y * shapeFrequency) + 1) / 2; // 0..1
      const shapedVal = Math.pow(shape, 1.8); // đẩy về 0/1 hơn

      // Warp mask bằng noise tần số thấp để méo biên
      const w = (warpNoise(x * warpFrequency, y * warpFrequency) + 1) / 2; // 0..1
      const warpFactor = clamp(1 + warpStrength * (w - 0.5), 0.3, 1.7);

      let mask = radial * shapedVal * warpFactor;
      mask = clamp(mask, 0, 1);

      continentalMask[idx] = mask;

      // Raw elevation (trước tectonics): noise đơn giản, mạnh hơn ở vùng mask cao
      const continentalDetailScale = Math.max(0.002, shapeFrequency * 2.4);
      const n =
        continentalNoise(
          x * continentalDetailScale + 100,
          y * continentalDetailScale + 200
        ) || 0; // -1..1
      const raw = n * mask;
      baseElev[idx] = raw; // khoảng -mask..+mask
    }
  }

  // ============================================================
  // Step 2: Plate tectonics (ridge, rift, subduction)
  // ============================================================
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const mask = continentalMask[idx] || 0;
      if (mask <= 0) continue; // ngoài đại lục / giữa biển sâu -> bỏ qua

      const p = plateNoise(x * 0.0015, y * 0.0015); // -1..1, tần số rất thấp
      const distToBoundary = Math.abs(p); // gần 0 = gần plate boundary
      const boundary = clamp(1 - distToBoundary * 6, 0, 1); // biên rộng vừa phải

      if (boundary <= 0) continue;

      const sign = p >= 0 ? 1 : -1;
      const strength = boundary * mask;

      // sign > 0: ridge / mountain belt
      // sign < 0: rift / subduction (giảm)
      const delta =
        strength *
        (sign > 0 ? ridgeStrength : -riftStrength) *
        mountainStrength;

      baseElev[idx] = baseElev[idx] + delta;
    }
  }

  // ============================================================
  // Step 2.5: Inject configurable mountain peaks / belts
  // ============================================================
  if (peakCount > 0) {
    const peakRng = Alea(seed + "_peaks");
    const peaks = new Array(peakCount).fill(null).map(() => ({
      x: peakRng() * width,
      y: peakRng() * height,
      strength: 0.4 + peakRng() * peakStrength,
    }));

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const mask = continentalMask[idx] || 0;
        if (!mask || mask < 0.25) continue;

        let boost = 0;
        for (const peak of peaks) {
          const dx = (x - peak.x) / peakRadiusPx;
          const dy = (y - peak.y) / peakRadiusPx;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 1) continue;
          const falloff = Math.pow(1 - dist, peakSharpness);
          boost += falloff * peak.strength;
        }

        if (boost !== 0) {
          baseElev[idx] = baseElev[idx] + boost * mountainStrength;
        }
      }
    }
  }

  // ============================================================
  // Step 3: Elevation shaping
  // ============================================================
  for (let i = 0; i < size; i++) {
    const mask = continentalMask[i] || 0;
    let h = baseElev[i]; // có thể âm/dương

    h = clamp(h, -1, 1);

    if (mask < 0.2) {
      // Deep ocean (xa lục địa): -1..-0.4
      const t = mask / 0.2; // 0..1
      const depth = -1 + t * 0.6; // -1..-0.4
      h = depth;
    } else if (mask < 0.35) {
      // Continental shelf: -0.4..0
      const t = (mask - 0.2) / 0.15; // 0..1
      h = -0.4 + t * 0.4;
    } else {
      // Land: từ bờ tới trong lục địa
      const t = (mask - 0.35) / 0.65; // 0..1

      // Cơ bản: plateau hơi cao, sau đó noise thêm
      const baseLand = -0.1 + t * 1.1; // khoảng -0.1..1.0

      // Tăng mountains dọc theo vùng có baseElev dương mạnh
      const mountainBoost = clamp((h + 0.3) * 0.8, 0, 0.8); // 0..~0.8

      h = baseLand + mountainBoost;
    }

    shaped[i] = clamp(h, -1, 1);
  }

  // ============================================================
  // Step 4: Erosion (hydraulic + thermal, very coarse)
  // ============================================================
  let current = shaped;
  let buffer = erosionBuffer;

  const iterations = erosionIterations;

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const h = current[idx];

        let sum = 0;
        let count = 0;

        // 4-neighbor (up/down/left/right)
        if (x > 0) {
          sum += current[idx - 1];
          count++;
        }
        if (x < width - 1) {
          sum += current[idx + 1];
          count++;
        }
        if (y > 0) {
          sum += current[idx - width];
          count++;
        }
        if (y < height - 1) {
          sum += current[idx + width];
          count++;
        }

        const avg = count > 0 ? sum / count : h;

        // Thermal: giảm đỉnh quá nhọn mạnh hơn valley
        let newH;
        if (h > avg) {
          // Đỉnh -> xói mòn về avg
          newH = avg + (h - avg) * (1 - erosionStrength);
        } else {
          // Thung lũng -> fill nhẹ, giữ cấu trúc
          const fillStrength = erosionStrength * 0.35;
          newH = h * (1 - fillStrength) + avg * fillStrength;
        }

        buffer[idx] = clamp(newH, -1, 1);
      }
    }

    const tmp = current;
    current = buffer;
    buffer = tmp;
  }

  // ============================================================
  // Step 7: Beautify (noise octaves + domain warp)
  // ============================================================
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Domain warp nhẹ quanh vị trí hiện tại
      const w1 = beautyWarp1(x * 0.01, y * 0.01); // -1..1
      const w2 = beautyWarp2(x * 0.01, y * 0.01); // -1..1
      const wx = x + w1 * 8; // lệch tối đa ~8 pixel
      const wy = y + w2 * 8;

      const sx = Math.max(0, Math.min(width - 1, Math.round(wx)));
      const sy = Math.max(0, Math.min(height - 1, Math.round(wy)));
      const sIdx = sy * width + sx;

      let h = current[sIdx];

      // Thêm fractal detail (2 octave noise nhỏ)
      const d1 = detailNoise1(x * 0.03, y * 0.03); // -1..1
      const d2 = detailNoise2(x * 0.06, y * 0.06); // -1..1
      const detail = d1 * 0.08 + d2 * 0.04;

      h = clamp(h + detail, -1, 1);
      beautified[idx] = h;
    }
  }

  for (let i = 0; i < size; i++) {
    const h = (beautified[i] + 1) * 0.5 + elevationBias; // -> 0..1
    elevation[i] = clamp(h, 0, 1);
  }

  // ============================================================
  // Step 5: River generation (flow field)
  // ============================================================
  river.fill(0);

  const seaLevel = 0.35;

  // Prepare index array (kept between runs, only resort)
  indices.sort((a, b) => elevation[b] - elevation[a]);

  downstream.fill(-1);

  // Tính hướng chảy (steepest descent trong 8 láng giềng)
  for (const idx of indices) {
    const elevHere = elevation[idx];
    if (elevHere <= seaLevel) continue; // biển không sinh river

    const x = idx % width;
    const y = (idx / width) | 0;

    let bestIdx = -1;
    let bestDrop = 0;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        const elevN = elevation[nIdx];
        const drop = elevHere - elevN;
        if (drop > bestDrop) {
          bestDrop = drop;
          bestIdx = nIdx;
        }
      }
    }

    if (bestIdx >= 0 && bestDrop > 0.0001) {
      downstream[idx] = bestIdx;
    }
  }

  // Flow accumulation: đi từ cao xuống thấp
  for (const idx of indices) {
    const elevHere = elevation[idx];
    if (elevHere <= seaLevel) continue;

    const currentFlow = river[idx] + 1; // local rainfall
    river[idx] = currentFlow;

    const d = downstream[idx];
    if (d >= 0) {
      river[d] = river[d] + currentFlow;
    }
  }

  // Chuẩn hóa về 0..1, lọc những flow rất nhỏ
  let maxFlow = 0;
  for (let i = 0; i < size; i++) {
    const f = river[i];
    if (f > maxFlow) maxFlow = f;
  }
  const invMaxFlow = maxFlow > 0 ? 1 / maxFlow : 1;
  for (let i = 0; i < size; i++) {
    let f = river[i] * invMaxFlow;
    if (f < 0.05) f = 0; // bỏ những rãnh rất nhỏ
    river[i] = clamp(f, 0, 1);
  }

  // ============================================================
  // Step 6: Biome mapping + khí hậu (temp, humidity, rainfall, wind)
  // ============================================================
  const tempScale = 0.01;
  const humidityScale = 0.01;
  const windScale = 0.02;

  const shallowSeaLevel = 0.38;
  const deepSeaLevel = 0.25;
  const tempBands = biomesConfig.temperatureBands;
  const humidityBands = biomesConfig.humidityBands;
  const mountainCfg = biomesConfig.mountain;
  const latWeight = 1 - tempNoiseWeight;

  for (let y = 0; y < height; y++) {
    const lat = y / height; // 0 = nam, 1 = bắc
    const latNorm = Math.abs(lat - 0.5) * 2;
    const latComponent = Math.pow(1 - latNorm, latSoftness); // nóng nhất ở xích đạo

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const elev = elevation[idx];

      // Temperature: vĩ độ + noise
      const noiseTemp = (tempNoise(x * tempScale, y * tempScale) + 1) / 2;
      let t = latComponent * latWeight + noiseTemp * tempNoiseWeight;
      // Cao độ cao thì lạnh hơn một chút
      t -= elev * 0.3;
      t = clamp(t, 0, 1);
      temperature[idx] = t;

      // Humidity: noise cơ bản, điều chỉnh theo local relief
      const nHum =
        (humidityNoise(
          (x + 999) * humidityScale,
          (y + 123) * humidityScale
        ) +
          1) / 2;
      let hHum = nHum;
      // Ven biển (elev thấp nhưng gần lục địa) ẩm hơn
      if (elev < shallowSeaLevel && elev > deepSeaLevel) {
        hHum += (shallowSeaLevel - elev) * 0.4;
      }
      hHum = clamp(hHum, 0, 1);
      humidity[idx] = hHum;

      // Rainfall: phụ thuộc humidity + elevation
      let r = hHum * (1 - Math.abs(elev - 0.5));
      r = clamp(r, 0, 1);
      rainfall[idx] = r;

      // Biome mapping
      let b = 0;

      if (elev < deepSeaLevel) {
        b = 0; // deep ocean
      } else if (elev < shallowSeaLevel) {
        b = t > 0.6 ? 2 : 1; // shelf warm/cold
      } else {
        // Land
        const dryness = Math.pow(clamp(1 - hHum, 0, 1), humidityWidth);
        const isPolar = t < tempBands.polar;
        const isBoreal = t < tempBands.boreal;
        const isTropical = t > tempBands.tropical;
        const riverStrength = river[idx];

        if (
          elev > mountainCfg.snow ||
          (elev > mountainCfg.range && t < tempBands.polar * 1.2)
        ) {
          b = 13; // alpine snow / băng
        } else if (elev > mountainCfg.highPeak) {
          b = 16; // jagged peak
        } else if (elev > mountainCfg.range) {
          b = isBoreal ? 12 : 15; // cold rocky mountain / temperate range
        } else if (isPolar) {
          b = 11; // tundra
        } else if (isBoreal) {
          b = 10; // taiga
        } else if (isTropical) {
          if (dryness > humidityBands.desert) {
            b = 3; // nóng - desert
          } else if (dryness > humidityBands.scrub) {
            b = 4; // scrub
          } else if (dryness > humidityBands.savanna) {
            b = 5; // savanna
          } else if (hHum > humidityBands.rainforest && r > 0.65) {
            b = 9; // rainforest
          } else if (hHum > humidityBands.forest) {
            b = 8; // tropical seasonal forest
          } else {
            b = 5; // fallback savanna
          }
        } else {
          if (dryness > humidityBands.desert) {
            b = 3; // cold desert / steppe
          } else if (dryness > humidityBands.scrub) {
            b = 6; // khô -> grassland
          } else if (hHum > humidityBands.forest) {
            b = 7; // temperate forest
          } else {
            b = 6; // temperate grassland
          }
        }

        // River valley / wetlands ưu tiên nếu river mạnh
        if (riverStrength > wetlandThreshold && elev > shallowSeaLevel) {
          b = 14;
        }
      }

      biome[idx] = b;

      // Wind (thô, từ noise: -1..1)
      const wu = windNoiseU(x * windScale, y * windScale);
      const wv = windNoiseV(x * windScale, y * windScale);
      windU[idx] = clamp(wu, -1, 1);
      windV[idx] = clamp(wv, -1, 1);
    }
  }

  return {
    width,
    height,
    elevation,
    temperature,
    humidity,
    rainfall,
    biome,
    windU,
    windV,
    river,
  };
}
