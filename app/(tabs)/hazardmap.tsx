import { ScrollView, View, Text, Pressable, Modal, TextInput, Image, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import Svg, { Circle, Line, Text as SvgText, G, Path, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import {
  MapPin, Camera, AlertTriangle, Zap, X, CheckCircle,
  Filter, Users, TrendingUp, Eye, Clock, ArrowRight,
  Zap as ElectricIcon, Droplets, Building, Flame, Upload, Layers,
} from 'lucide-react-native';
import { LOCATIONS, CITY_OPTIONS } from '../../lib/locations';
import { useLang } from '../../lib/langContext';

interface HazardReport {
  id: string;
  lat: number;
  lng: number;
  type: 'wire' | 'pothole' | 'flood' | 'collapse' | 'fire_hazard';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  photoUrl: string | null;
  reporterName: string;
  area: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  clusterSize: number;
  createdAt: string;
}

interface Cluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  area: string;
  reports: HazardReport[];
}

const HAZARD_TYPES = [
  { value: 'wire', labelKey: 'hazard_type_wire' as const, icon: <ElectricIcon size={14} color="#ca8a04" /> },
  { value: 'pothole', labelKey: 'hazard_type_pothole' as const, icon: <ElectricIcon size={14} color="#ea580c" /> },
  { value: 'flood', labelKey: 'hazard_type_flood' as const, icon: <Droplets size={14} color="#2563eb" /> },
  { value: 'collapse', labelKey: 'hazard_type_collapse' as const, icon: <Building size={14} color="#dc2626" /> },
  { value: 'fire_hazard', labelKey: 'hazard_type_fire' as const, icon: <Flame size={14} color="#dc2626" /> },
];

const SEV_COLOR: Record<string, string> = {
  LOW: '#3b82f6',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const SEV_BG: Record<string, string> = {
  LOW: '#1e3a5f',
  MEDIUM: '#4a3f00',
  HIGH: '#4a2600',
  CRITICAL: '#4a0000',
};

const SEV_TEXT: Record<string, string> = {
  LOW: '#60a5fa',
  MEDIUM: '#fde047',
  HIGH: '#fb923c',
  CRITICAL: '#f87171',
};

// Seed data — spread across India
const SEED_REPORTS: HazardReport[] = [
  { id: 'h1', lat: 28.6139, lng: 77.2090, type: 'wire', severity: 'CRITICAL', description: 'Loose live wire hanging near school gate', reporterName: 'Priya Sharma', area: 'Connaught Place, Delhi', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: null },
  { id: 'h2', lat: 28.5355, lng: 77.3910, type: 'pothole', severity: 'HIGH', description: 'Giant pothole on main road near Sector 62', reporterName: 'Deepak Joshi', area: 'Noida, UP', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), photoUrl: null },
  { id: 'h3', lat: 19.0760, lng: 72.8777, type: 'flood', severity: 'CRITICAL', description: 'Street waterlogged, knee-deep water in Andheri', reporterName: 'Kavita Nair', area: 'Mumbai, MH', status: 'OPEN', clusterSize: 5, createdAt: new Date(Date.now() - 86400000 * 0.3).toISOString(), photoUrl: null },
  { id: 'h4', lat: 12.9716, lng: 77.5946, type: 'pothole', severity: 'HIGH', description: 'Multiple potholes on Outer Ring Road', reporterName: 'Rajesh Kumar', area: 'Bangalore, KA', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), photoUrl: null },
  { id: 'h5', lat: 22.5726, lng: 88.3639, type: 'wire', severity: 'CRITICAL', description: 'Broken electric pole leaning on road', reporterName: 'Amit Das', area: 'Kolkata, WB', status: 'OPEN', clusterSize: 3, createdAt: new Date(Date.now() - 86400000 * 0.5).toISOString(), photoUrl: null },
  { id: 'h6', lat: 13.0827, lng: 80.2707, type: 'flood', severity: 'MEDIUM', description: 'Drainage overflow near T.Nagar', reporterName: 'Lakshmi S', area: 'Chennai, TN', status: 'OPEN', clusterSize: 1, createdAt: new Date(Date.now() - 86400000 * 4).toISOString(), photoUrl: null },
  { id: 'h7', lat: 26.9124, lng: 75.7873, type: 'collapse', severity: 'HIGH', description: 'Old wall collapsed near market', reporterName: 'Vikram Singh', area: 'Jaipur, RJ', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 1.5).toISOString(), photoUrl: null },
  { id: 'h8', lat: 23.0225, lng: 72.5714, type: 'fire_hazard', severity: 'CRITICAL', description: 'Gas leak near industrial area', reporterName: 'Mehul Patel', area: 'Ahmedabad, GJ', status: 'OPEN', clusterSize: 4, createdAt: new Date(Date.now() - 86400000 * 0.2).toISOString(), photoUrl: null },
  { id: 'h9', lat: 17.3850, lng: 78.4867, type: 'pothole', severity: 'MEDIUM', description: 'Pothole causing accidents near Charminar', reporterName: 'Sridhar R', area: 'Hyderabad, TS', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), photoUrl: null },
  { id: 'h10', lat: 26.8467, lng: 80.9462, type: 'wire', severity: 'HIGH', description: 'Live wire dangling over footpath', reporterName: 'Ankit Mishra', area: 'Lucknow, UP', status: 'OPEN', clusterSize: 2, createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), photoUrl: null },
];

// India map bounds (covering the entire country)
const MAP_BOUNDS = { minLat: 7.5, maxLat: 35.5, minLng: 68.0, maxLng: 97.5 };

function project(lat: number, lng: number, w: number, h: number) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * w;
  const y = h - ((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * h;
  return { x, y };
}

// Simplified India outline SVG path (fits inside the viewBox using lat/lng projection)
function getIndiaPath(w: number, h: number): string {
  // Key outline points of India (lat, lng) — simplified polygon
  const outline: [number, number][] = [
    [32.5, 75.3], // Kashmir top
    [34.5, 77.0], // Ladakh
    [33.0, 79.0], // Eastern Kashmir
    [31.0, 79.5], // Uttarakhand
    [30.3, 80.2],
    [29.5, 80.8],
    [28.5, 83.5], // Nepal border
    [27.5, 84.5],
    [26.8, 86.0],
    [26.5, 87.5],
    [26.7, 88.5], // Sikkim
    [27.2, 89.0],
    [28.0, 89.5],
    [27.5, 90.5],
    [27.0, 91.5],
    [27.5, 92.0],
    [28.0, 93.0],
    [28.2, 94.5],
    [27.5, 95.5],
    [27.0, 96.5],
    [26.0, 96.5], // NE India
    [25.0, 95.0],
    [24.5, 94.5],
    [24.0, 93.5],
    [23.5, 92.5],
    [22.5, 92.5],
    [21.5, 92.2], // Myanmar border
    [21.0, 92.3],
    [20.5, 92.5],
    [22.0, 91.0], // Bangladesh border curves back
    [24.0, 92.0],
    [25.0, 92.0],
    [25.2, 90.5],
    [25.5, 89.5],
    [24.5, 88.5],
    [23.5, 88.5],
    [22.5, 88.8], // Kolkata coast
    [21.5, 87.5],
    [21.0, 87.0],
    [20.5, 86.5],
    [19.5, 85.5],
    [19.0, 84.5], // Odisha coast
    [18.0, 84.0],
    [17.0, 82.5],
    [16.0, 81.5], // AP coast
    [15.5, 80.5],
    [14.5, 80.0],
    [13.5, 80.3], // Chennai
    [12.5, 80.0],
    [11.5, 80.0],
    [10.5, 79.8],
    [9.5, 79.0],
    [8.5, 77.5], // Kanyakumari
    [8.0, 77.0],
    [8.5, 76.5],
    [9.0, 76.0],
    [10.0, 76.0], // Kerala
    [11.0, 75.5],
    [12.0, 75.0],
    [13.0, 74.5],
    [14.5, 74.0], // Goa
    [15.5, 73.8],
    [17.0, 73.3],
    [18.5, 73.0], // Mumbai
    [19.5, 72.8],
    [20.5, 72.5],
    [21.0, 72.0],
    [21.5, 72.0], // Gujarat coast
    [22.0, 69.5],
    [22.5, 69.0],
    [23.0, 68.5],
    [23.5, 68.5], // Kutch
    [24.0, 69.0],
    [24.5, 70.0],
    [25.0, 70.5],
    [25.5, 71.0],
    [26.0, 70.5],
    [27.0, 70.0],
    [28.0, 70.5],
    [29.0, 71.0], // Rajasthan/Punjab
    [30.0, 72.0],
    [30.5, 73.0],
    [31.0, 74.0],
    [32.0, 74.5],
    [32.5, 75.3], // Back to Kashmir
  ];

  const points = outline.map(([lat, lng]) => {
    const { x, y } = project(lat, lng, w, h);
    return `${x},${y}`;
  });

  return `M ${points[0]} ` + points.slice(1).map(p => `L ${p}`).join(' ') + ' Z';
}

// Major Indian city labels for the map
const INDIA_CITIES = [
  { lat: 28.6139, lng: 77.2090, label: 'Delhi' },
  { lat: 19.0760, lng: 72.8777, label: 'Mumbai' },
  { lat: 12.9716, lng: 77.5946, label: 'Bangalore' },
  { lat: 22.5726, lng: 88.3639, label: 'Kolkata' },
  { lat: 13.0827, lng: 80.2707, label: 'Chennai' },
  { lat: 17.3850, lng: 78.4867, label: 'Hyderabad' },
  { lat: 23.0225, lng: 72.5714, label: 'Ahmedabad' },
  { lat: 26.9124, lng: 75.7873, label: 'Jaipur' },
  { lat: 26.8467, lng: 80.9462, label: 'Lucknow' },
  { lat: 28.5355, lng: 77.3910, label: 'Noida' },
];

// Generate dark-themed interactive Leaflet map HTML for WebView
const generateMapHtml = (clusters: Cluster[]) => {
  const markersJson = JSON.stringify(
    clusters.map(c => ({
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      count: c.count,
      severity: c.severity,
      area: c.area,
      color: SEV_COLOR[c.severity]
    }))
  );

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map {
          height: 100%;
          margin: 0;
          padding: 0;
          background-color: #0f172a;
        }
        .marker-cluster-custom {
          border-radius: 50%;
          text-align: center;
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 14px var(--glow-color);
          border: 2.5px solid white;
        }
        .custom-tooltip {
          background-color: rgba(15, 23, 42, 0.7);
          border: 1px solid #334155;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          color: #f1f5f9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .custom-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.7);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        const map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
          boxZoom: true
        }).setView([22.9734, 78.6569], 4);

        // CartoDB Dark Matter tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 20
        }).addTo(map);

        const markers = ${markersJson};
        markers.forEach(m => {
          const radius = Math.min(22 + m.count * 3, 36);
          const icon = L.divIcon({
            html: '<div class="marker-cluster-custom" style="width:' + radius + 'px; height:' + radius + 'px; line-height:' + radius + 'px; --glow-color: ' + m.color + '; background-color: ' + m.color + '; opacity: 0.95;">' + m.count + '</div>',
            className: '',
            iconSize: [radius, radius],
            iconAnchor: [radius/2, radius/2]
          });

          const marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
          
          if (m.area) {
            marker.bindTooltip(m.area, {
              permanent: true,
              direction: 'top',
              className: 'custom-tooltip',
              offset: [0, -radius/2 - 2]
            });
          }

          marker.on('click', () => {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select_cluster', id: m.id }));
          });
        });
      </script>
    </body>
    </html>
  `;
};

function buildClusters(reports: HazardReport[]): Cluster[] {
  const threshold = 0.5; // ~50km radius for India-wide clustering
  const used = new Set<string>();
  const clusters: Cluster[] = [];

  for (const r of reports) {
    if (used.has(r.id)) continue;
    const nearby = reports.filter(o =>
      !used.has(o.id) &&
      Math.abs(o.lat - r.lat) < threshold &&
      Math.abs(o.lng - r.lng) < threshold
    );
    nearby.forEach(o => used.add(o.id));
    const sevOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const maxSev = nearby.reduce((best, o) =>
      sevOrder.indexOf(o.severity) > sevOrder.indexOf(best) ? o.severity : best, 'LOW' as HazardReport['severity']);
    clusters.push({
      id: r.id,
      lat: nearby.reduce((s, o) => s + o.lat, 0) / nearby.length,
      lng: nearby.reduce((s, o) => s + o.lng, 0) / nearby.length,
      count: nearby.length,
      severity: maxSev,
      type: r.type,
      area: r.area,
      reports: nearby,
    });
  }
  return clusters;
}

export default function HazardMapScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [reports, setReports] = useState<HazardReport[]>(SEED_REPORTS);
  const [clusters, setClusters] = useState<Cluster[]>(() => buildClusters(SEED_REPORTS));
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSev, setFilterSev] = useState<string>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mapWidth, setMapWidth] = useState(350);
  const [mapHeight, setMapHeight] = useState(300);

  const [form, setForm] = useState({
    type: 'wire' as HazardReport['type'],
    severity: 'HIGH' as HazardReport['severity'],
    description: '',
    reporterName: '',
    area: '',
    photoUri: null as string | null,
    useGPS: false,
    lat: 28.6139,
    lng: 77.2090,
  });

  const visibleClusters = clusters.filter(c => {
    const matchType = filterType === 'ALL' || c.reports.some(r => r.type === filterType);
    const matchSev = filterSev === 'ALL' || c.severity === filterSev;
    return matchType && matchSev;
  });

  const totalOpen = reports.filter(r => r.status === 'OPEN').length;
  const criticalZones = clusters.filter(c => c.severity === 'CRITICAL').length;

  async function handleGetGPS() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const location = await Location.getCurrentPositionAsync({});
      setForm(f => ({ ...f, useGPS: true, lat: location.coords.latitude, lng: location.coords.longitude }));
    }
  }

  async function handlePickImage() {
    const result = await ImagePicker.requestCameraPermissionsAsync();
    if (result.granted) {
      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
      });
      if (!pickerResult.canceled && pickerResult.assets[0]) {
        setForm(f => ({ ...f, photoUri: pickerResult.assets[0].uri }));
      }
    }
  }

  function handleSubmit() {
    if (!form.description.trim() || !form.reporterName.trim()) return;
    const newReport: HazardReport = {
      id: `h${Date.now()}`,
      lat: form.lat + (Math.random() - 0.5) * 0.002,
      lng: form.lng + (Math.random() - 0.5) * 0.002,
      type: form.type,
      severity: form.severity,
      description: form.description,
      reporterName: form.reporterName,
      area: form.area,
      status: 'OPEN',
      clusterSize: 1,
      createdAt: new Date().toISOString(),
      photoUrl: form.photoUri,
    };
    const updated = [newReport, ...reports];
    setReports(updated);
    setClusters(buildClusters(updated));
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setShowForm(false); }, 2500);
  }

  const typeInfo = (type: string) => HAZARD_TYPES.find(t => t.value === type) || HAZARD_TYPES[0];

  return (
    <ScrollView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={s.liveRow}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>{T.hazard_live || 'LIVE HAZARD MONITOR'}</Text>
            </View>
            <Text style={s.title}>{T.hazard_title || 'Civic Hazard\nCrowdsource Map'}</Text>
            <Text style={s.subtitle}>{T.hazard_subtitle || 'Citizens geo-tag dangerous hanging wires, potholes, and hazards. AI clusters nearby reports to alert municipalities to critical repair zones.'}</Text>
          </View>
          <Pressable onPress={() => setShowForm(true)} style={s.reportBtn}>
            <Camera size={16} color="white" />
            <Text style={s.reportBtnText}>{T.hazard_report_btn || 'Report a Hazard'}</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: T.hazard_open || 'Open Hazards', value: totalOpen, icon: <AlertTriangle size={14} color="#f87171" /> },
            { label: T.hazard_critical_zones || 'Critical Zones', value: criticalZones, icon: <Zap size={14} color="#fbbf24" /> },
            { label: T.hazard_clusters || 'Clusters Detected', value: clusters.length, icon: <Layers size={14} color="#4ade80" /> },
          ].map(({ label, value, icon }) => (
            <View key={label} style={s.statCard}>
              <View style={s.statCardRow}>
                {icon}
                <Text style={s.statValue}>{value}</Text>
              </View>
              <Text style={s.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={s.body}>
        {/* Filter */}
        <View style={s.filterRow}>
          <Filter size={14} color="#9ca3af" />
          <Text style={s.filterText}>{T.hazard_filter || 'Filter:'}</Text>
        </View>

        {/* India Map WebView */}
        <View style={s.mapContainer}>
          <View style={[s.mapInner, { height: 380 }]}>
            <WebView
              originWhitelist={['*']}
              source={{ html: generateMapHtml(visibleClusters) }}
              style={{ flex: 1, backgroundColor: '#0f172a' }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'select_cluster') {
                    const matched = clusters.find(c => c.id === data.id);
                    if (matched) {
                      setSelectedCluster(matched);
                    }
                  }
                } catch (e) {
                  console.error('WebView onMessage error:', e);
                }
              }}
            />
          </View>

          {/* Legend */}
          <View style={s.legendRow}>
            {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => (
              <View key={sev} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: SEV_COLOR[sev] }]} />
                <Text style={s.legendText}>{sev}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Selected Cluster Details */}
        {selectedCluster && (
          <View style={s.clusterDetail}>
            <View style={s.clusterDetailHeader}>
              <View>
                <Text style={s.clusterDetailTitle}>{typeInfo(selectedCluster.type).labelKey ? T[typeInfo(selectedCluster.type).labelKey] : selectedCluster.type} Cluster</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <MapPin size={11} color="#9ca3af" />
                  <Text style={{ color: '#9ca3af', fontSize: 13 }}>{selectedCluster.area}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.sevBadge, { backgroundColor: SEV_BG[selectedCluster.severity] }]}>
                  <Text style={[s.sevBadgeText, { color: SEV_TEXT[selectedCluster.severity] }]}>{selectedCluster.severity}</Text>
                </View>
                <Pressable onPress={() => setSelectedCluster(null)}>
                  <X size={18} color="#6b7280" />
                </Pressable>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {selectedCluster.reports.slice(0, 3).map(r => (
                <View key={r.id} style={s.reportCard}>
                  <Text style={s.reportCardText}>{r.description}</Text>
                  <View style={s.reportCardMeta}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Users size={10} color="#6b7280" />
                      <Text style={s.reportCardMetaText}>{r.reporterName}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} color="#6b7280" />
                      <Text style={s.reportCardMetaText}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Critical Repair Zones */}
        <View style={s.zonesContainer}>
          <View style={s.zonesHeader}>
            <TrendingUp size={16} color="#f87171" />
            <Text style={s.zonesHeaderText}>{T.hazard_critical_zones_title || 'Critical Repair Zones'}</Text>
          </View>
          {[...clusters]
            .sort((a, b) => {
              const ord: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
              return (ord[b.severity] - ord[a.severity]) || b.count - a.count;
            })
            .slice(0, 4)
            .map((c, i) => {
              const ti = typeInfo(c.type);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedCluster(c)}
                  style={s.zoneRow}
                >
                  <View style={s.zoneIndex}>
                    <Text style={s.zoneIndexText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {ti.icon}
                      <Text style={s.zoneName}>{c.area}</Text>
                    </View>
                    <Text style={s.zoneReports}>{c.count} reports</Text>
                  </View>
                  <View style={[s.sevBadge, { backgroundColor: SEV_BG[c.severity] }]}>
                    <Text style={[s.sevBadgeText, { color: SEV_TEXT[c.severity] }]}>{c.severity}</Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      </View>

      {/* Report Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{T.hazard_report_title || 'Report a Hazard'}</Text>
                <Text style={s.modalSubtitle}>{T.hazard_report_desc || 'Help keep your community safe'}</Text>
              </View>
              <Pressable onPress={() => setShowForm(false)}>
                <X size={20} color="#6b7280" />
              </Pressable>
            </View>

            {submitted ? (
              <View style={s.submittedView}>
                <CheckCircle size={48} color="#4ade80" />
                <Text style={s.submittedTitle}>{T.hazard_reported || 'Hazard Reported!'}</Text>
                <Text style={s.submittedMsg}>{T.hazard_reported_msg || 'Thank you for keeping your community safe.'}</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1, padding: 20 }}>
                <Text style={s.formLabel}>{T.hazard_type_label || 'Hazard Type'} *</Text>
                <View style={s.formChipRow}>
                  {HAZARD_TYPES.map(t => (
                    <Pressable
                      key={t.value}
                      onPress={() => setForm(f => ({ ...f, type: t.value as HazardReport['type'] }))}
                      style={[s.formChip, form.type === t.value ? s.formChipActive : s.formChipInactive]}
                    >
                      {t.icon}
                      <Text style={[s.formChipText, form.type === t.value ? s.formChipTextActive : s.formChipTextInactive]}>
                        {T[t.labelKey] || t.value}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={s.formLabel}>{T.hazard_severity_label || 'Severity Level'} *</Text>
                <View style={s.sevChipRow}>
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(sev => (
                    <Pressable
                      key={sev}
                      onPress={() => setForm(f => ({ ...f, severity: sev }))}
                      style={[s.sevChip, { backgroundColor: form.severity === sev ? SEV_BG[sev] : '#1f2937', borderColor: form.severity === sev ? SEV_COLOR[sev] : '#374151' }]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: form.severity === sev ? SEV_TEXT[sev] : '#9ca3af' }}>{sev}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={s.formLabel}>{T.hazard_desc_label || 'Description'} *</Text>
                <TextInput
                  value={form.description}
                  onChangeText={description => setForm(f => ({ ...f, description }))}
                  placeholder={T.hazard_desc_placeholder || 'Describe the hazard...'}
                  multiline
                  numberOfLines={3}
                  style={s.formTextArea}
                  placeholderTextColor="#6b7280"
                />

                <Text style={s.formLabel}>{T.hazard_name_label || 'Your Name'} *</Text>
                <TextInput
                  value={form.reporterName}
                  onChangeText={reporterName => setForm(f => ({ ...f, reporterName }))}
                  placeholder={T.hazard_name_placeholder || 'Enter your name'}
                  style={s.formInput}
                  placeholderTextColor="#6b7280"
                />

                <Pressable
                  onPress={handleGetGPS}
                  style={[s.gpsBtn, form.useGPS ? s.gpsBtnActive : s.gpsBtnInactive]}
                >
                  <MapPin size={14} color={form.useGPS ? '#4ade80' : '#9ca3af'} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: form.useGPS ? '#4ade80' : '#d1d5db' }}>
                    {form.useGPS ? `GPS: ${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}` : (T.hazard_use_gps || 'Use GPS Location')}
                  </Text>
                </Pressable>

                <Text style={s.formLabel}>{T.hazard_photo_label || 'Photo Evidence'}</Text>
                <Pressable onPress={handlePickImage} style={s.photoUpload}>
                  {form.photoUri ? (
                    <Image source={{ uri: form.photoUri }} style={{ width: '100%', height: 128, borderRadius: 12 }} resizeMode="cover" />
                  ) : (
                    <>
                      <Upload size={20} color="#6b7280" />
                      <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 8 }}>{T.hazard_upload_photo || 'Tap to capture photo'}</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleSubmit}
                  disabled={!form.description.trim() || !form.reporterName.trim()}
                  style={[s.submitBtn, (!form.description.trim() || !form.reporterName.trim()) ? s.submitBtnDisabled : s.submitBtnActive]}
                >
                  <Camera size={16} color="white" />
                  <Text style={s.submitBtnText}>{T.hazard_submit || 'Submit Report'}</Text>
                </Pressable>

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#f87171',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#dc2626',
    borderRadius: 12,
  },
  reportBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  body: {
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  filterText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  mapContainer: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  mapInner: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#9ca3af',
    fontSize: 11,
  },
  clusterDetail: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  clusterDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  clusterDetailTitle: {
    fontWeight: '700',
    color: '#ffffff',
    fontSize: 16,
  },
  sevBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  sevBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  reportCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
  },
  reportCardText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  reportCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  reportCardMetaText: {
    fontSize: 11,
    color: '#6b7280',
  },
  zonesContainer: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  zonesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  zonesHeaderText: {
    fontWeight: '700',
    color: '#ffffff',
    fontSize: 15,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  zoneIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneIndexText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  zoneName: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
  },
  zoneReports: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  submittedView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  submittedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 16,
  },
  submittedMsg: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  formChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  formChipActive: {
    borderColor: '#ef4444',
    backgroundColor: '#2a0a0a',
  },
  formChipInactive: {
    borderColor: '#374151',
    backgroundColor: '#0f172a',
  },
  formChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  formChipTextActive: {
    color: '#fca5a5',
  },
  formChipTextInactive: {
    color: '#d1d5db',
  },
  sevChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sevChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  formTextArea: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 13,
    marginBottom: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  formInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#374151',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 13,
    marginBottom: 16,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  gpsBtnActive: {
    backgroundColor: '#052e16',
    borderColor: '#166534',
  },
  gpsBtnInactive: {
    backgroundColor: '#0f172a',
    borderColor: '#374151',
  },
  photoUpload: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#374151',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitBtnActive: {
    backgroundColor: '#dc2626',
  },
  submitBtnDisabled: {
    backgroundColor: '#374151',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
