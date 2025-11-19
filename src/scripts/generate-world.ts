import { mkdirSync, writeFileSync } from "fs";
import { generateCoarseGrid } from "../modules/generator/core/generateCoarse";

const cliSeed = process.argv[2];
const randomSeed =
  Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
const seed = cliSeed ?? randomSeed;

const world = generateCoarseGrid(seed);

mkdirSync("data", { recursive: true });

function writeFieldToInt16Bin(
  path: string,
  data: number[],
  range: "0-1" | "-1-1"
) {
  const len = data.length;
  const arr = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let v = data[i] ?? 0;
    if (range === "0-1") {
      if (v < 0) v = 0;
      if (v > 1) v = 1;
      arr[i] = Math.round(v * 32767);
    } else {
      if (v < -1) v = -1;
      if (v > 1) v = 1;
      arr[i] = Math.round(v * 32767);
    }
  }
  const buffer = Buffer.from(arr.buffer);
  writeFileSync(path, buffer);
}

function writeBiomeToBin(path: string, data: number[]) {
  const len = data.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const v = data[i] ?? 0;
    arr[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  writeFileSync(path, Buffer.from(arr.buffer));
}

// 6 file .bin (Int16Array)
writeFieldToInt16Bin("data/elevation.bin", world.elevation, "0-1");
writeFieldToInt16Bin("data/temp.bin", world.temperature, "0-1");
writeFieldToInt16Bin("data/rainfall.bin", world.rainfall, "0-1");
writeFieldToInt16Bin("data/humidity.bin", world.humidity, "0-1");
writeFieldToInt16Bin("data/windU.bin", world.windU, "-1-1");
writeFieldToInt16Bin("data/windV.bin", world.windV, "-1-1");
writeFieldToInt16Bin("data/river.bin", world.river, "0-1");
writeBiomeToBin("data/biome.bin", world.biome);
writeFileSync("data/seed.txt", seed, "utf8");

console.log("World generated with seed:", seed);
