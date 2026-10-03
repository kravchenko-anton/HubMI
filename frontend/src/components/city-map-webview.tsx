import * as Location from 'expo-location'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import type { Issue } from '@/api/issues'
import { MAPLIBRE_WEB_VERSION, OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'
import { useIssueMarkers } from '@/hooks/use-issue-markers'
import { useSavedMapView, type SavedMapView } from '@/hooks/use-saved-map-view'
import { MARKER_SIZE, type IssueMapMarker } from '@/lib/cluster-issues'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const MAPLIBRE_BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_WEB_VERSION}/dist`

function mapHtml(view: SavedMapView) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${MAPLIBRE_BASE}/maplibre-gl.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #e8e0d0; }
    #map { position: absolute; inset: 0; }
    .hubmi-marker {
      -webkit-appearance: none; appearance: none; outline: none;
      position: relative;
      width: ${MARKER_SIZE}px; height: ${MARKER_SIZE}px; border-radius: ${MARKER_SIZE / 2}px;
      border: 3px solid #fff; padding: 0; margin: 0;
      box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; line-height: 1;
      box-shadow: 0 2px 6px rgba(0,0,0,0.28);
      transition: opacity 180ms ease;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.__pendingUser = null;
    window.__pendingFly = null;
    window.__pendingMarkers = null;
    window.moveToUser = function (lng, lat) { window.__pendingUser = [lng, lat]; };
    window.flyToPoint = function (lng, lat, zoom) { window.__pendingFly = [lng, lat, zoom]; };
    window.setMarkers = function (items) { window.__pendingMarkers = items; };
  </script>
  <script type="module">
    import * as maplibregl from '${MAPLIBRE_BASE}/maplibre-gl.mjs';
    const map = new maplibregl.Map({
      container: 'map',
      style: ${JSON.stringify(OPENFREEMAP_STYLE)},
      center: [${view.center[0]}, ${view.center[1]}],
      zoom: ${view.zoom},
    });
    let userMarker;
    const issueMarkers = new Map();
    const dot = () => {
      const el = document.createElement('div');
      el.style.cssText = 'width:18px;height:18px;border-radius:9px;background:#2F80ED;border:3px solid #fff;box-shadow:0 0 0 8px rgba(47,128,237,0.28)';
      return el;
    };
    const showUser = (lng, lat) => {
      map.flyTo({ center: [lng, lat], zoom: ${USER_ZOOM} });
      if (userMarker) userMarker.remove();
      userMarker = new maplibregl.Marker({ element: dot() }).setLngLat([lng, lat]).addTo(map);
    };
    const markerKey = (item) => item.kind === 'point' ? 'issue-' + item.id : 'cluster-' + item.id;
    const paintFace = (face, item) => {
      face.__hubmi = item;
      face.style.background = item.color || '#78716C';
      face.textContent = item.emoji || '';
      if (item.kind === 'cluster' && item.count > 1) {
        const badge = document.createElement('span');
        badge.textContent = String(item.count);
        badge.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#1C1C1E;border:2px solid #fff;color:#fff;font-size:10px;font-weight:700;line-height:14px;box-sizing:border-box;font-family:system-ui,sans-serif';
        face.appendChild(badge);
      }
    };
    const fadeIn = (face) => {
      face.style.transition = 'none';
      face.style.opacity = '0';
      requestAnimationFrame(() => {
        face.style.transition = 'opacity 180ms ease';
        requestAnimationFrame(() => { face.style.opacity = '1'; });
      });
    };
    const markerElement = (item) => {
      const root = document.createElement('div');
      const face = document.createElement('button');
      face.type = 'button';
      face.className = 'hubmi-marker';
      paintFace(face, item);
      face.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = face.__hubmi;
        if (!current || !window.ReactNativeWebView) return;
        if (current.kind === 'point') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'open',
            id: current.id,
            lng: current.lng,
            lat: current.lat,
          }));
          return;
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'fly',
          lng: current.lng,
          lat: current.lat,
          zoom: current.expansionZoom,
        }));
      });
      root.appendChild(face);
      return { root, face };
    };
    const postView = () => {
      const center = map.getCenter();
      const bounds = map.getBounds();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'view',
          lng: center.lng,
          lat: center.lat,
          zoom: map.getZoom(),
          minLng: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLng: bounds.getEast(),
          maxLat: bounds.getNorth(),
        }));
      }
    };
    window.moveToUser = (lng, lat) => {
      if (map.loaded()) showUser(lng, lat);
      else map.once('load', () => showUser(lng, lat));
    };
    window.flyToPoint = (lng, lat, zoom) => {
      const go = () => map.flyTo({ center: [lng, lat], zoom, duration: 700 });
      if (map.loaded()) go();
      else map.once('load', go);
    };
    window.setMarkers = (items) => {
      const next = new Map((items || []).map((item) => [markerKey(item), item]));
      next.forEach((item, key) => {
        const pose = [item.lng, item.lat, item.offsetX || 0, item.offsetY || 0, item.emoji, item.count || 1].join(',');
        const existing = issueMarkers.get(key);
        if (existing) {
          existing.marker.setLngLat([item.lng, item.lat]);
          existing.marker.setOffset([item.offsetX || 0, item.offsetY || 0]);
          if (existing.pose !== pose) {
            paintFace(existing.face, item);
            existing.face.style.opacity = '1';
            existing.pose = pose;
          } else {
            existing.face.__hubmi = item;
          }
          return;
        }
        const parts = markerElement(item);
        const marker = new maplibregl.Marker({ element: parts.root, anchor: 'center' })
          .setLngLat([item.lng, item.lat])
          .setOffset([item.offsetX || 0, item.offsetY || 0])
          .addTo(map);
        issueMarkers.set(key, { marker, face: parts.face, pose });
        fadeIn(parts.face);
      });
      issueMarkers.forEach((handle, key) => {
        if (next.has(key)) return;
        handle.face.style.opacity = '0';
        issueMarkers.delete(key);
        setTimeout(() => handle.marker.remove(), 320);
      });
    };
    map.on('moveend', postView);
    map.on('load', () => {
      map.resize();
      if (window.__pendingMarkers) window.setMarkers(window.__pendingMarkers);
      if (window.__pendingUser) window.moveToUser(window.__pendingUser[0], window.__pendingUser[1]);
      if (window.__pendingFly) window.flyToPoint(window.__pendingFly[0], window.__pendingFly[1], window.__pendingFly[2]);
      postView();
    });
  </script>
</body>
</html>`
}

export function CityMap({ issues }: { issues: Issue[] }) {
  const webViewRef = useRef<WebView>(null)
  const issuesRef = useRef(issues)
  const coords = useRef<[number, number] | null>(null)
  const flyRequest = useMapViewportStore((state) => state.flyRequest)
  const markers = useIssueMarkers(issues)
  const savedView = useSavedMapView()
  const html = useMemo(() => (savedView ? mapHtml(savedView) : null), [savedView])

  useEffect(() => {
    issuesRef.current = issues
  }, [issues])

  const pushMarkers = useCallback((next: IssueMapMarker[]) => {
    const payload = JSON.stringify(next)
    webViewRef.current?.injectJavaScript(`window.setMarkers(${payload}); true;`)
  }, [])

  useEffect(() => {
    pushMarkers(markers)
  }, [markers, pushMarkers])

  const pushLocation = useCallback((longitude: number, latitude: number) => {
    coords.current = [longitude, latitude]
    webViewRef.current?.injectJavaScript(`window.moveToUser(${longitude}, ${latitude}); true;`)
  }, [])

  const pushFly = useCallback((longitude: number, latitude: number, zoom: number) => {
    webViewRef.current?.injectJavaScript(`window.flyToPoint(${longitude}, ${latitude}, ${zoom}); true;`)
  }, [])

  useEffect(() => {
    let cancelled = false

    Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
      if (cancelled || status !== 'granted') return
      const position = await Location.getCurrentPositionAsync({})
      if (cancelled) return
      pushLocation(position.coords.longitude, position.coords.latitude)
    })

    return () => {
      cancelled = true
    }
  }, [pushLocation])

  useEffect(() => {
    if (!flyRequest) return
    const [longitude, latitude] = flyRequest.center
    pushFly(longitude, latitude, flyRequest.zoom)
  }, [flyRequest, pushFly])

  if (!html) {
    return <View style={styles.map} />
  }

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html, baseUrl: `${MAPLIBRE_BASE}/` }}
      style={styles.map}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      contentInsetAdjustmentBehavior="never"
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data) as {
            type?: string
            id?: number
            lng?: number
            lat?: number
            zoom?: number
            minLng?: number
            minLat?: number
            maxLng?: number
            maxLat?: number
          }
          if (data.type === 'open' && typeof data.id === 'number') {
            const issue = issuesRef.current.find((item) => item.id === data.id)
            if (issue) {
              useMapSheetStore.getState().openIssue(issue)
              return
            }
            if (typeof data.lng === 'number' && typeof data.lat === 'number') {
              useMapViewportStore.getState().flyTo([data.lng, data.lat])
            }
            return
          }
          if (data.type === 'fly' && typeof data.lng === 'number' && typeof data.lat === 'number') {
            useMapViewportStore.getState().flyTo(
              [data.lng, data.lat],
              typeof data.zoom === 'number' ? data.zoom : undefined,
            )
            return
          }
          if (
            typeof data.lng !== 'number' ||
            typeof data.lat !== 'number' ||
            typeof data.zoom !== 'number' ||
            typeof data.minLng !== 'number' ||
            typeof data.minLat !== 'number' ||
            typeof data.maxLng !== 'number' ||
            typeof data.maxLat !== 'number'
          ) {
            return
          }
          useMapViewportStore.getState().setView({
            center: [data.lng, data.lat],
            zoom: data.zoom,
            bounds: {
              minLng: data.minLng,
              minLat: data.minLat,
              maxLng: data.maxLng,
              maxLat: data.maxLat,
            },
          })
        } catch {
          // Map messages are JSON view state. Ignore anything else.
        }
      }}
      onLoadEnd={() => {
        pushMarkers(markers)
        const pending = coords.current
        if (pending) {
          webViewRef.current?.injectJavaScript(`window.moveToUser(${pending[0]}, ${pending[1]}); true;`)
        }
        const fly = useMapViewportStore.getState().flyRequest
        if (fly) {
          webViewRef.current?.injectJavaScript(
            `window.flyToPoint(${fly.center[0]}, ${fly.center[1]}, ${fly.zoom}); true;`,
          )
        }
      }}
    />
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    backgroundColor: '#e8e0d0',
  },
})
