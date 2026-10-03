import {
  Camera,
  LocationManager,
  Map,
  Marker,
  UserLocation,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native'
import { StyleSheet, Text, View } from 'react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import type { Issue } from '@/api/issues'
import { OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'
import { useIssueMarkers } from '@/hooks/use-issue-markers'
import { useSavedMapView } from '@/hooks/use-saved-map-view'
import { MARKER_SIZE, type IssueMapMarker } from '@/lib/cluster-issues'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore, type MapView } from '@/stores/map-viewport-store'

function viewFromNative(view: {
  center: MapView['center']
  zoom: number
  bounds: [number, number, number, number]
}): MapView {
  const { center, zoom, bounds } = view
  return {
    center,
    zoom,
    bounds: {
      minLng: bounds[0],
      minLat: bounds[1],
      maxLng: bounds[2],
      maxLat: bounds[3],
    },
  }
}

function markerKey(marker: IssueMapMarker) {
  return marker.kind === 'point' ? `issue-${marker.id}` : `cluster-${marker.id}`
}

function focusMarker(marker: IssueMapMarker, issues: Issue[]) {
  if (marker.kind === 'point') {
    const issue = issues.find((item) => item.id === marker.id)
    if (issue) {
      useMapSheetStore.getState().openIssue(issue)
      return
    }
  }
  useMapViewportStore.getState().flyTo(
    [marker.lng, marker.lat],
    marker.kind === 'cluster' ? marker.expansionZoom : undefined,
  )
}

function RisingMarker({ marker }: { marker: IssueMapMarker }) {
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180 })
  }, [opacity])

  const motion = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[styles.shadow, motion]} collapsable={false}>
      <View style={[styles.bubble, { backgroundColor: marker.color }]}>
        <Text style={styles.emoji} allowFontScaling={false}>
          {marker.emoji}
        </Text>
      </View>
      {marker.kind === 'cluster' && marker.count > 1 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} allowFontScaling={false}>
            {marker.count}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

export function CityMap({ issues }: { issues: Issue[] }) {
  const mapRef = useRef<MapRef>(null)
  const cameraRef = useRef<CameraRef>(null)
  const [granted, setGranted] = useState(false)
  const trackingPaused = useMapViewportStore((state) => state.trackingPaused)
  const flyRequest = useMapViewportStore((state) => state.flyRequest)
  const setView = useMapViewportStore((state) => state.setView)
  const markers = useIssueMarkers(issues)
  const savedView = useSavedMapView()
  const initialViewState = useMemo(
    () => (savedView ? { center: savedView.center, zoom: savedView.zoom } : null),
    [savedView],
  )
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
    if (!flyRequest || !savedView) return
    cameraRef.current?.flyTo({
      center: flyRequest.center,
      zoom: flyRequest.zoom,
      duration: 700,
      easing: 'fly',
    })
  }, [flyRequest, savedView])

  if (!initialViewState) {
    return <View style={styles.map} />
  }

  return (
    <Map
      ref={mapRef}
      mapStyle={OPENFREEMAP_STYLE}
      androidView="texture"
      style={styles.map}
      onDidFinishLoadingMap={() => {
        mapRef.current?.getViewState().then(
          (view) => {
            setView(viewFromNative(view))
          },
          () => {
            // The next region change publishes the same view.
          },
        )
      }}
      onRegionDidChange={(event) => {
        setView(viewFromNative(event.nativeEvent))
      }}>
      <Camera
        ref={cameraRef}
        initialViewState={initialViewState}
        trackUserLocation={follow ? 'default' : undefined}
        zoom={follow ? USER_ZOOM : undefined}
      />
      {markers.map((marker) => (
        <Marker
          key={markerKey(marker)}
          id={markerKey(marker)}
          lngLat={[marker.lng, marker.lat]}
          anchor="center"
          offset={[marker.offsetX, marker.offsetY]}
          onPress={() => focusMarker(marker, issues)}>
          <RisingMarker marker={marker} />
        </Marker>
      ))}
      {granted ? <UserLocation accuracy animated /> : null}
    </Map>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  shadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 3,
  },
  bubble: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    includeFontPadding: false,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#1C1C1E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
})
