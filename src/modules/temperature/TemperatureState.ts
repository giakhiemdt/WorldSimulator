export interface TemperatureState {
    surface: number[];             // nhiệt độ tại mỗi ô
    cloudCover: number[];          // phần (%) mây che, dùng cho cooling
    solarInsolation: number[];     // lượng bức xạ nhận theo vĩ độ / ngày
    heatFlux: number[];            // truyền nhiệt từ magma (tectonic ảnh hưởng)
  }
  