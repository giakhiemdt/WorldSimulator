import { generateCoarseGrid, mergeWorldGenConfig } from "./runtimeGenerator.js";

self.onmessage = (event) => {
  const { id, seed, config } = event.data || {};
  try {
    const world = generateCoarseGrid(seed, mergeWorldGenConfig(config));

    // Clone outputs so working buffers inside runtimeGenerator are not detached.
    const elevation = world.elevation.slice();
    const temperature = world.temperature.slice();
    const humidity = world.humidity.slice();
    const rainfall = world.rainfall.slice();
    const biome = world.biome.slice();
    const windU = world.windU.slice();
    const windV = world.windV.slice();
    const river = world.river.slice();

    // Firefox is strict about the transfer list: avoid passing it to stay compatible.
    self.postMessage({
      id,
      width: world.width,
      height: world.height,
      elevation,
      temperature,
      humidity,
      rainfall,
      biome,
      windU,
      windV,
      river,
    });
  } catch (err) {
    self.postMessage({ id, error: err.message || String(err) });
  }
};
