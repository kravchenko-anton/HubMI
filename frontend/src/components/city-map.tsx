import {
  Camera,
  LocationManager,
  Map,
  UserLocation,
} from '@maplibre/maplibre-react-native'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import { CITY_ZOOM, KRAKOW_CENTER, OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'

export function CityMap() {
  const [followUser, setFollowUser] = useState(false)

  useEffect(() => {
    let cancelled = false

    LocationManager.requestPermissions().then((granted) => {
      if (!cancelled && granted) {
        setFollowUser(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Map mapStyle={OPENFREEMAP_STYLE} androidView="texture" style={styles.map}>
      <Camera
        initialViewState={{
          center: KRAKOW_CENTER,
          zoom: CITY_ZOOM,
        }}
        trackUserLocation={followUser ? 'default' : undefined}
        zoom={followUser ? USER_ZOOM : undefined}
      />
      {followUser ? <UserLocation accuracy animated /> : null}
    </Map>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})
