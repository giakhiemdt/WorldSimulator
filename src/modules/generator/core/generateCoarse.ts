import type { CoarseGrid } from "../types/CoarseState";
import { createSeededNoise } from "../utils/noise";

// Helper: clamp value into [min, max]
function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function generateCoarseGrid(seed: string = "world-seed"): CoarseGrid {
  const width = 2048;
  const height = 1024;
  const size = width * height;

  const elevation = new Array(size);
  const temperature = new Array(size);
  const humidity = new Array(size);
  const rainfall = new Array(size);
  const biome = new Array(size);
  const windU = new Array(size);
  const windV = new Array(size);
  const river = new Array(size);

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
  //  - Thế giới luôn nằm ở trung tâm (radial falloff)
  //  - Hình dạng lục địa ngẫu nhiên bằng noise + warp
  // ============================================================
  const continentalMask = new Array(size); // 0..1
  const baseElev = new Array(size);        // raw elevation signal (trước shaping)

  const worldRadius = 0.8; // ~60% bán kính map -> ~1/3 diện tích

  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1)) * 2 - 1; // -1..1

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nx = (x / (width - 1)) * 2 - 1; // -1..1

      // Radial falloff để giữ mọi thứ ở trung tâm
      // Chuẩn hóa theo worldRadius để thế giới chỉ chiếm ~1/3–1/2 diện tích bản đồ
      const rNorm = Math.sqrt(nx * nx + ny * ny) / worldRadius;
      let radial = 1 - Math.pow(rNorm, 2.5); // falloff khá gắt
      radial = clamp(radial, 0, 1);

      // Noise tần số thấp cho shape tổng thể (nhiều "bong bóng" lục địa)
      const shape =
        (continentalNoise(x * 0.004, y * 0.004) + 1) / 2; // 0..1
      const shaped = Math.pow(shape, 1.8); // đẩy về 0/1 hơn

      // Warp mask bằng noise tần số thấp để méo biên
      const w = (warpNoise(x * 0.003, y * 0.003) + 1) / 2; // 0..1
      const warpFactor = 0.7 + 0.6 * (w - 0.5); // ~0.4..1.0 quanh 0.7

      let mask = radial * shaped * warpFactor;
      mask = clamp(mask, 0, 1);

      continentalMask[idx] = mask;

      // Raw elevation (trước tectonics): noise đơn giản, mạnh hơn ở vùng mask cao
      const n = continentalNoise(x * 0.01 + 100, y * 0.01 + 200); // -1..1
      const raw = n * mask;
      baseElev[idx] = raw; // khoảng -mask..+mask
    }
  }

  // ============================================================
  // Step 2: Plate tectonics (ridge, rift, subduction)
  // ============================================================
  // Ý tưởng: dùng 1 noise tần số rất thấp, zero-crossing ~ biên plate.
  // Gần biên plate: ridge (núi) hoặc rift/trench (giảm độ cao) tùy theo dấu.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const mask = continentalMask[idx] || 0;
      if (mask <= 0) continue; // ngoài đại lục / giữa biển sâu -> bỏ qua

      const p = plateNoise(x * 0.0015, y * 0.0015); // -1..1, tần số rất thấp
      const distToBoundary = Math.abs(p);           // gần 0 = gần plate boundary
      const boundary = clamp(1 - distToBoundary * 6, 0, 1); // biên rộng vừa phải

      if (boundary <= 0) continue;

      const sign = p >= 0 ? 1 : -1;
      const strength = boundary * mask;

      // sign > 0: ridge / mountain belt
      // sign < 0: rift / subduction (giảm)
      const delta = strength * (sign > 0 ? 0.7 : -0.5);

      baseElev[idx] = (baseElev[idx] as number) + delta;
    }
  }

  // ============================================================
  // Step 3: Elevation shaping
  //  - deep ocean basins
  //  - continental shelves
  //  - mountain belts / plateaus
  // ============================================================
  const shaped = new Array(size); // -1..1 (relative height)

  for (let i = 0; i < size; i++) {
    const mask = continentalMask[i] as number || 0;
    let h = baseElev[i] as number; // có thể âm/dương

    // Đầu tiên nén về [-1, 1]
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
  //  - đơn giản: làm mềm sườn dốc bằng smoothing theo láng giềng
  // ============================================================
  let current = shaped;
  let buffer = new Array(size);

  const iterations = 6;
  const erosionStrength = 0.45; // 0..1, càng cao càng mịn

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const h = current[idx] as number;

        let sum = 0;
        let count = 0;

        // 4-neighbor (up/down/left/right)
        if (x > 0) {
          sum += current[idx - 1] as number;
          count++;
        }
        if (x < width - 1) {
          sum += current[idx + 1] as number;
          count++;
        }
        if (y > 0) {
          sum += current[idx - width] as number;
          count++;
        }
        if (y < height - 1) {
          sum += current[idx + width] as number;
          count++;
        }

        const avg = count > 0 ? sum / count : h;

        // Thermal: giảm đỉnh quá nhọn mạnh hơn valley
        let newH: number;
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
  //  - thêm detail nhỏ + domain warp nhẹ cho elevation
  // ============================================================
  const beautified = new Array(size); // [-1,1]

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

      let h = current[sIdx] as number;

      // Thêm fractal detail (2 octave noise nhỏ)
      const d1 = detailNoise1(x * 0.03, y * 0.03); // -1..1
      const d2 = detailNoise2(x * 0.06, y * 0.06); // -1..1
      const detail = d1 * 0.08 + d2 * 0.04;

      h = clamp(h + detail, -1, 1);
      beautified[idx] = h;
    }
  }

  // current: elevation sau erosion + beautify trong [-1,1]
  for (let i = 0; i < size; i++) {
    const h = (beautified[i] as number + 1) * 0.5; // -> 0..1
    elevation[i] = clamp(h, 0, 1);
  }

  // ============================================================
  // Step 5: River generation (flow field)
  //  - flow accumulation theo hướng dốc lớn nhất (8-neighbor)
  // ============================================================
  for (let i = 0; i < size; i++) {
    river[i] = 0;
  }

  const seaLevel = 0.35;

  const indices = new Array<number>(size);
  for (let i = 0; i < size; i++) indices[i] = i;
  indices.sort(
    (a, b) => (elevation[b] as number) - (elevation[a] as number)
  );

  const downstream = new Int32Array(size);
  downstream.fill(-1);

  // Tính hướng chảy (steepest descent trong 8 láng giềng)
  for (const idx of indices) {
    const elevHere = elevation[idx] as number;
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
        const elevN = elevation[nIdx] as number;
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
    const elevHere = elevation[idx] as number;
    if (elevHere <= seaLevel) continue;

    const currentFlow = ((river[idx] as number) || 0) + 1; // local rainfall
    river[idx] = currentFlow;

    const d: number = downstream[idx] as number;
    if (d >= 0) {
      river[d] = (river[d] as number) + currentFlow;
    }
  }

  // Chuẩn hóa về 0..1, lọc những flow rất nhỏ
  let maxFlow = 0;
  for (let i = 0; i < size; i++) {
    const f = river[i] as number;
    if (f > maxFlow) maxFlow = f;
  }
  const invMaxFlow = maxFlow > 0 ? 1 / maxFlow : 1;
  for (let i = 0; i < size; i++) {
    let f = (river[i] as number) * invMaxFlow;
    if (f < 0.05) f = 0; // bỏ những rãnh rất nhỏ
    river[i] = clamp(f, 0, 1);
  }

  // ============================================================
  // Step 6: Biome mapping + khí hậu (temp, humidity, rainfall, wind)
  //  - biome dựa vào temp + humidity + elevation + river
  // ============================================================
  const tempScale = 0.01;
  const humidityScale = 0.01;
  const windScale = 0.02;

  const shallowSeaLevel = 0.38;
  const deepSeaLevel = 0.25;

  for (let y = 0; y < height; y++) {
    const lat = y / height; // 0 = nam, 1 = bắc

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      const elev = elevation[idx] as number;

      // Temperature: vĩ độ + noise
      const latTemp = 1 - Math.abs(lat - 0.5) * 2; // nóng nhất ở xích đạo
      const noiseTemp = (tempNoise(x * tempScale, y * tempScale) + 1) / 2;
      let t = 0.65 * latTemp + 0.35 * noiseTemp;
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

      // Biome mapping (0..N, tuỳ ý decode)
      // ID dự kiến:
      // 0 deep ocean, 1 shelf (lạnh/ôn đới), 2 shelf nóng / tropical sea,
      // 3 hot desert, 4 semi-arid scrub, 5 savanna,
      // 6 temperate grassland, 7 temperate forest, 8 tropical seasonal forest,
      // 9 rainforest, 10 taiga, 11 tundra,
      // 12 cold rocky mountain, 13 alpine snow, 14 river valley / wetlands
      let b = 0;
      const riverStrength = river[idx] as number;

      if (elev < deepSeaLevel) {
        // deep ocean
        b = 0;
      } else if (elev < shallowSeaLevel) {
        // continental shelf / coast, tách warm/cold
        b = t > 0.6 ? 2 : 1;
      } else {
        // Land
        const dryness = 1 - hHum;

        if (t < 0.18) {
          // rất lạnh
          if (elev > 0.8) {
            b = 13; // alpine snow
          } else {
            b = 11; // tundra
          }
        } else if (t < 0.35) {
          // lạnh / boreal
          if (elev > 0.8) {
            b = 13; // alpine snow
          } else if (elev > 0.6) {
            b = 12; // cold rocky mountain
          } else {
            b = 10; // taiga
          }
        } else if (t > 0.7) {
          // nóng
          if (dryness > 0.75) {
            b = 3; // hot desert
          } else if (dryness > 0.55) {
            b = 4; // semi-arid scrub
          } else if (hHum > 0.8 && r > 0.65) {
            b = 9; // rainforest
          } else if (hHum > 0.55) {
            b = 8; // tropical seasonal forest
          } else {
            b = 5; // savanna
          }
        } else {
          // ôn đới
          if (dryness > 0.7) {
            b = 3; // cold desert / steppe
          } else if (dryness > 0.5) {
            b = 6; // temperate grassland
          } else if (hHum > 0.7) {
            b = 7; // temperate forest
          } else {
            b = 6; // grassland
          }
        }

        // River valley / wetlands ưu tiên nếu river mạnh
        if (riverStrength > 0.45 && elev > shallowSeaLevel) {
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
