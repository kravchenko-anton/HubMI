import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { CITY_ZOOM, KRAKOW_CENTER, MAPLIBRE_WEB_VERSION, OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const MAPLIBRE_BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_WEB_VERSION}/dist`

type WebMap = {
  remove: () => void
  resize: () => void
  loaded: () => boolean
  flyTo: (options: { center: [number, number]; zoom: number }) => void
  getCenter: () => { lng: number; lat: number }
  on: (event: 'load' | 'moveend', handler: () => void) => void
}

type WebMarker = {
  setLngLat: (lngLat: [number, number]) => WebMarker
  addTo: (map: WebMap) => WebMarker
  remove: () => void
}

type MapLibreGL = {
  Map: new (options: {
    container: HTMLElement
    style: string
    center: [number, number]
    zoom: number
  }) => WebMap
  Marker: new (options?: { element?: HTMLElement }) => WebMarker
}

declare global {
  interface Window {
    maplibregl?: MapLibreGL
  }
}

function ensureStylesheet() {
  const id = 'maplibre-gl-css'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `${MAPLIBRE_BASE}/maplibre-gl.css`
  document.head.appendChild(link)
}

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl)

  ensureStylesheet()

  return new Promise<MapLibreGL>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.textContent = `
      import * as maplibregl from '${MAPLIBRE_BASE}/maplibre-gl.mjs';
      window.maplibregl = maplibregl;
      window.dispatchEvent(new Event('hubmi-maplibre-ready'));
    `
    const onReady = () => {
      cleanup()
      if (window.maplibregl) resolve(window.maplibregl)
      else reject(new Error('MapLibre did not load'))
    }
    const onError = () => {
      cleanup()
      reject(new Error('MapLibre failed to load'))
    }
    const cleanup = () => {
      window.removeEventListener('hubmi-maplibre-ready', onReady)
      script.removeEventListener('error', onError)
    }
    window.addEventListener('hubmi-maplibre-ready', onReady)
    script.addEventListener('error', onError)
    document.head.appendChild(script)
  })
}

function userDot() {
  const dot = document.createElement('div')
  dot.style.width = '18px'
  dot.style.height = '18px'
  dot.style.borderRadius = '9px'
  dot.style.background = '#2F80ED'
  dot.style.border = '3px solid #FFFFFF'
  dot.style.boxShadow = '0 0 0 8px rgba(47, 128, 237, 0.28)'
  return dot
}

export function CityMap() {
  const containerRef = useRef<View>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const node = containerRef.current as unknown as HTMLElement | null
    if (!node) return

    let cancelled = false
    let loaded = false
    let map: WebMap | undefined
    let marker: WebMarker | undefined
    let lastFlyId = useMapViewportStore.getState().flyRequest?.id ?? 0

    const publishCenter = () => {
      if (!map) return
      const center = map.getCenter()
      useMapViewportStore.getState().setCenter([center.lng, center.lat])
    }

    const flyToRequest = () => {
      const request = useMapViewportStore.getState().flyRequest
      if (!map || !loaded || !request) return
      map.flyTo({ center: request.center, zoom: request.zoom })
    }

    const unsubscribe = useMapViewportStore.subscribe((state) => {
      const id = state.flyRequest?.id
      if (!id || id === lastFlyId) return
      lastFlyId = id
      flyToRequest()
    })

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled) return
        map = new maplibregl.Map({
          container: node,
          style: OPENFREEMAP_STYLE,
          center: KRAKOW_CENTER,
          zoom: CITY_ZOOM,
        })
        map.on('moveend', publishCenter)
        map.on('load', () => {
          loaded = true
          map?.resize()
          publishCenter()
          flyToRequest()
          if (!navigator.geolocation) return
          navigator.geolocation.getCurrentPosition((position) => {
            if (cancelled || !map) return
            const center: [number, number] = [position.coords.longitude, position.coords.latitude]
            if (useMapViewportStore.getState().trackingPaused) {
              marker = new maplibregl.Marker({ element: userDot() }).setLngLat(center).addTo(map)
              return
            }
            map.flyTo({ center, zoom: USER_ZOOM })
            marker = new maplibregl.Marker({ element: userDot() }).setLngLat(center).addTo(map)
          })
        })
      })
      .catch(() => {
        if (!cancelled) setError('Map failed to load')
      })

    return () => {
      cancelled = true
      unsubscribe()
      marker?.remove()
      map?.remove()
    }
  }, [])

  return (
    <View ref={containerRef} style={styles.map}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  error: {
    margin: 24,
    textAlign: 'center',
    color: '#57534E',
    fontSize: 16,
  },
})
