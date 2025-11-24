import { existsSync, readFileSync } from "fs";
import path from "path";

export interface ContinentConfig {
  /** Ước lượng số lục địa lớn mong muốn, chỉ dùng để scale lại noise */
  count: number;
  /** Bán kính vùng có thể sinh lục địa (0..1 so với map) */
  radius: number;
  /** Tần số noise chính để tạo hình lục địa */
  shapeNoiseFrequency: number;
  /** Tần số noise warp để méo biên */
  warpFrequency: number;
  /** Cường độ warp (0..1, càng cao càng méo) */
  warpStrength: number;
}

export interface ElevationConfig {
  /** Độ cao trung bình mong muốn sau khi chuẩn hóa (0..1) */
  averageHeight: number;
  /** Biên độ nâng núi dọc đứt gãy kiến tạo */
  ridgeStrength: number;
  /** Biên độ hạ thấp ở rift / vực sâu */
  riftStrength: number;
  /** Hệ số nhân boost dành cho vùng núi và đỉnh núi */
  mountainStrength: number;
  /** Số vòng erosion để làm mượt địa hình */
  erosionIterations: number;
  /** Cường độ erosion (0..1) */
  erosionStrength: number;
  /** Số đỉnh núi ngẫu nhiên được gieo thêm */
  peakCount: number;
  /** Bán kính ảnh hưởng của mỗi đỉnh (theo % chiều rộng bản đồ) */
  peakRadius: number;
  /** Mũ falloff cho đỉnh núi (càng cao càng nhọn) */
  peakSharpness: number;
  /** Biên độ boost của đỉnh, nhân với mountainStrength */
  peakStrength: number;
}

export interface BiomeConfig {
  /** Điều chỉnh độ rộng vùng nhiệt đới / ôn đới theo vĩ độ */
  latitudinalSoftness: number;
  /** Trọng số noise trong tính toán nhiệt độ (0..1) */
  temperatureNoiseWeight: number;
  /** Điều chỉnh độ rộng các biome khô (mũ dùng cho dryness) */
  humidityWidth: number;
  temperatureBands: {
    polar: number;
    boreal: number;
    tropical: number;
  };
  humidityBands: {
    desert: number;
    scrub: number;
    savanna: number;
    forest: number;
    rainforest: number;
  };
  mountain: {
    range: number;
    highPeak: number;
    snow: number;
  };
  wetlandRiverThreshold: number;
}

export interface WorldGenConfig {
  continents: ContinentConfig;
  elevation: ElevationConfig;
  biomes: BiomeConfig;
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown>
    ? DeepPartial<T[K]>
    : T[K];
};

export type WorldGenConfigInput = DeepPartial<WorldGenConfig>;

export const baseWorldGenConfig: WorldGenConfig = {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      out[key] = clone(value[key]);
    }
    return out as T;
  }
  return value;
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return clone(base);
  }

  if (!isPlainObject(base)) {
    return (override as T | undefined) ?? clone(base);
  }

  const result: Record<string, unknown> = {};
  const baseKeys = new Set([
    ...Object.keys(base as Record<string, unknown>),
    ...Object.keys(override as Record<string, unknown>),
  ]);

  for (const key of baseKeys) {
    const baseValue = (base as Record<string, unknown>)[key];
    const overrideValue = (override as Record<string, unknown>)[key];

    if (overrideValue === undefined) {
      result[key] = clone(baseValue);
    } else if (
      isPlainObject(baseValue) &&
      isPlainObject(overrideValue)
    ) {
      result[key] = deepMerge(baseValue, overrideValue);
    } else {
      result[key] = overrideValue as unknown;
    }
  }

  return result as T;
}

export function mergeWorldGenConfig(
  override?: WorldGenConfigInput
): WorldGenConfig {
  return deepMerge(baseWorldGenConfig, override);
}

export function loadWorldGenConfigFromFile(
  configPath?: string
): WorldGenConfig {
  const target = configPath
    ? path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath)
    : path.resolve(process.cwd(), "world-config.json");

  if (!existsSync(target)) {
    return mergeWorldGenConfig();
  }

  const raw = readFileSync(target, "utf8");
  const parsed = JSON.parse(raw) as WorldGenConfigInput;
  return mergeWorldGenConfig(parsed);
}
