import {
  Camera,
  LocationManager,
  Map,
  UserLocation,
  type CameraRef,
} from '@maplibre/maplibre-react-native'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'

import { CITY_ZOOM, KRAKOW_CENTER, OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'
import { useMapViewportStore } from '@/stores/map-viewport-store'

export function CityMap() {
  const cameraRef = useRef<CameraRef>(null)
  const [granted, setGranted] = useState(false)
  const trackingPaused = useMapViewportStore((state) => state.trackingPaused)
  const flyRequest = useMapViewportStore((state) => state.flyRequest)
  const setCenter = useMapViewportStore((state) => state.setCenter)
  const follow = granted && !trackingPaused

  useEffect(() => {
    let cancelled = false

    LocationManager.requestPermissions().then((allowed) => {
      if (!cancelled && allowed) {
        setGranted(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!flyRequest) return
    cameraRef.current?.flyTo({
      center: flyRequest.center,
      zoom: flyRequest.zoom,
      duration: 700,
    })
  }, [flyRequest])

  return (
    <Map
      mapStyle={OPENFREEMAP_STYLE}
      androidView="texture"
      style={styles.map}
      onRegionDidChange={(event) => {
        setCenter(event.nativeEvent.center)
      }}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center: KRAKOW_CENTER,
          zoom: CITY_ZOOM,
        }}
        trackUserLocation={follow ? 'default' : undefined}
        zoom={follow ? USER_ZOOM : undefined}
      />
      {granted ? <UserLocation accuracy animated /> : null}
    </Map>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})
