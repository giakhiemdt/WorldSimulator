export interface World {
    sim: WorldSimGrid;
    region: RegionGrid;
    local: LocalGrid;
  }
  

export interface WorldSimGrid {
    width: number;
    height: number;
  
    elevation: number[];        // cao độ thô
    temperature: number[];      // nhiệt độ bề mặt
    pressure: number[];         // khí áp
    humidity: number[];         // độ ẩm
    windU: number[];            // vector gió
    windV: number[];
    rainfall: number[];         // lượng mưa
    plateId: number[];          // id mảng kiến tạo
  }
  

export interface RegionGrid {
    width: number;        // coarse.width * 8
    height: number;       // coarse.height * 8
  
    biome: string[];   // forest, desert, tundra, plains...
    moisture: number[];   // kế thừa từ humidity coarse
    heat: number[];       // kế thừa temperature coarse
    elevation: number[];  // nội suy từ coarse
    regionId: number[];   // id các vùng (100-300 cái per continent)
  }
  
export interface LocalGrid {
    width: number;   // region.width * 32
    height: number;  // region.height * 32
    color: number[]; // rgba hoặc int32
    
  }
  