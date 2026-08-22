// Accurate Cartesian Grid Matrix for Australia Map
// 9px squares with 2px gap (Pitch: 11px)

export interface GridSquare {
  x: number; // SVG coordinate
  y: number; // SVG coordinate
  type: 'coast' | 'ocean_1' | 'ocean_2' | 'ocean_3' | 'ocean_4' | 'interior';
  opacity: number;
}

// Normalized coordinate polygons (0 to 100 in X and Y)
// SVG viewBox: 0 0 1100 825 (aspect ratio 4:3)
const MAINLAND_POLYGON: [number, number][] = [
  // Top End / Darwin / Van Diemen Gulf
  [43.0, 16.0],
  [44.5, 14.0],
  [46.5, 14.0],
  [48.5, 15.0],
  // Arnhem Land & Gove
  [51.0, 15.5],
  [53.5, 16.5],
  [55.5, 19.0],
  // Gulf of Carpentaria (West Coast)
  [55.0, 23.0],
  [54.0, 27.0],
  [55.5, 31.0],
  // Gulf of Carpentaria (South)
  [58.5, 31.5],
  [61.5, 30.5],
  // Gulf of Carpentaria (East Coast) up Cape York
  [63.5, 27.0],
  [65.0, 21.5],
  [66.5, 16.0],
  [67.8, 11.5],
  // Tip of Cape York
  [68.5, 9.0],
  [69.5, 11.0],
  // North QLD / Cairns
  [71.5, 16.5],
  [73.5, 22.0],
  [75.5, 27.5],
  // Townsville / Mackay / Great Barrier Reef Coast
  [78.0, 32.5],
  [80.5, 37.0],
  // Rockhampton / Gladstone / Hervey Bay
  [83.0, 41.5],
  [84.5, 45.5],
  // Sunshine Coast / Brisbane
  [86.0, 49.5],
  [86.5, 53.5],
  // Gold Coast / Byron Bay (Easternmost mainland tip)
  [86.2, 57.0],
  // NSW North Coast / Coffs Harbour / Port Macquarie
  [84.5, 61.0],
  // Newcastle / Sydney
  [83.0, 65.0],
  // Wollongong / Jervis Bay / Batemans Bay
  [81.5, 69.5],
  // Eden / Cape Howe
  [79.5, 74.5],
  [78.0, 78.0],
  // Gippsland / Wilson's Promontory (Southernmost mainland tip)
  [75.5, 82.0],
  // Port Phillip Bay / Melbourne
  [72.5, 79.5],
  // Cape Otway / Shipwreck Coast
  [69.5, 81.0],
  // Warrnambool / Portland
  [66.5, 79.5],
  // Discovery Bay / Mount Gambier / Robe
  [64.0, 77.0],
  // Encounter Bay / Fleurieu Peninsula
  [62.5, 74.5],
  // Gulf St Vincent / Adelaide
  [61.2, 72.5],
  // Yorke Peninsula
  [60.0, 74.0],
  // Spencer Gulf / Port Augusta
  [59.5, 70.0],
  // Eyre Peninsula / Port Lincoln
  [57.5, 74.0],
  // Ceduna / Great Australian Bight
  [54.0, 71.5],
  [48.0, 72.0],
  [42.0, 72.5],
  [36.0, 73.0],
  // Esperance / Cape Arid
  [30.5, 74.5],
  // Bremer Bay / Albany
  [24.5, 78.0],
  // Cape Leeuwin (South-West corner)
  [17.5, 80.5],
  // Bunbury / Mandurah
  [17.0, 74.5],
  // Perth / Fremantle
  [16.8, 67.5],
  // Jurien Bay / Geraldton
  [16.0, 61.0],
  // Shark Bay / Steep Point (Westernmost point)
  [13.0, 54.0],
  [12.5, 50.5],
  // Ningaloo / Exmouth (North West Cape)
  [14.0, 43.5],
  [15.5, 41.0],
  // Dampier / Karratha / Port Hedland
  [18.5, 38.0],
  [22.5, 35.5],
  // Eighty Mile Beach
  [26.5, 33.0],
  // Broome / Roebuck Bay
  [29.0, 29.5],
  // Dampier Peninsula / Cape Leveque
  [28.5, 25.5],
  // Derby / King Sound
  [31.0, 27.0],
  // Kimberley Archipelago
  [32.5, 23.0],
  [35.0, 20.0],
  // Cambridge Gulf / Wyndham
  [37.5, 21.5],
  // Joseph Bonaparte Gulf
  [40.0, 20.5],
  // Anson Bay / Darwin approach
  [41.5, 17.5],
];

const TASMANIA_POLYGON: [number, number][] = [
  [71.5, 87.0],
  [74.5, 86.5],
  [77.5, 88.5],
  [78.0, 91.5],
  [77.0, 94.0],
  [75.0, 95.5],
  [73.0, 95.5],
  [71.0, 93.0],
  [70.5, 89.5],
];

function isPointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate Cartesian Grid
export function generateAustraliaGrid(cols = 100, rows = 75, squareSize = 9, gap = 2): {
  squares: GridSquare[];
  cols: number;
  rows: number;
  viewWidth: number;
  viewHeight: number;
} {
  const pitch = squareSize + gap; // 11px
  const viewWidth = cols * pitch; // 1100
  const viewHeight = rows * pitch; // 825

  // 2D grid matrix of booleans: isLand
  const landGrid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let r = 0; r < rows; r++) {
    const py = ((r + 0.5) / rows) * 100;
    for (let c = 0; c < cols; c++) {
      const px = ((c + 0.5) / cols) * 100;
      const inMainland = isPointInPolygon(px, py, MAINLAND_POLYGON);
      const inTasmania = isPointInPolygon(px, py, TASMANIA_POLYGON);
      landGrid[r][c] = inMainland || inTasmania;
    }
  }

  // Identify Coastline cells (land cells with at least one 4-neighbor that is ocean/out-of-bounds)
  const isCoastGrid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const coastCoords: [number, number][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (landGrid[r][c]) {
        let isCoast = false;
        // Check 4-directional neighbors
        const neighbors = [
          [r - 1, c],
          [r + 1, c],
          [r, c - 1],
          [r, c + 1],
        ];

        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || !landGrid[nr][nc]) {
            isCoast = true;
            break;
          }
        }

        if (isCoast) {
          isCoastGrid[r][c] = true;
          coastCoords.push([r, c]);
        }
      }
    }
  }

  // Build the list of active squares
  const squares: GridSquare[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pitch;
      const y = r * pitch;

      if (landGrid[r][c]) {
        if (isCoastGrid[r][c]) {
          // Coastline square: Bright radiant green
          squares.push({
            x,
            y,
            type: 'coast',
            opacity: 1.0,
          });
        } else {
          // Interior square: Keep interior deep black
          squares.push({
            x,
            y,
            type: 'interior',
            opacity: 0.95,
          });
        }
      } else {
        // Ocean square: Calculate Chebyshev distance to nearest coastline cell
        let minDistance = Infinity;

        // Optimized distance check: only examine coast cells nearby
        for (let i = 0; i < coastCoords.length; i++) {
          const [cr, cc] = coastCoords[i];
          const dr = Math.abs(r - cr);
          const dc = Math.abs(c - cc);
          const dist = Math.max(dr, dc); // Chebyshev distance gives neat square wave contours

          if (dist < minDistance) {
            minDistance = dist;
            if (minDistance === 1) break; // Closest possible
          }
        }

        if (minDistance === 1) {
          squares.push({ x, y, type: 'ocean_1', opacity: 0.70 });
        } else if (minDistance === 2) {
          squares.push({ x, y, type: 'ocean_2', opacity: 0.44 });
        } else if (minDistance === 3) {
          squares.push({ x, y, type: 'ocean_3', opacity: 0.22 });
        } else if (minDistance === 4) {
          squares.push({ x, y, type: 'ocean_4', opacity: 0.08 });
        }
        // Distance > 4 is open sea (transparent / empty)
      }
    }
  }

  return { squares, cols, rows, viewWidth, viewHeight };
}

// Pre-computed grid for instant rendering
export const AUSTRALIA_GRID = generateAustraliaGrid(100, 75, 9, 2);
