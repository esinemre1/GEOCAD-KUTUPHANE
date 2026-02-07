
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CADLayer, RecordedPoint } from '../types';

interface CADMapProps {
  layers: CADLayer[];
  zoomTargetId: string | null;
  isLocationEnabled: boolean;
  onLocationError?: (message: string) => void;
  onLocationUpdate?: (lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  recordedPoints: RecordedPoint[];
  stakeoutTarget?: RecordedPoint | null;
  isMeasureModeActive?: boolean;
  measurePoints?: [number, number][];

  isSnappingActive?: boolean;
  showTkgmLayer?: boolean;
}


const CADMap: React.FC<CADMapProps> = ({
  layers,
  zoomTargetId,
  isLocationEnabled,
  onLocationError,
  onLocationUpdate,
  onMapClick,
  recordedPoints,
  stakeoutTarget,
  isMeasureModeActive,
  measurePoints = [],

  isSnappingActive = true,
  showTkgmLayer = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupsRef = useRef<Record<string, L.LayerGroup>>({});
  const locationMarkerRef = useRef<L.CircleMarker | null>(null);
  const recordedPointsGroupRef = useRef<L.LayerGroup | null>(null);
  const stakeoutLineRef = useRef<L.Polyline | null>(null);
  const stakeoutMarkerRef = useRef<L.CircleMarker | null>(null);
  const measureLineRef = useRef<L.Polyline | null>(null);
  const measurePointsRef = useRef<L.CircleMarker[]>([]);
  const tkgmLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const featureInfoPopupRef = useRef<L.Popup | null>(null);

  const onMapClickRef = useRef(onMapClick);
  const recordedPointsRef = useRef(recordedPoints);
  const isSnappingActiveRef = useRef(isSnappingActive);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
    recordedPointsRef.current = recordedPoints;
    isSnappingActiveRef.current = isSnappingActive;
  }, [onMapClick, recordedPoints, isSnappingActive]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [41.0082, 28.9784],
      zoom: 13,
      zoomControl: false,
      attributionControl: false, // Hides Leaflet link
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    map.on('click', (e) => {
      let lat = e.latlng.lat;
      let lng = e.latlng.lng;

      // Snapping logic
      if (isSnappingActiveRef.current && recordedPointsRef.current.length > 0) {
        const threshold = 15; // pixels
        let minDist = Infinity;
        let nearest: [number, number] | null = null;

        recordedPointsRef.current.forEach(p => {
          const pointPx = map.latLngToLayerPoint([p.lat, p.lng]);
          const clickPx = map.latLngToLayerPoint(e.latlng);
          const d = pointPx.distanceTo(clickPx);
          if (d < threshold && d < minDist) {
            minDist = d;
            nearest = [p.lat, p.lng];
          }
        });

        if (nearest) {
          lat = nearest[0];
          lng = nearest[1];
        }
      }

      if (onMapClickRef.current) onMapClickRef.current(lat, lng);

      // TKGM Feature Info Check
      if (showTkgmLayer && map.getZoom() >= 15) {
        const size = map.getSize();
        const bounds = map.getBounds();
        const sw = L.CRS.EPSG3857.project(bounds.getSouthWest());
        const ne = L.CRS.EPSG3857.project(bounds.getNorthEast());
        const point = map.latLngToContainerPoint(e.latlng);

        const params = new URLSearchParams({
          SERVICE: 'WMS',
          VERSION: '1.1.1',
          REQUEST: 'GetFeatureInfo',
          QUERY_LAYERS: 'Parsel',
          LAYERS: 'Parsel',
          // INFO_FORMAT: 'text/html', // TKGM html dönmüyor bazen, text dene
          SRS: 'EPSG:3857',
          BBOX: `${sw.x},${sw.y},${ne.x},${ne.y}`,
          WIDTH: size.x.toString(),
          HEIGHT: size.y.toString(),
          X: Math.floor(point.x).toString(),
          Y: Math.floor(point.y).toString()
        });

        // Popup aç
        if (!featureInfoPopupRef.current) featureInfoPopupRef.current = L.popup();
        featureInfoPopupRef.current
          .setLatLng(e.latlng)
          .setContent('<div class="p-2 text-xs">Sorgulanıyor...<br/><span class="opacity-50">TKGM Servisinden Yanıt Bekleniyor</span></div>')
          .openOn(map);

        // Proxy üzerinden istek at
        fetch(`/api/wms?${params.toString()}&INFO_FORMAT=text/plain`)
          .then(res => res.text())
          .then(text => {
            if (!text || text.length < 5 || text.includes('Exception') || text.includes('Error')) {
              // Bilgi yoksa koordinat göster
              featureInfoPopupRef.current?.setContent(`
                     <div class="text-center p-1">
                        <strong class="text-blue-600 block mb-1">Konum Bilgisi</strong>
                        <div class="font-mono text-[10px] text-gray-600">${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}</div>
                        <div class="mt-2 text-[9px] text-gray-400 italic border-t pt-1">Parsel detayı için<br/>Ada/Parsel ile arayın.</div>
                     </div>
                   `);
            } else {
              // Gelen texti göster
              featureInfoPopupRef.current?.setContent(`<div style="max-height:200px;overflow:auto;font-size:10px;"><pre>${text}</pre></div>`);
            }
          })
          .catch(() => {
            featureInfoPopupRef.current?.setContent('Sorgu Hatası');
          });
      }
    });


    recordedPointsGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle Measurement Visualization
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (measureLineRef.current) map.removeLayer(measureLineRef.current);
    measurePointsRef.current.forEach(m => map.removeLayer(m));
    measurePointsRef.current = [];

    if (measurePoints.length > 0) {
      measureLineRef.current = L.polyline(measurePoints, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);

      measurePoints.forEach((p, idx) => {
        const marker = L.circleMarker(p, {
          radius: idx === measurePoints.length - 1 ? 6 : 4,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map);
        measurePointsRef.current.push(marker);
      });
    }
  }, [measurePoints]);

  // Handle TKGM WMS Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showTkgmLayer) {
      if (!tkgmLayerRef.current) {
        console.log("Adding TKGM Layer");
        tkgmLayerRef.current = L.tileLayer.wms('/api/wms', {
          layers: 'Parsel',
          format: 'image/png',
          transparent: true,
          version: '1.1.1',
          maxZoom: 22,
          minZoom: 14,
          zIndex: 10
        }).addTo(map);
      }
    } else {
      if (tkgmLayerRef.current) {
        map.removeLayer(tkgmLayerRef.current);
        tkgmLayerRef.current = null;
      }
    }
  }, [showTkgmLayer]);


  // Handle Stakeout Visualization
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (stakeoutLineRef.current) map.removeLayer(stakeoutLineRef.current);
    if (stakeoutMarkerRef.current) map.removeLayer(stakeoutMarkerRef.current);

    if (stakeoutTarget && locationMarkerRef.current) {
      const userPos = locationMarkerRef.current.getLatLng();
      const targetPos = L.latLng(stakeoutTarget.lat, stakeoutTarget.lng);

      stakeoutLineRef.current = L.polyline([userPos, targetPos], {
        color: '#22c55e',
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.6,
        className: 'animate-pulse'
      }).addTo(map);

      stakeoutMarkerRef.current = L.circleMarker(targetPos, {
        radius: 12,
        fillColor: '#22c55e',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.4,
        className: 'animate-pulse'
      }).addTo(map);
    }
  }, [stakeoutTarget]);

  // Geolocation Handling
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onLocationFound = (e: L.LocationEvent) => {
      if (onLocationUpdate) onLocationUpdate(e.latlng.lat, e.latlng.lng);

      if (!locationMarkerRef.current) {
        locationMarkerRef.current = L.circleMarker(e.latlng, {
          radius: 8,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(map);

        map.flyTo(e.latlng, 17);
      } else {
        locationMarkerRef.current.setLatLng(e.latlng);
      }

      if (stakeoutTarget && stakeoutLineRef.current) {
        stakeoutLineRef.current.setLatLngs([e.latlng, [stakeoutTarget.lat, stakeoutTarget.lng]]);
      }
    };

    const onLocationErrorInternal = (e: L.ErrorEvent) => {
      map.stopLocate();
      if (onLocationError) {
        onLocationError(e.message);
      }
    };

    if (isLocationEnabled) {
      if (!navigator.geolocation) {
        if (onLocationError) onLocationError("Geolocation not supported by browser");
        return;
      }

      map.on('locationfound', onLocationFound);
      map.on('locationerror', onLocationErrorInternal);
      map.locate({ watch: true, enableHighAccuracy: true });
    } else {
      map.stopLocate();
      map.off('locationfound', onLocationFound);
      map.off('locationerror', onLocationErrorInternal);

      if (locationMarkerRef.current) {
        map.removeLayer(locationMarkerRef.current);
        locationMarkerRef.current = null;
      }
      if (stakeoutLineRef.current) {
        map.removeLayer(stakeoutLineRef.current);
        stakeoutLineRef.current = null;
      }
      if (stakeoutMarkerRef.current) {
        map.removeLayer(stakeoutMarkerRef.current);
        stakeoutMarkerRef.current = null;
      }
    }

    return () => {
      if (map) {
        map.off('locationfound', onLocationFound);
        map.off('locationerror', onLocationErrorInternal);
      }
    };
  }, [isLocationEnabled, onLocationError, onLocationUpdate, stakeoutTarget]);

  // Handle Recorded Points Rendering
  useEffect(() => {
    if (!recordedPointsGroupRef.current) return;
    recordedPointsGroupRef.current.clearLayers();

    recordedPoints.forEach(p => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 6,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 1
      });

      marker.bindTooltip(p.name, {
        permanent: true,
        direction: 'top',
        className: 'custom-tooltip'
      });

      marker.addTo(recordedPointsGroupRef.current!);
    });
  }, [recordedPoints]);

  useEffect(() => {
    if (zoomTargetId && mapRef.current && layerGroupsRef.current[zoomTargetId]) {
      const group = layerGroupsRef.current[zoomTargetId];
      const bounds = L.latLngBounds([]);
      group.eachLayer((layer: any) => {
        if (layer.getBounds) {
          bounds.extend(layer.getBounds());
        } else if (layer.getLatLng) {
          bounds.extend(layer.getLatLng());
        }
      });

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }
  }, [zoomTargetId]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    Object.keys(layerGroupsRef.current).forEach(id => {
      if (!layers.find(l => l.id === id)) {
        map.removeLayer(layerGroupsRef.current[id]);
        delete layerGroupsRef.current[id];
      }
    });

    layers.forEach(layer => {
      if (!layer.visible) {
        if (layerGroupsRef.current[layer.id]) {
          map.removeLayer(layerGroupsRef.current[layer.id]);
        }
        return;
      }

      if (layerGroupsRef.current[layer.id]) {
        map.removeLayer(layerGroupsRef.current[layer.id]);
      }

      const group = L.layerGroup().addTo(map);
      layerGroupsRef.current[layer.id] = group;

      if (layer.data) {
        L.geoJSON(layer.data, {
          filter: (feature) => {
            if (!layer.subLayers) return true;
            const subLayerName = feature.properties?.layer;
            return layer.subLayers[subLayerName] !== false;
          },
          style: (feature) => {
            const color = feature?.properties?.color || layer.color || '#3b82f6';
            return {
              color: color,
              weight: 1.5,
              opacity: layer.opacity,
              fillOpacity: layer.opacity * 0.2
            };
          },
          pointToLayer: (feature, latlng) => {
            const color = feature?.properties?.color || layer.color || '#3b82f6';
            return L.circleMarker(latlng, {
              radius: 3,
              fillColor: color,
              color: "#fff",
              weight: 1,
              opacity: layer.opacity,
              fillOpacity: layer.opacity
            });
          }
        }).addTo(group);

        // Add Edge Labels if it's a parcel (geojson)
        if (layer.type === 'geojson' && layer.data) {
          layer.data.features.forEach((feature: any) => {
            if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
              // Render geometry temporarily to iterate coords easily or map coords directly
              // Simplest: map coords
              const processRing = (coords: number[][]) => {
                for (let i = 0; i < coords.length - 1; i++) { // GeoJSON usually repeats last point
                  const p1 = L.latLng(coords[i][1], coords[i][0]);
                  const p2 = L.latLng(coords[i + 1][1], coords[i + 1][0]);
                  const dist = map.distance(p1, p2);

                  if (dist < 0.2) continue; // Skip very small segments

                  const midLat = (p1.lat + p2.lat) / 2;
                  const midLng = (p1.lng + p2.lng) / 2;

                  // Calculate angle for better text rotation (optional, simple marker for now)
                  // Basic label
                  L.marker([midLat, midLng], {
                    icon: L.divIcon({
                      className: 'p-0 border-0', // reset defaults
                      html: `<div class="px-1 py-0.5 bg-white/90 border border-red-500/30 rounded shadow text-[9px] font-bold text-red-600 whitespace-nowrap -translate-x-1/2 -translate-y-1/2 pointer-events-none">${dist.toFixed(2)} m</div>`,
                      iconSize: [0, 0], // let css handle size
                    })
                  }).addTo(group);
                }
              };

              if (feature.geometry.type === 'Polygon') {
                feature.geometry.coordinates.forEach((ring: any) => processRing(ring));
              } else if (feature.geometry.type === 'MultiPolygon') {
                feature.geometry.coordinates.forEach((poly: any) => poly.forEach((ring: any) => processRing(ring)));
              }
            }
          });
        }
      }
    });
  }, [layers]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" />
  );
};

export default CADMap;
