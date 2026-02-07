
import React, { useRef, useState, useMemo } from 'react';
import { Upload, Trash2, Eye, EyeOff, FileCode, Loader2, Maximize2, ChevronDown, ChevronRight, Sliders, Globe, Locate, Download } from 'lucide-react';
import DxfParser from 'dxf-parser';
import proj4 from 'proj4';
import { CADLayer, GeoConfig, Language } from '../types';

const TRANSLATIONS = {
  en: {
    upload: "Upload CAD Data",
    processing: "Processing...",
    drawingContext: "Drawing Context",
    noLayers: "No Layers Active",
    coordSys: "Coordinate System",
    scale: "Scale",
    rotation: "Rotation",
    offset: "Offset",
    geoSettings: "Georeference Settings",
    itrf30: "ITRF95 / TM30 (Center)",
    itrf33: "ITRF95 / TM33 (East)",
    itrf27: "ITRF95 / TM27 (West)",
    wgs84: "WGS84 (Lat/Lng)",
    webMercator: "Web Mercator",
    local: "Local (Manual Placing)",
    placement: "Placement Settings"
  },
  tr: {
    upload: "CAD Verisi Yükle",
    processing: "İşleniyor...",
    drawingContext: "Çizim Bağlamı",
    noLayers: "Aktif Katman Yok",
    coordSys: "Koordinat Sistemi",
    scale: "Ölçek",
    rotation: "Dönü (°)",
    offset: "Ofset",
    geoSettings: "Jeoreferans Ayarları",
    itrf30: "ITRF95 / TM30 (Merkez)",
    itrf33: "ITRF95 / TM33 (Doğu)",
    itrf27: "ITRF95 / TM27 (Batı)",
    wgs84: "WGS84 (Lat/Lng)",
    webMercator: "Web Mercator",
    local: "Yerel (Manuel Yerleştirme)",
    placement: "Yerleştirme Ayarları"
  }
};

const ACI_TO_HEX: Record<number, string> = {
  0: '#ffffff', 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff',
  5: '#0000ff', 6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0', 256: '#ffffff',
};

const getHexColor = (aci: number | undefined, layerColorACI: number = 7): string => {
  const colorIndex = (aci === undefined || aci === 256) ? layerColorACI : aci;
  return ACI_TO_HEX[colorIndex] || '#3b82f6';
};

const PROJECTIONS = (t: any) => ({
  'EPSG:4326': { name: t.wgs84, def: '+proj=longlat +datum=WGS84 +no_defs' },
  'EPSG:3857': { name: t.webMercator, def: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs' },
  'EPSG:5254': { name: t.itrf30, def: '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs' },
  'EPSG:5255': { name: t.itrf33, def: '+proj=tmerc +lat_0=0 +lon_0=33 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs' },
  'EPSG:5253': { name: t.itrf27, def: '+proj=tmerc +lat_0=0 +lon_0=27 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs' },
  'local': { name: t.local, def: '' }
});

interface SidebarProps {
  layers: CADLayer[];
  onAddLayer: (layer: CADLayer) => void;
  onToggleVisibility: (id: string) => void;
  onToggleSubLayer: (layerId: string, subLayerName: string) => void;
  onUpdateGeoConfig: (id: string, config: Partial<GeoConfig>) => void;
  onUpdateLayerData: (id: string, newData: any) => void;
  onRemoveLayer: (id: string) => void;
  onUpdateOpacity: (id: string, opacity: number) => void;
  onZoomToLayer: (id: string) => void;
  onExportLayer: (id: string) => void;
  lang: Language;
}

const Sidebar: React.FC<SidebarProps> = ({
  layers, onAddLayer, onToggleVisibility, onToggleSubLayer,
  onUpdateGeoConfig, onUpdateLayerData, onRemoveLayer, onUpdateOpacity, onZoomToLayer, onExportLayer, lang
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedGeo, setExpandedGeo] = useState<Record<string, boolean>>({});

  const t = useMemo(() => TRANSLATIONS[lang], [lang]);
  const projections = useMemo(() => PROJECTIONS(t), [t]);

  const dxfToGeoJSON = (dxf: any, config: GeoConfig) => {
    const features: any[] = [];
    const entities = dxf.entities || [];
    const dxfLayers = dxf.tables?.layer?.layers || {};
    const internalLayerData: Record<string, { color: string, visible: boolean }> = {};

    Object.keys(dxfLayers).forEach(name => {
      internalLayerData[name] = { color: getHexColor(dxfLayers[name].color), visible: true };
    });

    const isLocal = config.projection === 'local';
    // Fix: cast projections to avoid 'unknown' property access errors
    const projDef = (projections as Record<string, any>)[config.projection]?.def;

    const transform = (x: number, y: number) => {
      let lx = (x + config.offsetX) * config.scale;
      let ly = (y + config.offsetY) * config.scale;
      if (config.rotation !== 0) {
        const rad = (config.rotation * Math.PI) / 180;
        const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
        const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
        lx = rx; ly = ry;
      }
      if (isLocal) {
        return [config.originLng + (lx / 111320), config.originLat + (ly / 110540)];
      } else {
        try { return proj4(projDef, 'EPSG:4326', [lx, ly]); } catch { return [lx, ly]; }
      }
    };

    entities.forEach((entity: any) => {
      let geometry: any = null;
      const layerName = entity.layer || '0';
      const entityColor = getHexColor(entity.color, dxfLayers[layerName]?.color || 7);
      const props = { layer: layerName, handle: entity.handle, color: entityColor };

      if (entity.type === 'LINE') {
        geometry = { type: 'LineString', coordinates: [transform(entity.vertices[0].x, entity.vertices[0].y), transform(entity.vertices[1].x, entity.vertices[1].y)] };
      } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        if (entity.vertices?.length > 1) geometry = { type: 'LineString', coordinates: entity.vertices.map((v: any) => transform(v.x, v.y)) };
      } else if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
        const coords = [];
        const start = entity.startAngle || 0;
        const end = entity.endAngle || (Math.PI * 2);
        const range = end < start ? (end + Math.PI * 2) - start : end - start;
        for (let i = 0; i <= 32; i++) {
          const angle = start + (i / 32) * range;
          coords.push(transform(entity.position.x + entity.radius * Math.cos(angle), entity.position.y + entity.radius * Math.sin(angle)));
        }
        geometry = { type: 'LineString', coordinates: coords };
      } else if (entity.type === 'POINT') {
        geometry = { type: 'Point', coordinates: transform(entity.position.x, entity.position.y) };
      }
      if (geometry) features.push({ type: 'Feature', geometry, properties: props });
    });

    const subLayers: Record<string, boolean> = {};
    Object.keys(internalLayerData).forEach(name => subLayers[name] = true);
    return { geoJson: { type: 'FeatureCollection', features }, subLayers };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsParsing(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const isDXF = file.name.toLowerCase().endsWith('.dxf');
      try {
        let rawDxf = null, finalData: any, subLayers: any;
        const initialConfig: GeoConfig = { projection: 'local', originLat: 41.0082, originLng: 28.9784, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 };
        if (isDXF) {
          rawDxf = new DxfParser().parseSync(content);
          const result = dxfToGeoJSON(rawDxf, initialConfig);
          finalData = result.geoJson; subLayers = result.subLayers;
        } else {
          finalData = JSON.parse(content);
        }
        onAddLayer({ id: Math.random().toString(36).substr(2, 9), name: file.name, visible: true, color: '#' + Math.floor(Math.random() * 16777215).toString(16), opacity: 1, rawDxf, data: finalData, type: isDXF ? 'dxf' : 'geojson', subLayers, geoConfig: initialConfig });
      } catch (err) {
        alert("Parse Error: " + (err instanceof Error ? err.message : 'Invalid file'));
      } finally { setIsParsing(false); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfigChange = (layer: CADLayer, changes: Partial<GeoConfig>) => {
    const newConfig = { ...layer.geoConfig, ...changes };
    onUpdateGeoConfig(layer.id, changes);
    if (layer.rawDxf) onUpdateLayerData(layer.id, dxfToGeoJSON(layer.rawDxf, newConfig).geoJson);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <label className="block">
          <div onClick={() => !isParsing && fileInputRef.current?.click()} className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-800 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group ${isParsing ? 'cursor-wait opacity-50' : 'cursor-pointer'}`}>
            {isParsing ? <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-2" /> : <Upload className="w-8 h-8 text-gray-600 group-hover:text-blue-400 mb-2" />}
            <p className="text-xs font-bold text-gray-500 group-hover:text-blue-300 uppercase tracking-tighter">{isParsing ? t.processing : t.upload}</p>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".dxf,.json,.geojson" />
        </label>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] px-1 border-b border-gray-800 pb-2">
          <span>{t.drawingContext}</span><span>{layers.length}</span>
        </div>
        {layers.length === 0 ? (
          <div className="text-center py-12 opacity-20 select-none border border-gray-800/50 rounded-xl border-dashed">
            <FileCode className="w-10 h-10 mx-auto mb-3" />
            <p className="text-[10px] font-bold uppercase tracking-widest">{t.noLayers}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {layers.map((layer) => (
              <div key={layer.id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <button onClick={() => setExpandedFolders(p => ({ ...p, [layer.id]: !p[layer.id] }))} className="text-gray-500 hover:text-white">
                        {expandedFolders[layer.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: layer.color }} />
                      <span className="text-[11px] font-bold truncate text-gray-300 uppercase tracking-tight">{layer.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExpandedGeo(p => ({ ...p, [layer.id]: !p[layer.id] }))} className={`p-1.5 rounded-md transition-colors ${expandedGeo[layer.id] ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}><Globe size={14} /></button>
                      <button onClick={() => setExpandedGeo(p => ({ ...p, [layer.id]: !p[layer.id] }))} className={`p-1.5 rounded-md transition-colors ${expandedGeo[layer.id] ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}><Globe size={14} /></button>
                      <button onClick={() => onZoomToLayer(layer.id)} className="p-1.5 hover:bg-blue-500/20 rounded-md text-gray-500 hover:text-blue-400"><Maximize2 size={14} /></button>
                      <button onClick={() => onExportLayer(layer.id)} className="p-1.5 hover:bg-green-500/20 rounded-md text-gray-500 hover:text-green-400" title="DXF İndir"><Download size={14} /></button>
                      <button onClick={() => onToggleVisibility(layer.id)} className="p-1.5 hover:bg-gray-800 rounded-md text-gray-500 hover:text-white">{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button onClick={() => onRemoveLayer(layer.id)} className="p-1.5 hover:bg-red-500/20 rounded-md text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sliders size={10} className="text-gray-600" />
                    <input type="range" min="0" max="1" step="0.1" value={layer.opacity} onChange={(e) => onUpdateOpacity(layer.id, parseFloat(e.target.value))} className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none accent-blue-500" />
                  </div>
                </div>
                {expandedGeo[layer.id] && layer.type === 'dxf' && (
                  <div className="p-3 border-t border-gray-800 bg-gray-950 space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1"><Globe size={10} /> {t.coordSys}</label>
                      <select value={layer.geoConfig.projection} onChange={(e) => handleConfigChange(layer, { projection: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px] text-gray-300 focus:border-blue-500 outline-none">
                        {Object.entries(projections).map(([id, p]: [string, any]) => (<option key={id} value={id}>{p.name}</option>))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">{t.scale}</label>
                        <input type="number" step="0.001" value={layer.geoConfig.scale} onChange={(e) => handleConfigChange(layer, { scale: parseFloat(e.target.value) || 1 })} className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px]" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-gray-500 uppercase">{t.rotation}</label>
                        <input type="number" value={layer.geoConfig.rotation} onChange={(e) => handleConfigChange(layer, { rotation: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px]" />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-gray-800">
                      <label className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1"><Locate size={10} /> {t.placement}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[8px] text-gray-600 block">{t.offset} X (m)</label><input type="number" value={layer.geoConfig.offsetX} onChange={(e) => handleConfigChange(layer, { offsetX: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px]" /></div>
                        <div><label className="text-[8px] text-gray-600 block">{t.offset} Y (m)</label><input type="number" value={layer.geoConfig.offsetY} onChange={(e) => handleConfigChange(layer, { offsetY: parseFloat(e.target.value) || 0 })} className="w-full bg-gray-900 border border-gray-700 rounded p-1 text-[10px]" /></div>
                      </div>
                    </div>
                  </div>
                )}
                {expandedFolders[layer.id] && layer.subLayers && (
                  <div className="border-t border-gray-800 bg-black/40 p-2 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {Object.keys(layer.subLayers).map(subName => (
                      <div key={subName} className="flex items-center justify-between px-2 py-1 hover:bg-gray-800/50 rounded transition-colors group">
                        <span className="text-[10px] text-gray-500 group-hover:text-gray-300 truncate max-w-[150px]">{subName}</span>
                        <button onClick={() => onToggleSubLayer(layer.id, subName)} className={`p-1 rounded ${layer.subLayers![subName] ? 'text-blue-400' : 'text-gray-700'}`}>{layer.subLayers![subName] ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
