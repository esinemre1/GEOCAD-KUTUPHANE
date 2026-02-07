
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Layers, Map as MapIcon, Navigation, MapPin, Download, Trash2, Crosshair, Languages, X, AlertCircle, Target, ArrowUp, Compass, ChevronRight, PanelLeftClose, Menu, Ruler, Magnet, Settings2, Grid, Search } from 'lucide-react';

import CADMap from './components/CADMap';
import Sidebar from './components/Sidebar';
import ParcelSearch from './components/ParcelSearch';
import { CADLayer, GeoConfig, RecordedPoint, Language, StakeoutData } from './types';
import proj4 from 'proj4';

const TRANSLATIONS = {
  en: {
    layers: "Layers",
    points: "Points",
    stakeout: "Stakeout",
    drawingContext: "Drawing Context",
    noLayers: "No Layers Active",
    uploadCad: "Upload CAD Data",
    processing: "Processing...",
    startRecording: "Start Recording",
    recordingActive: "Recording Active",
    exportCoord: "Display/Export Coord. System",
    clearAll: "Clear All",
    noPoints: "No points recorded",
    recordedPoints: "Recorded Points",
    recordingModeActive: "Recording Mode Active - Click Map to Place Point",
    locError: "Location Error",
    locErrorHint: "Please enable location services in your browser settings to use this feature.",
    locDenied: "Location permission denied. Please enable it in site settings.",
    confirmClear: "Are you sure you want to clear all points?",
    searchPlaceholder: "Search address or coordinates...",
    goToLocation: "Go to Location",
    myLocation: "My Location",
    startStakeout: "Start Stakeout",
    stopStakeout: "Stop Stakeout",
    targetReached: "Target Reached!",
    distance: "Distance",
    bearing: "Bearing",
    selectToStake: "Select a point to start stakeout",
    measure: "Measure Tool",
    measureActive: "Measure Active",
    snapping: "Point Snapping",
    totalDist: "Total Distance",
    clearMeasure: "Clear Measure"
  },
  tr: {
    layers: "Katmanlar",
    points: "Noktalar",
    stakeout: "Aplikasyon",
    search: "Parsel Sorgu",
    drawingContext: "Çizim Bağlamı",
    noLayers: "Aktif Katman Yok",
    uploadCad: "CAD Verisi Yükle",
    processing: "İşleniyor...",
    startRecording: "Kaydı Başlat",
    recordingActive: "Kayıt Aktif",
    exportCoord: "Görüntüleme/Çıktı Koor. Sistemi",
    clearAll: "Tümünü Temizle",
    noPoints: "Nokta kaydedilmedi",
    recordedPoints: "Kaydedilen Noktalar",
    recordingModeActive: "Kayıt Modu Aktif - Nokta Atmak İçin Haritaya Tıklayın",
    locError: "Konum Hatası",
    locErrorHint: "Bu özelliği kullanmak için tarayıcı ayarlarından konum izni vermeniz gerekmektedir.",
    locDenied: "Konum izni reddedildi. Lütfen site ayarlarından izin verin.",
    confirmClear: "Tüm noktaları silmek istediğinize emin misiniz?",
    searchPlaceholder: "Adres veya koordinat ara...",
    goToLocation: "Konuma Git",
    myLocation: "Konumum",
    startStakeout: "Aplikasyona Başla",
    stopStakeout: "Aplikasyonu Bitir",
    targetReached: "Hedefe Varildi!",
    distance: "Mesafe",
    bearing: "Semt",
    selectToStake: "Aplikasyon için bir nokta seçin",
    measure: "Ölçüm Aracı",
    measureActive: "Ölçüm Aktif",
    snapping: "Nokta Yakalama",
    totalDist: "Toplam Mesafe",
    clearMeasure: "Ölçümü Temizle"
  }
};

const EXPORT_PROJECTIONS: Record<string, { name: string, def: string }> = {
  'ITRF95_33': { name: 'ITRF95 / TM33', def: '+proj=tmerc +lat_0=0 +lon_0=33 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs' },
  'ITRF95_30': { name: 'ITRF95 / TM30', def: '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs' },
  'ED50_33': { name: 'ED50 / TM33', def: '+proj=tmerc +lat_0=0 +lon_0=33 +k=1 +x_0=500000 +y_0=0 +ellps=intl +towgs84=-84,-107,-120,0,0,0,0 +units=m +no_defs' },
  'ED50_30': { name: 'ED50 / TM30', def: '+proj=tmerc +lat_0=0 +lon_0=30 +k=1 +x_0=500000 +y_0=0 +ellps=intl +towgs84=-84,-107,-120,0,0,0,0 +units=m +no_defs' },
  'WGS84': { name: 'WGS84 (Lat/Lng)', def: '+proj=longlat +datum=WGS84 +no_defs' }
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
};

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('tr');
  const [layers, setLayers] = useState<CADLayer[]>([]);
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [activeTab, setActiveTab] = useState<'layers' | 'points' | 'stakeout' | 'search'>('layers');
  const [zoomTargetId, setZoomTargetId] = useState<string | null>(null);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [locErrorStatus, setLocErrorStatus] = useState<string | null>(null);

  const [isPointModeActive, setIsPointModeActive] = useState(false);
  const [isMeasureModeActive, setIsMeasureModeActive] = useState(false);
  const [isSnappingActive, setIsSnappingActive] = useState(true);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);

  const [recordedPoints, setRecordedPoints] = useState<RecordedPoint[]>([]);
  const [exportProj, setExportProj] = useState('ITRF95_33');

  const [stakeoutTarget, setStakeoutTarget] = useState<RecordedPoint | null>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [isTkgmActive, setIsTkgmActive] = useState(false);

  const t = useMemo(() => TRANSLATIONS[lang], [lang]);

  useEffect(() => {
    if (locErrorStatus) {
      const timer = setTimeout(() => setLocErrorStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [locErrorStatus]);

  const handleAddLayer = useCallback((newLayer: CADLayer) => {
    setLayers(prev => [...prev, newLayer]);
  }, []);

  const toggleLayerVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const toggleSubLayerVisibility = (layerId: string, subLayerName: string) => {
    setLayers(prev => prev.map(l => {
      if (l.id === layerId && l.subLayers) {
        return { ...l, subLayers: { ...l.subLayers, [subLayerName]: !l.subLayers[subLayerName] } };
      }
      return l;
    }));
  };

  const updateLayerGeoConfig = (id: string, config: Partial<GeoConfig>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, geoConfig: { ...l.geoConfig, ...config } } : l));
  };

  const updateLayerData = (id: string, newData: any) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, data: newData } : l));
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
  };

  const updateLayerOpacity = (id: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  };

  const handleZoomToLayer = (id: string) => {
    setZoomTargetId(id);
    setTimeout(() => setZoomTargetId(null), 100);
  };

  const handleLocationError = useCallback((message: string) => {
    setIsLocationEnabled(false);
    const cleanMessage = message.replace(/^(Geolocation error: )+/i, '');
    if (cleanMessage.toLowerCase().includes("denied") || cleanMessage.toLowerCase().includes("permission")) {
      setLocErrorStatus(t.locDenied);
    } else {
      setLocErrorStatus(`${t.locError}: ${cleanMessage}`);
    }
  }, [t]);

  const handleLocationUpdate = useCallback((lat: number, lng: number) => {
    setCurrentLocation([lat, lng]);
  }, []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isMeasureModeActive) {
      setMeasurePoints(prev => [...prev, [lat, lng]]);
      return;
    }

    if (!isPointModeActive) return;

    const newPoint: RecordedPoint = {
      id: Math.random().toString(36).substr(2, 9),
      name: `P-${recordedPoints.length + 1}`,
      lat,
      lng
    };
    setRecordedPoints(prev => [...prev, newPoint]);
  }, [isPointModeActive, isMeasureModeActive, recordedPoints.length]);

  const removePoint = (id: string) => {
    if (stakeoutTarget?.id === id) setStakeoutTarget(null);
    setRecordedPoints(prev => prev.filter(p => p.id !== id));
  };

  const clearPoints = () => {
    if (confirm(t.confirmClear)) {
      setRecordedPoints([]);
      setStakeoutTarget(null);
    }
  };

  const startStakeout = (point: RecordedPoint) => {
    setStakeoutTarget(point);
    setIsLocationEnabled(true);
    setActiveTab('stakeout');
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  const transformCoords = useCallback((lat: number, lng: number) => {
    const projDef = EXPORT_PROJECTIONS[exportProj].def;
    if (exportProj === 'WGS84') {
      return { x: lng, y: lat };
    }
    try {
      const result = proj4('EPSG:4326', projDef, [lng, lat]);
      return { x: result[0], y: result[1] };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }, [exportProj]);

  const stakeoutData = useMemo((): StakeoutData | null => {
    if (!stakeoutTarget || !currentLocation) return null;
    const dist = calculateDistance(currentLocation[0], currentLocation[1], stakeoutTarget.lat, stakeoutTarget.lng);
    const bear = calculateBearing(currentLocation[0], currentLocation[1], stakeoutTarget.lat, stakeoutTarget.lng);
    return { target: stakeoutTarget, distance: dist, bearing: bear };
  }, [stakeoutTarget, currentLocation]);

  const totalMeasureDistance = useMemo(() => {
    let total = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
      total += calculateDistance(measurePoints[i][0], measurePoints[i][1], measurePoints[i + 1][0], measurePoints[i + 1][1]);
    }
    return total;
  }, [measurePoints]);

  const exportAsTxt = () => {
    if (recordedPoints.length === 0) return;
    const lines = recordedPoints.map(p => {
      const coords = transformCoords(p.lat, p.lng);
      return `${p.name}  ${coords.x.toFixed(3)}  ${coords.y.toFixed(3)}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `points_${exportProj}.txt`;
    a.click();
  };

  const exportAsDxf = () => {
    if (recordedPoints.length === 0) return;
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
    recordedPoints.forEach(p => {
      const coords = transformCoords(p.lat, p.lng);
      dxf += `0\nPOINT\n8\nRECORDED_POINTS\n10\n${coords.x}\n20\n${coords.y}\n30\n0.0\n`;
      dxf += `0\nTEXT\n8\nPOINT_NAMES\n10\n${coords.x + 0.5}\n20\n${coords.y + 0.5}\n30\n0.0\n40\n1.0\n1\n${p.name}\n`;
    });
    dxf += "0\nENDSEC\n0\nEOF";
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `points_${exportProj}.dxf`;
    a.click();
  };

  const handleParcelFound = (geojson: any) => {
    const newLayer: CADLayer = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Parsel Sorgu ${new Date().toLocaleTimeString()}`,
      visible: true,
      color: '#ef4444',
      opacity: 1,
      data: geojson,
      type: 'geojson',
      geoConfig: { projection: 'local', originLat: 0, originLng: 0, offsetX: 0, offsetY: 0, scale: 1, rotation: 0 }
    };
    setLayers(prev => [...prev, newLayer]);
    setZoomTargetId(newLayer.id);
    setTimeout(() => setZoomTargetId(null), 100);
    setActiveTab('layers');
  };

  const handleExportLayerDxf = (id: string) => {
    const layer = layers.find(l => l.id === id);
    if (!layer || layer.type !== 'geojson' || !layer.data) return;

    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

    // Determine Projection based on Longitude
    // Default logic: Find centroid, determine Zone (27,30,33,36,39,42,45)
    // Formula: Round(Lon / 3) * 3
    const features = layer.data.features || [];
    let totalLon = 0, count = 0;

    // Quick centroid
    features.forEach((f: any) => {
      if (f.geometry?.coordinates?.[0]?.[0]) {
        // Polygon
        totalLon += f.geometry.coordinates[0][0][0];
        count++;
      }
    });

    const avgLon = count > 0 ? totalLon / count : 33;
    const zone = Math.round(avgLon / 3) * 3;
    const projDef = `+proj=tmerc +lat_0=0 +lon_0=${zone} +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs`;

    console.log(`Exporting Layer to ITRF96 TM${zone}`);

    features.forEach((f: any) => {
      if (f.geometry.type === 'Polygon') {
        const coords = f.geometry.coordinates[0];
        dxf += "0\nLWPOLYLINE\n8\nPARSEL\n90\n" + coords.length + "\n70\n1\n";
        coords.forEach((c: any) => {
          const p = proj4('EPSG:4326', projDef, c);
          dxf += `10\n${p[0].toFixed(3)}\n20\n${p[1].toFixed(3)}\n`;
        });
      }
    });

    dxf += "0\nENDSEC\n0\nEOF";
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${layer.name.replace(/[^a-z0-9]/gi, '_')}_TM${zone}.dxf`;
    a.click();
  };

  return (
    <div className="flex h-screen w-screen bg-gray-900 overflow-hidden font-sans">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2500] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed md:relative z-[3000] md:z-10 h-full transition-all duration-300 ease-in-out border-r border-gray-800 bg-gray-950 flex flex-col shadow-2xl md:shadow-none ${isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full md:translate-x-0 md:w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center whitespace-nowrap">
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <div className="flex items-center gap-2">
              <MapIcon className="text-blue-500 w-5 h-5 shrink-0" />
              <h1 className="font-black text-sm tracking-tight uppercase text-white">DXFVIEWER</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
              className="flex items-center justify-center p-1.5 bg-gray-900 border border-gray-800 rounded-lg text-[10px] font-black text-gray-400 hover:text-white hover:border-blue-500/50 transition-all uppercase"
            >
              <Languages size={14} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-400 hover:text-red-500 transition-all"
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-800">
          <button onClick={() => setActiveTab('layers')} title={t.layers} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${activeTab === 'layers' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-400/5' : 'text-gray-500 hover:text-gray-300'}`}>
            <Layers size={14} />
          </button>
          <button onClick={() => setActiveTab('search')} title={t.search} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${activeTab === 'search' ? 'text-orange-400 border-b-2 border-orange-400 bg-orange-400/5' : 'text-gray-500 hover:text-gray-300'}`}>
            <Search size={14} />
          </button>
          <button onClick={() => setActiveTab('points')} title={t.points} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${activeTab === 'points' ? 'text-green-400 border-b-2 border-green-400 bg-green-400/5' : 'text-gray-500 hover:text-gray-300'}`}>
            <MapPin size={14} />
          </button>
          <button onClick={() => setActiveTab('stakeout')} title={t.stakeout} className={`flex-1 py-3 text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-colors ${activeTab === 'stakeout' ? 'text-red-400 border-b-2 border-red-400 bg-red-400/5' : 'text-gray-500 hover:text-gray-300'}`}>
            <Target size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === 'layers' && (
            <Sidebar
              layers={layers}
              onAddLayer={handleAddLayer}
              onToggleVisibility={toggleLayerVisibility}
              onToggleSubLayer={toggleSubLayerVisibility}
              onUpdateGeoConfig={updateLayerGeoConfig}
              onUpdateLayerData={updateLayerData}
              onRemoveLayer={removeLayer}
              onUpdateOpacity={updateLayerOpacity}
              onZoomToLayer={handleZoomToLayer}
              onExportLayer={handleExportLayerDxf}
              lang={lang}
            />
          )}

          {activeTab === 'search' && (
            <ParcelSearch onParcelFound={handleParcelFound} lang={lang} />
          )}

          {activeTab === 'points' && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">{t.exportCoord}</label>
                  <select
                    value={exportProj}
                    onChange={(e) => setExportProj(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:border-blue-500 outline-none"
                  >
                    {Object.entries(EXPORT_PROJECTIONS).map(([id, p]) => (
                      <option key={id} value={id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800">
                  <button disabled={recordedPoints.length === 0} onClick={exportAsTxt} className="flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 rounded text-[10px] font-bold uppercase transition-colors">
                    <Download size={12} /> TXT
                  </button>
                  <button disabled={recordedPoints.length === 0} onClick={exportAsDxf} className="flex items-center justify-center gap-2 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 rounded text-[10px] font-bold uppercase transition-colors">
                    <Download size={12} /> DXF
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t.recordedPoints} ({recordedPoints.length})</span>
                  {recordedPoints.length > 0 && (
                    <button onClick={clearPoints} className="text-[9px] font-bold text-red-500 hover:text-red-400 uppercase">{t.clearAll}</button>
                  )}
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {recordedPoints.map((p, idx) => {
                    const coords = transformCoords(p.lat, p.lng);
                    return (
                      <div key={p.id} className="group bg-gray-900/40 border border-gray-800/50 rounded-lg p-2 flex items-center justify-between hover:border-gray-600 transition-colors">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-[10px] text-gray-600 font-mono">{(idx + 1).toString().padStart(2, '0')}</span>
                          <div className="overflow-hidden">
                            <div className="text-[11px] font-bold text-gray-300 truncate">{p.name}</div>
                            <div className="text-[9px] text-gray-500 font-mono truncate">
                              {exportProj === 'WGS84' ? `${coords.y.toFixed(6)}, ${coords.x.toFixed(6)}` : `${coords.x.toFixed(3)}, ${coords.y.toFixed(3)}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startStakeout(p)} className="p-1.5 text-gray-400 hover:text-red-400"><Target size={14} /></button>
                          <button onClick={() => removePoint(p.id)} className="p-1.5 text-gray-600 hover:text-red-400"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    );
                  })}
                  {recordedPoints.length === 0 && (
                    <div className="text-center py-8 text-gray-700 text-[10px] font-bold uppercase tracking-widest border border-dashed border-gray-800 rounded-xl">{t.noPoints}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stakeout' && (
            <div className="space-y-6">
              {stakeoutTarget ? (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Aktif Aplikasyon</span>
                    <button onClick={() => setStakeoutTarget(null)} className="text-gray-400 hover:text-red-400 transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500 rounded-lg">
                        <Target className="text-white" size={20} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-lg font-black text-white leading-tight truncate">{stakeoutTarget.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">
                          {(() => {
                            const c = transformCoords(stakeoutTarget.lat, stakeoutTarget.lng);
                            return exportProj === 'WGS84' ? `${c.y.toFixed(6)}, ${c.x.toFixed(6)}` : `${c.x.toFixed(3)}, ${c.y.toFixed(3)}`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {stakeoutData && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-gray-950 border border-gray-800 rounded-lg">
                          <div className="text-[8px] font-black text-gray-600 uppercase mb-1">{t.distance}</div>
                          <div className="text-xs font-bold text-white tabular-nums">{stakeoutData.distance.toFixed(2)} m</div>
                        </div>
                        <div className="p-2 bg-gray-950 border border-gray-800 rounded-lg">
                          <div className="text-[8px] font-black text-gray-600 uppercase mb-1">{t.bearing}</div>
                          <div className="text-xs font-bold text-white tabular-nums">{stakeoutData.bearing.toFixed(1)}°</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-gray-800 rounded-2xl opacity-40">
                  <Target size={32} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 leading-relaxed">{t.selectToStake}</p>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest px-1">Seçilebilir Noktalar</span>
                <div className="space-y-2">
                  {recordedPoints.map((p) => {
                    const c = transformCoords(p.lat, p.lng);
                    return (
                      <button
                        key={p.id}
                        onClick={() => startStakeout(p)}
                        className={`w-full group text-left p-3 rounded-xl border transition-all flex items-center justify-between ${stakeoutTarget?.id === p.id ? 'bg-green-500 border-green-400 shadow-lg shadow-green-500/20' : 'bg-gray-900/40 border-gray-800 hover:border-gray-600'}`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={`p-1.5 rounded-lg shrink-0 ${stakeoutTarget?.id === p.id ? 'bg-white/20' : 'bg-gray-800 group-hover:bg-gray-700'}`}>
                            <MapPin size={14} className={stakeoutTarget?.id === p.id ? 'text-white' : 'text-gray-400'} />
                          </div>
                          <div className="overflow-hidden">
                            <div className={`text-[11px] font-black uppercase tracking-tight truncate ${stakeoutTarget?.id === p.id ? 'text-white' : 'text-gray-300'}`}>{p.name}</div>
                            <div className={`text-[9px] font-mono truncate ${stakeoutTarget?.id === p.id ? 'text-green-100' : 'text-gray-500'}`}>
                              {exportProj === 'WGS84' ? `${c.y.toFixed(6)}, ${c.x.toFixed(6)}` : `${c.x.toFixed(3)}, ${c.y.toFixed(3)}`}
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={16} className={`shrink-0 ${stakeoutTarget?.id === p.id ? 'text-white animate-pulse' : 'text-gray-700'}`} />
                      </button>
                    );
                  })}
                  {recordedPoints.length === 0 && (
                    <div className="text-center py-12 text-[10px] font-black uppercase tracking-tighter text-gray-700">Lütfen Önce Nokta Atın</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Map View */}
      <div className="flex-1 relative overflow-hidden">
        {/* Stakeout HUD Overlay */}
        {stakeoutData && (
          <div className="absolute top-[88px] md:top-20 left-1/2 -translate-x-1/2 z-[2000] w-[92%] max-w-md pointer-events-none">
            <div className="bg-gray-950/90 backdrop-blur-xl border border-green-500/30 rounded-2xl p-3 md:p-4 shadow-2xl pointer-events-auto flex items-center justify-between ring-1 ring-white/10">
              <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-gray-800 flex items-center justify-center bg-gray-900 shadow-inner">
                    <ArrowUp
                      size={24}
                      className="text-green-400 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)] md:w-[28px] md:h-[28px]"
                      style={{ transform: `rotate(${stakeoutData.bearing}deg)` }}
                    />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Compass size={14} className="text-gray-600 animate-spin-slow md:w-[16px] md:h-[16px]" />
                  </div>
                </div>

                <div className="space-y-0.5 md:space-y-1 overflow-hidden">
                  <div className="text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest truncate">{stakeoutData.target.name}</div>
                  <div className={`text-2xl md:text-3xl font-black tabular-nums tracking-tighter ${stakeoutData.distance < 1 ? 'text-green-400 animate-pulse' : 'text-white'}`}>
                    {stakeoutData.distance < 1000 ? `${stakeoutData.distance.toFixed(2)} m` : `${(stakeoutData.distance / 1000).toFixed(2)} km`}
                  </div>
                  <div className="text-[9px] md:text-[10px] font-mono text-gray-400 uppercase flex gap-2 md:gap-3 overflow-hidden">
                    <span className="bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800 shrink-0">{stakeoutData.bearing.toFixed(1)}°</span>
                    {stakeoutData.distance < 1 && <span className="text-green-500 font-bold animate-bounce shrink-0">✓ {t.targetReached}</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStakeoutTarget(null)}
                className="p-2 md:p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-lg border border-red-500/20 shrink-0"
              >
                <X size={18} md:size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Measure HUD Overlay */}
        {isMeasureModeActive && measurePoints.length > 0 && (
          <div className="absolute top-[88px] md:top-20 left-1/2 -translate-x-1/2 z-[2000] w-[92%] max-w-sm pointer-events-none">
            <div className="bg-blue-950/90 backdrop-blur-xl border border-blue-500/30 rounded-2xl p-4 shadow-2xl pointer-events-auto flex flex-col gap-3 ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="text-blue-400" size={16} />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{t.totalDist}</span>
                </div>
                <button onClick={() => setMeasurePoints([])} className="text-[9px] font-bold text-gray-500 hover:text-white uppercase">{t.clearMeasure}</button>
              </div>
              <div className="text-3xl font-black text-white tabular-nums tracking-tighter">
                {totalMeasureDistance < 1000 ? `${totalMeasureDistance.toFixed(2)} m` : `${(totalMeasureDistance / 1000).toFixed(3)} km`}
              </div>
              <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                {measurePoints.length} {t.points}
              </div>
            </div>
          </div>
        )}

        {/* Top-Left Toggle Overlay */}
        <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
          {!isSidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 bg-gray-950/90 backdrop-blur-xl border border-gray-800/80 rounded-xl text-gray-300 hover:text-white hover:border-blue-500/50 transition-all shadow-2xl pointer-events-auto ring-1 ring-white/5 active:scale-95 group"
            >
              <Menu size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          )}
        </div>

        {/* FLOATING TOOLS MENU (Bottom-Right) */}
        <div className="absolute bottom-[100px] right-3 z-[1000] flex flex-col gap-3 pointer-events-none items-end">
          <div className="flex flex-col gap-2 p-1.5 bg-gray-950/80 backdrop-blur-2xl border border-gray-800/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5 pointer-events-auto overflow-hidden">
            {/* RECORD POINT */}
            <button
              onClick={() => {
                setIsPointModeActive(!isPointModeActive);
                setIsMeasureModeActive(false);
              }}
              className={`p-3 rounded-xl transition-all duration-300 flex items-center justify-center group ${isPointModeActive ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse-slow' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              title={t.startRecording}
            >
              <Crosshair size={22} className={isPointModeActive ? 'scale-110' : 'group-hover:rotate-12'} />
            </button>

            {/* DIVIDER */}
            <div className="h-px w-8 bg-gray-800 mx-auto opacity-50" />

            {/* MEASURE TOOL */}
            <button
              onClick={() => {
                setIsMeasureModeActive(!isMeasureModeActive);
                setIsPointModeActive(false);
                if (!isMeasureModeActive) setMeasurePoints([]);
              }}
              className={`p-3 rounded-xl transition-all duration-300 flex items-center justify-center group ${isMeasureModeActive ? 'bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              title={t.measure}
            >
              <Ruler size={22} className={isMeasureModeActive ? 'scale-110' : 'group-hover:-rotate-12'} />
            </button>

            {/* SNAPPING (Contextual smaller button) */}
            <button
              onClick={() => setIsSnappingActive(!isSnappingActive)}
              className={`p-2 rounded-lg transition-all mx-1.5 duration-200 border ${isSnappingActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-transparent border-transparent text-gray-600 hover:text-gray-400'}`}
              title={t.snapping}
            >
              <Magnet size={14} className={isSnappingActive ? 'animate-pulse' : ''} />
            </button>

            {/* DIVIDER */}
            <div className="h-px w-8 bg-gray-800 mx-auto opacity-50" />

            {/* TKGM TOGGLE */}
            <button
              onClick={() => setIsTkgmActive(!isTkgmActive)}
              className={`p-3 rounded-xl transition-all duration-300 flex items-center justify-center group ${isTkgmActive ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              title="TKGM Parsel (WMS)"
            >
              <Grid size={22} className={isTkgmActive ? 'animate-pulse' : ''} />
            </button>

            {/* DIVIDER */}
            <div className="h-px w-8 bg-gray-800 mx-auto opacity-50" />

            {/* LOCATION */}
            <button
              onClick={() => {
                setLocErrorStatus(null);
                setIsLocationEnabled(!isLocationEnabled);
              }}
              className={`p-3 rounded-xl transition-all duration-300 flex items-center justify-center group ${isLocationEnabled ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]' : locErrorStatus ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              title={t.myLocation}
            >
              <Navigation size={22} className={`${isLocationEnabled ? 'animate-pulse' : 'group-hover:-translate-y-0.5 group-hover:translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Global Error Notifications (Top-Right) */}
        <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
          {locErrorStatus && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-950/90 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-red-500/30 animate-in fade-in slide-in-from-top-4 duration-500 select-none max-w-xs pointer-events-auto ring-1 ring-red-500/20">
              <div className="bg-red-500 p-1.5 rounded-lg shrink-0 shadow-lg shadow-red-500/20">
                <AlertCircle size={16} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-widest text-red-300">Sistem Hatası</span>
                <span className="text-[10px] font-bold tracking-tight leading-tight">{locErrorStatus}</span>
              </div>
              <button onClick={() => setLocErrorStatus(null)} className="ml-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X size={14} className="text-red-300" />
              </button>
            </div>
          )}
        </div>

        {/* Mode Active Badge (Bottom-Center) */}
        {(isPointModeActive || isMeasureModeActive) && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] px-5 py-2.5 bg-gray-950/90 backdrop-blur-xl text-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 border border-gray-800/80 animate-in fade-in slide-in-from-bottom-8 duration-500 select-none ring-1 ring-white/10 group cursor-default">
            <div className={`w-2 h-2 rounded-full animate-ping ${isPointModeActive ? 'bg-red-500' : 'bg-blue-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
              {isPointModeActive ? t.recordingModeActive : t.measureActive}
            </span>
            <button onClick={() => { setIsPointModeActive(false); setIsMeasureModeActive(false); }} className="p-1 hover:bg-white/10 rounded-lg transition-colors ml-1">
              <X size={14} className="text-gray-500" />
            </button>
          </div>
        )}

        <CADMap
          layers={layers}
          zoomTargetId={zoomTargetId}
          isLocationEnabled={isLocationEnabled}
          onLocationError={handleLocationError}
          onLocationUpdate={handleLocationUpdate}
          onMapClick={handleMapClick}
          recordedPoints={recordedPoints}
          stakeoutTarget={stakeoutTarget}
          isMeasureModeActive={isMeasureModeActive}
          measurePoints={measurePoints}
          isSnappingActive={isSnappingActive}
          showTkgmLayer={isTkgmActive}
        />
      </div>
    </div>
  );
};

export default App;
