import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Navigation, 
  Crosshair, 
  Radar, 
  Waypoints, 
  Route,
  LocateFixed,
  Radio,
  Activity,
  Compass
} from 'lucide-react';
import { AccidentDetail } from '../types/contracts';
import { TILE_STYLES, MapStyle } from '../services/mapConfig';
import { fetchShortestRoadRoute } from '../services/routingService';

interface HospitalMapProps {
  accident: AccidentDetail | null;
}

// Marker Icon Creators
function createPatientIcon() {
  return L.divIcon({
    className: 'patient-marker-wrap',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; width: 140px; margin-left: -50px; margin-top: -44px; pointer-events: none;">
        <div style="background: #dc2626; color: #ffffff; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.4); white-space: nowrap;">
          🚨 PATIENT AT SCENE
        </div>
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #ef4444; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.7); margin-top: 2px; font-size: 15px;">
          ⚠️
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

function createHospitalIcon() {
  return L.divIcon({
    className: 'hosp-marker-wrap',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; width: 140px; margin-left: -50px; margin-top: -44px; pointer-events: none;">
        <div style="background: #2563eb; color: #ffffff; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.4); white-space: nowrap;">
          🏥 BASE HOSPITAL ER
        </div>
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #3b82f6; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.7); margin-top: 2px; font-size: 15px;">
          🏥
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
}

function createAmbulanceIcon() {
  return L.divIcon({
    className: 'amb-marker-wrap',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; width: 140px; margin-left: -52px; margin-top: -40px; pointer-events: none;">
        <div style="background: #059669; color: #ffffff; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.4); white-space: nowrap; margin-bottom: 2px;">
          🚑 ALS-108 [EN ROUTE]
        </div>
        <div style="width: 34px; height: 34px; border-radius: 50%; background: #10b981; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.7); font-size: 16px;">
          🚑
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

export const HospitalMap: React.FC<HospitalMapProps> = ({ accident }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.TileLayer | null>(null);
  const patientMarkerRef = useRef<L.Marker | null>(null);
  const hospitalMarkerRef = useRef<L.Marker | null>(null);
  const casingPolylineRef = useRef<L.Polyline | null>(null);
  const roadPolylineRef = useRef<L.Polyline | null>(null);
  const traveledPolylineRef = useRef<L.Polyline | null>(null);
  const ambulanceMarkerRef = useRef<L.Marker | null>(null);
  const nodesLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [mapStyle, setMapStyle] = useState<MapStyle>('DARK');
  const [showRadarOverlay, setShowRadarOverlay] = useState<boolean>(false);
  const [showWaypointsList, setShowWaypointsList] = useState<boolean>(false);
  const [ambulanceProgress, setAmbulanceProgress] = useState<number>(10);
  const [activeRoadRoute, setActiveRoadRoute] = useState<[number, number][]>([]);
  const [followAmbulance, setFollowAmbulance] = useState<boolean>(false);
  const [ambulanceHeading, setAmbulanceHeading] = useState<number>(0);
  const [currentAmbulanceCoords, setCurrentAmbulanceCoords] = useState<[number, number]>([26.85, 80.93]);

  const hospital = accident?.selected_hospital;

  // 1. Resolve driving road route (from seed route or via OSRM street network)
  useEffect(() => {
    if (!accident) return;

    let isMounted = true;
    const initialRoute = accident.selected_hospital?.route;

    if (initialRoute && Array.isArray(initialRoute) && initialRoute.length >= 20) {
      setActiveRoadRoute(initialRoute as [number, number][]);
    } else if (hospital) {
      fetchShortestRoadRoute(
        hospital.latitude,
        hospital.longitude,
        accident.latitude,
        accident.longitude
      ).then((resolvedPoints) => {
        if (isMounted) {
          setActiveRoadRoute(resolvedPoints);
        }
      });
    }

    setAmbulanceProgress(6);

    return () => {
      isMounted = false;
    };
  }, [accident?.accident_id, hospital?.latitude, hospital?.longitude]);

  // 2. Animate ambulance progress along the road path
  useEffect(() => {
    const timer = setInterval(() => {
      setAmbulanceProgress(prev => (prev >= 98 ? 5 : prev + 1.25));
    }, 550);
    return () => clearInterval(timer);
  }, [accident?.accident_id]);

  // 3. Initialize Leaflet Map ONCE on container mount
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    if (mapRef.current) return;

    if ((container as unknown as { _leaflet_id?: number })._leaflet_id) {
      delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
    }

    const defaultLat = accident?.latitude || 26.8467;
    const defaultLng = accident?.longitude || 80.9462;
    const hospLat = hospital?.latitude || 26.8702;
    const hospLng = hospital?.longitude || 80.9168;

    const map = L.map(container, {
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      dragging: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial Tile Layer
    const tileConfig = TILE_STYLES[mapStyle];
    const tileLayer = L.tileLayer(tileConfig.url, {
      maxZoom: tileConfig.maxZoom,
      attribution: tileConfig.attribution,
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    if (tileConfig.overlayUrl) {
      const overlayLayer = L.tileLayer(tileConfig.overlayUrl, {
        maxZoom: tileConfig.maxZoom,
        opacity: 0.9,
      }).addTo(map);
      overlayLayerRef.current = overlayLayer;
    }

    // Route casing (dark contrast outline along street lanes)
    const casingPolyline = L.polyline([], {
      color: '#0f172a',
      weight: 8,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    casingPolylineRef.current = casingPolyline;

    // Base road polyline (Cyan shortest street path)
    const roadPolyline = L.polyline([], {
      color: '#0284c7',
      weight: 4.5,
      opacity: 0.95,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    roadPolylineRef.current = roadPolyline;

    // Traveled road polyline (Emerald Green trail behind ambulance)
    const traveledPolyline = L.polyline([], {
      color: '#10b981',
      weight: 5,
      opacity: 1,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);
    traveledPolylineRef.current = traveledPolyline;

    // Street nodes layer group
    const nodesGroup = L.layerGroup().addTo(map);
    nodesLayerGroupRef.current = nodesGroup;

    // Patient marker at crash site
    const patientMarker = L.marker([defaultLat, defaultLng], {
      icon: createPatientIcon(),
    }).addTo(map);
    patientMarkerRef.current = patientMarker;

    // Hospital ER marker
    const hospitalMarker = L.marker([hospLat, hospLng], {
      icon: createHospitalIcon(),
    }).addTo(map);
    hospitalMarkerRef.current = hospitalMarker;

    // Moving Ambulance marker
    const ambulanceMarker = L.marker([hospLat, hospLng], {
      icon: createAmbulanceIcon(),
      zIndexOffset: 1000,
    }).addTo(map);
    ambulanceMarkerRef.current = ambulanceMarker;

    mapRef.current = map;

    // Force map to adapt to container layout
    map.invalidateSize();
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timeout);
      if (overlayLayerRef.current) {
        overlayLayerRef.current.remove();
        overlayLayerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      patientMarkerRef.current = null;
      hospitalMarkerRef.current = null;
      casingPolylineRef.current = null;
      roadPolylineRef.current = null;
      traveledPolylineRef.current = null;
      ambulanceMarkerRef.current = null;
      nodesLayerGroupRef.current = null;
    };
  }, []);

  // 4. Update Map Tile Layer when MapStyle changes (Dark, Street, Hybrid)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    const cfg = TILE_STYLES[mapStyle];
    tileLayerRef.current.setUrl(cfg.url);

    if (overlayLayerRef.current) {
      if (cfg.overlayUrl) {
        overlayLayerRef.current.setUrl(cfg.overlayUrl);
      } else {
        overlayLayerRef.current.remove();
        overlayLayerRef.current = null;
      }
    } else if (cfg.overlayUrl) {
      const overlay = L.tileLayer(cfg.overlayUrl, {
        maxZoom: cfg.maxZoom,
        opacity: 0.9,
      }).addTo(map);
      overlayLayerRef.current = overlay;
    }
  }, [mapStyle]);

  // 5. Update Map Elements (Accident Position, Hospital Position, Road Polyline, Bounds)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !accident) return;

    // Update Patient Marker
    if (patientMarkerRef.current) {
      patientMarkerRef.current.setLatLng([accident.latitude, accident.longitude]);
      patientMarkerRef.current.bindPopup(`
        <div style="font-family: monospace; font-size: 12px; color: #fff; line-height: 1.4;">
          <strong style="color: #ef4444;">🚨 CASUALTY SITE / PATIENT LOCATION</strong><br/>
          Incident ID: <strong>${accident.accident_id}</strong><br/>
          Impact Force: <strong style="color: #f87171;">${accident.impact_magnitude}g</strong><br/>
          Coords: ${accident.latitude.toFixed(5)}°N, ${accident.longitude.toFixed(5)}°E<br/>
          Status: <span style="color: #fbbf24;">Awaiting ALS Ambulance Extraction</span>
        </div>
      `);
    }

    // Update Hospital Marker & Route
    const boundsPoints: [number, number][] = [[accident.latitude, accident.longitude]];

    if (hospital) {
      boundsPoints.push([hospital.latitude, hospital.longitude]);

      if (hospitalMarkerRef.current) {
        hospitalMarkerRef.current.setLatLng([hospital.latitude, hospital.longitude]);
        hospitalMarkerRef.current.bindPopup(`
          <div style="font-family: monospace; font-size: 12px; color: #fff; line-height: 1.4;">
            <strong style="color: #60a5fa;">🏥 ${hospital.name}</strong><br/>
            Facility: Trauma ER Intake Center<br/>
            Road Transit: <strong>${hospital.eta_min} mins</strong> (${hospital.road_distance_km || hospital.distance_km} km)<br/>
            Hotline: ${hospital.phone || 'Not available'}
          </div>
        `);
      }

      const routePointsToDraw = activeRoadRoute.length >= 2 
        ? activeRoadRoute 
        : [[hospital.latitude, hospital.longitude], [accident.latitude, accident.longitude]] as [number, number][];

      routePointsToDraw.forEach(pt => boundsPoints.push(pt));

      if (casingPolylineRef.current) {
        casingPolylineRef.current.setLatLngs(routePointsToDraw);
      }
      if (roadPolylineRef.current) {
        roadPolylineRef.current.setLatLngs(routePointsToDraw);
      }

      // Turn nodes
      if (nodesLayerGroupRef.current) {
        nodesLayerGroupRef.current.clearLayers();
        if (routePointsToDraw.length > 5) {
          const step = Math.max(1, Math.floor(routePointsToDraw.length / 14));
          for (let i = step; i < routePointsToDraw.length - 1; i += step) {
            const pt = routePointsToDraw[i];
            const dot = L.circleMarker(pt, {
              radius: 3,
              fillColor: '#38bdf8',
              color: '#0369a1',
              weight: 1.5,
              opacity: 1,
              fillOpacity: 1,
            });
            dot.bindTooltip(`Street Node #${i + 1}`, { permanent: false });
            nodesLayerGroupRef.current.addLayer(dot);
          }
        }
      }
    }

    // Fit map bounds
    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView([accident.latitude, accident.longitude], 13);
    }

    map.invalidateSize();
  }, [accident?.accident_id, activeRoadRoute, hospital?.latitude, hospital?.longitude]);

  // 6. Update Ambulance Live Tracking Position Along Road Network
  useEffect(() => {
    if (!ambulanceMarkerRef.current || !accident || !hospital) return;

    const points = activeRoadRoute.length >= 2 
      ? activeRoadRoute 
      : [[hospital.latitude, hospital.longitude], [accident.latitude, accident.longitude]] as [number, number][];

    const frac = ambulanceProgress / 100;
    const totalSegments = points.length - 1;
    const targetSeg = Math.min(totalSegments - 1, Math.floor(frac * totalSegments));
    const segFrac = (frac * totalSegments) - targetSeg;

    const p1 = points[targetSeg];
    const p2 = points[targetSeg + 1];
    const curLat = p1[0] + (p2[0] - p1[0]) * segFrac;
    const curLng = p1[1] + (p2[1] - p1[1]) * segFrac;

    const dLat = p2[0] - p1[0];
    const dLng = p2[1] - p1[1];
    const heading = (Math.atan2(dLng, dLat) * 180) / Math.PI;

    setAmbulanceHeading(heading);
    setCurrentAmbulanceCoords([curLat, curLng]);

    ambulanceMarkerRef.current.setLatLng([curLat, curLng]);

    if (traveledPolylineRef.current) {
      const traveledPoints = points.slice(0, targetSeg + 1);
      traveledPoints.push([curLat, curLng]);
      traveledPolylineRef.current.setLatLngs(traveledPoints);
    }

    if (followAmbulance && mapRef.current) {
      mapRef.current.panTo([curLat, curLng], { animate: true, duration: 0.4 });
    }
  }, [ambulanceProgress, activeRoadRoute, accident, hospital, followAmbulance]);

  // Quick Action Buttons
  const handleFitEntireRoute = () => {
    if (!mapRef.current || !accident || !hospital) return;
    const boundsPoints: [number, number][] = [
      [hospital.latitude, hospital.longitude],
      [accident.latitude, accident.longitude],
      ...activeRoadRoute
    ];
    mapRef.current.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 15 });
  };

  const handleFocusPatient = () => {
    if (!mapRef.current || !accident) return;
    mapRef.current.setView([accident.latitude, accident.longitude], 15, { animate: true });
  };

  const handleFocusHospital = () => {
    if (!mapRef.current || !hospital) return;
    mapRef.current.setView([hospital.latitude, hospital.longitude], 15, { animate: true });
  };

  const totalDist = hospital?.road_distance_km || hospital?.distance_km || 5.0;
  const remainingDist = Math.max(0.1, totalDist * (1 - ambulanceProgress / 100));
  const totalEta = hospital?.eta_min || 8;
  const remainingEtaMin = Math.max(1, Math.ceil(totalEta * (1 - ambulanceProgress / 100)));

  const dispatchStatusText = 
    ambulanceProgress < 85 
      ? 'EN ROUTE TO CRASH SITE (CODE 3 SIREN)' 
      : ambulanceProgress < 95 
        ? 'ON SCENE: STABILIZING & EXTRACTING PATIENT' 
        : 'PATIENT ONBOARD: INITIATING RETURN TRANSPORT';

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl p-5 shadow-2xl shadow-black/30 flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Geographic Map & Road Network Dispatch
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                STREET NETWORK ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Shortest driving path via road grid &bull; From: {hospital?.name || 'Base Hospital'} &rarr; Target: Patient @ {accident ? `${accident.latitude.toFixed(4)}°N, ${accident.longitude.toFixed(4)}°E` : 'Standby'}
            </p>
          </div>
        </div>

        {/* 3 Map Style Options: Dark, Street, Hybrid */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex rounded-lg border border-slate-800 p-0.5 bg-slate-950/80 text-[11px]">
            <button
              onClick={() => setMapStyle('DARK')}
              className={`px-3 py-1.5 rounded transition-colors ${
                mapStyle === 'DARK' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setMapStyle('STREET')}
              className={`px-3 py-1.5 rounded transition-colors ${
                mapStyle === 'STREET' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Street
            </button>
            <button
              onClick={() => setMapStyle('HYBRID')}
              className={`px-3 py-1.5 rounded transition-colors ${
                mapStyle === 'HYBRID' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hybrid
            </button>
          </div>

          {/* Radar Tactical Grid Toggle */}
          <button
            onClick={() => setShowRadarOverlay(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
              showRadarOverlay
                ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300 font-bold'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Radar Grid</span>
          </button>

          {/* Waypoints Toggle */}
          <button
            onClick={() => setShowWaypointsList(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
              showWaypointsList
                ? 'bg-blue-950/70 border-blue-500/40 text-blue-300 font-bold'
                : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Waypoints className="w-3.5 h-3.5" />
            <span>Road Waypoints ({activeRoadRoute.length})</span>
          </button>
        </div>
      </div>

      {/* Main Map Viewport with Interactive Leaflet (Full Zoom & Pan Enabled) */}
      <div className="relative w-full h-[430px] rounded-xl overflow-hidden border border-slate-800/80 shadow-inner bg-[#09101f]">
        {/* Real Leaflet Map Container - ALWAYS MOUNTED */}
        <div 
          ref={mapContainerRef} 
          id="hospital-map-container"
          className="w-full h-full z-0 cursor-grab active:cursor-grabbing" 
          style={{ minHeight: '430px', height: '430px' }} 
        />

        {/* STATIC TACTICAL RANGE RINGS */}
        {showRadarOverlay && (
          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className="w-[180px] h-[180px] rounded-full border border-cyan-400/20" />
            <div className="absolute w-[300px] h-[300px] rounded-full border border-cyan-400/15" />
            <div className="absolute w-[420px] h-[420px] rounded-full border border-cyan-400/10" />
            <div className="absolute w-full h-px bg-cyan-400/10" />
            <div className="absolute h-full w-px bg-cyan-400/10" />
          </div>
        )}

        {/* Top-Left Static Status HUD Badge */}
        {accident && (
          <div className="absolute top-3 left-3 z-20 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-xs font-mono space-y-1 shadow-xl pointer-events-none">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <Crosshair className="w-4 h-4" />
              <span>ROAD ROUTE TO CASUALTY ACTIVE</span>
            </div>
            <div className="text-[11px] text-slate-300 flex items-center gap-2">
              <span>Impact: <strong className="text-red-400">{accident.impact_magnitude}g</strong></span>
              <span className="text-slate-600">&bull;</span>
              <span>Gate: <strong className="text-emerald-400">&ge; 6.0g Exceeded</strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              Road Distance: <strong className="text-emerald-400">{totalDist} km</strong> &bull; Total ETA: <strong className="text-cyan-400">{totalEta} mins</strong>
            </div>
          </div>
        )}

        {/* Top-Right Quick Camera Navigation Tools */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setFollowAmbulance(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border backdrop-blur-md shadow-lg transition-colors flex items-center gap-1.5 ${
              followAmbulance
                ? 'bg-emerald-600 border-emerald-400 text-white font-bold'
                : 'bg-slate-950/85 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900'
            }`}
            title="Lock camera to follow the ambulance along the road"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Follow Ambulance: {followAmbulance ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={handleFitEntireRoute}
            className="p-1.5 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white backdrop-blur-md shadow-lg transition-colors"
            title="Fit Entire Driving Route"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom-Left Live Legend & Road Segment Status */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none space-y-1.5">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 shadow-lg flex items-center gap-2.5">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <span className="w-2.5 h-1 bg-emerald-500 rounded-full inline-block" />
              Traveled Road
            </span>
            <span className="text-slate-600">&bull;</span>
            <span className="flex items-center gap-1 text-sky-400 font-bold">
              <span className="w-2.5 h-1 bg-sky-500 rounded-full inline-block" />
              Upcoming Road Ahead
            </span>
          </div>

          <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-500/40 rounded-lg px-2.5 py-1 text-[11px] font-mono text-emerald-300 font-bold shadow-lg flex items-center gap-1.5">
            <Route className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shortest Road Route ({activeRoadRoute.length} GPS Waypoints following streets)</span>
          </div>
        </div>

        {/* Bottom-Right Quick Focus Buttons */}
        <div className="absolute bottom-3 right-12 z-20 flex items-center gap-1.5 font-mono text-[11px]">
          <button
            onClick={handleFocusPatient}
            className="px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold backdrop-blur-md transition-colors"
            title="Pan to Patient Crash Location"
          >
            🚨 Patient
          </button>
          <button
            onClick={handleFocusHospital}
            className="px-2 py-1 rounded bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-blue-300 font-bold backdrop-blur-md transition-colors"
            title="Pan to Hospital Base ER"
          >
            🏥 Hospital
          </button>
        </div>
      </div>

      {/* DEDICATED LIVE AMBULANCE TRACKING & DISPATCH TELEMETRY PANEL */}
      <div className="bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 font-mono text-xs space-y-3 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Ambulance Live Tracking: Unit ALS-108</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {dispatchStatusText}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mission: Dispatched from {hospital?.name || 'Base Hospital'} to extract and bring patient to ER Trauma bay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Trip Completion:</span>
            <span className="font-bold text-emerald-400 text-sm">{ambulanceProgress.toFixed(0)}%</span>
          </div>
        </div>

        {/* Progress Bar of Ambulance driving to Patient */}
        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full transition-all duration-300"
            style={{ width: `${ambulanceProgress}%` }}
          />
        </div>

        {/* 4-Card Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 uppercase block">Distance to Patient</span>
            <span className="text-base font-bold text-white mt-0.5 block">{remainingDist.toFixed(1)} km</span>
            <span className="text-[10px] text-emerald-400 font-normal">Shortest road distance</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 uppercase block">Estimated Time to Arrival</span>
            <span className="text-base font-bold text-cyan-400 mt-0.5 block">{remainingEtaMin} mins</span>
            <span className="text-[10px] text-slate-400 font-normal">Real-time street transit</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 uppercase block">Approach Speed</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-base font-bold text-white">54 km/h</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-normal">Priority Siren Active</span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
            <span className="text-[10px] text-slate-400 uppercase block">Ambulance GPS Location</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200">
                {currentAmbulanceCoords[0].toFixed(4)}°, {currentAmbulanceCoords[1].toFixed(4)}°
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-normal">Heading {ambulanceHeading.toFixed(0)}° along street</span>
          </div>
        </div>
      </div>

      {/* Waypoints Drawer (when toggled on) */}
      {showWaypointsList && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-bold text-white flex items-center gap-2">
              <Waypoints className="w-4 h-4 text-cyan-400" />
              <span>Turn-by-Turn Street Coordinates ({activeRoadRoute.length} Points)</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              Total Road Distance: <strong className="text-emerald-400">{totalDist} km</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {activeRoadRoute.map((pt, i) => (
              <div key={i} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-0.5">
                  <span className="font-bold text-cyan-300">Waypoint #{i + 1}</span>
                  <span>{i === 0 ? 'Hospital Origin' : i === activeRoadRoute.length - 1 ? 'Crash Target' : 'Turn'}</span>
                </div>
                <div className="font-bold text-white text-[11px]">
                  {pt[0].toFixed(4)}°N, {pt[1].toFixed(4)}°E
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hospital Facility Details Banner */}
      {hospital && (
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-[10px] uppercase text-cyan-400 font-bold block">Assigned Trauma Center</span>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{hospital.name}</span>
              <span className="text-slate-400 font-normal">({hospital.phone || 'Direct Telemetry Gateway'})</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{hospital.address || 'Address dispatched via emergency feed'}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-center">
              <span className="text-[9px] text-slate-400 uppercase block font-bold">Transit ETA</span>
              <span className="text-sm font-bold text-cyan-400">{hospital.eta_min} mins</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg text-center">
              <span className="text-[9px] text-slate-400 uppercase block font-bold">Road Driving Distance</span>
              <span className="text-sm font-bold text-emerald-400">{totalDist} km</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
