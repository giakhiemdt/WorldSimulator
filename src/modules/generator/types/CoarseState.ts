export interface CoarseGrid { // 1 / 2048 x 1024
    width: number;      // 2048
    height: number;     // 1024
    elevation: number[];     // -1..1
    temperature: number[];   // 0..1
    humidity: number[];      // 0..1
    rainfall: number[];      // 0..1
    biome: number[];         // optional
    windU: number[];         // -1..1, hướng đông (+) / tây (-)
    windV: number[];         // -1..1, hướng bắc (+) / nam (-)
    river: number[];         // 0..1, cường độ sông (flow accumulation)
  }
  
