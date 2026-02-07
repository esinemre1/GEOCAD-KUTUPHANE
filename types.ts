
export type Language = 'en' | 'tr';

export interface GeoConfig {
  projection: string;
  originLat: number;
  originLng: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface CADLayer {
  id: string;
  name: string;
  visible: boolean;
  color: string;
  opacity: number;
  rawDxf?: any;
  data: any;
  type: 'dxf' | 'geojson';
  subLayers?: Record<string, boolean>;
  geoConfig: GeoConfig;
}

export interface RecordedPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface SearchResult {
  lat: number;
  lon: number;
  display_name: string;
}

export interface StakeoutData {
  target: RecordedPoint;
  distance: number;
  bearing: number;
}
