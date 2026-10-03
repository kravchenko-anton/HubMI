import * as Location from 'expo-location'
import { useCallback, useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

import { CITY_ZOOM, KRAKOW_CENTER, MAPLIBRE_WEB_VERSION, OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'

const MAPLIBRE_BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_WEB_VERSION}/dist`

function mapHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${MAPLIBRE_BASE}/maplibre-gl.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #e8e0d0; }
    #map { position: absolute; inset: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.__pendingUser = null;
    window.moveToUser = function (lng, lat) { window.__pendingUser = [lng, lat]; };
  </script>
  <script type="module">
    import * as maplibregl from '${MAPLIBRE_BASE}/maplibre-gl.mjs';
    const map = new maplibregl.Map({
      container: 'map',
      style: ${JSON.stringify(OPENFREEMAP_STYLE)},
      center: [${KRAKOW_CENTER[0]}, ${KRAKOW_CENTER[1]}],
      zoom: ${CITY_ZOOM},
    });
    let marker;
    const dot = () => {
      const el = document.createElement('div');
      el.style.cssText = 'width:18px;height:18px;border-radius:9px;background:#2F80ED;border:3px solid #fff;box-shadow:0 0 0 8px rgba(47,128,237,0.28)';
      return el;
    };
    const showUser = (lng, lat) => {
      map.flyTo({ center: [lng, lat], zoom: ${USER_ZOOM} });
      if (marker) marker.remove();
      marker = new maplibregl.Marker({ element: dot() }).setLngLat([lng, lat]).addTo(map);
    };
    window.moveToUser = (lng, lat) => {
      if (map.loaded()) showUser(lng, lat);
      else map.once('load', () => showUser(lng, lat));
    };
    map.on('load', () => {
      map.resize();
      if (window.__pendingUser) window.moveToUser(window.__pendingUser[0], window.__pendingUser[1]);
    });
  </script>
</body>
</html>`
}

export function CityMap() {
  const webViewRef = useRef<WebView>(null)
  const coords = useRef<[number, number] | null>(null)

  const pushLocation = useCallback((longitude: number, latitude: number) => {
    coords.current = [longitude, latitude]
    webViewRef.current?.injectJavaScript(`window.moveToUser(${longitude}, ${latitude}); true;`)
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

  return (
    <WebView
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html: mapHtml(), baseUrl: `${MAPLIBRE_BASE}/` }}
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
      onLoadEnd={() => {
        const pending = coords.current
        if (!pending) return
        webViewRef.current?.injectJavaScript(`window.moveToUser(${pending[0]}, ${pending[1]}); true;`)
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
