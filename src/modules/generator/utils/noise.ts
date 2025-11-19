import Alea from "alea";
import { createNoise2D } from "simplex-noise";

export function createSeededNoise(seed: string) {
  const rng = Alea(seed);
  const noise2D = createNoise2D(rng);
  return noise2D; 
}
