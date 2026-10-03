import * as Location from 'expo-location'
import { SymbolView } from 'expo-symbols'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { REPORT_BUTTON_GAP } from '@/components/map-bottom-sheet'
import { USER_ZOOM } from '@/constants/map'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const BUTTON_SIZE = 52
const BUTTON_GAP = 12

async function centerOnUser() {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (permission.status !== 'granted') return
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })
  useMapViewportStore.getState().flyTo(
    [position.coords.longitude, position.coords.latitude],
    USER_ZOOM,
  )
}

export function MapReportButton({
  homePosition,
  modalPosition,
}: {
  homePosition: SharedValue<number>
  modalPosition: SharedValue<number>
}) {
  const animatedPosition = useDerivedValue(() =>
    Math.min(homePosition.value, modalPosition.value),
  )
  const insets = useSafeAreaInsets()
  const content = useMapSheetStore((state) => state.content)
  const reportCount = useMapSheetStore((state) => state.reportCount)
  const showReports = useMapSheetStore((state) => state.showReports)
  const showHome = useMapSheetStore((state) => state.showHome)
  const reportsOpen = content === 'reports'
  const showReport = content !== 'compose' && content !== 'pick-location'
  const [reportHidden, setReportHidden] = useState(false)
  const [locateHidden, setLocateHidden] = useState(false)
  const [locating, setLocating] = useState(false)
  const topInset = insets.top

  const reportStyle = useAnimatedStyle(() => {
    const top = animatedPosition.value - REPORT_BUTTON_GAP - BUTTON_SIZE
    return {
      top,
      opacity: top < topInset ? 0 : 1,
    }
  })

  const locateStyle = useAnimatedStyle(() => {
    const reportTop = animatedPosition.value - REPORT_BUTTON_GAP - BUTTON_SIZE
    const top = showReport ? reportTop - BUTTON_GAP - BUTTON_SIZE : reportTop
    return {
      top,
      opacity: top < topInset ? 0 : 1,
    }
  })

  useAnimatedReaction(
    () => animatedPosition.value - REPORT_BUTTON_GAP - BUTTON_SIZE < topInset,
    (isHidden, previous) => {
      if (isHidden !== previous) {
        runOnJS(setReportHidden)(isHidden)
      }
    },
    [topInset],
  )

  useAnimatedReaction(
    () => {
      const reportTop = animatedPosition.value - REPORT_BUTTON_GAP - BUTTON_SIZE
      const top = showReport ? reportTop - BUTTON_GAP - BUTTON_SIZE : reportTop
      return top < topInset
    },
    (isHidden, previous) => {
      if (isHidden !== previous) {
        runOnJS(setLocateHidden)(isHidden)
      }
    },
    [topInset, showReport],
  )

  const goToUser = () => {
    if (locating) return
    setLocating(true)
    centerOnUser().finally(() => setLocating(false))
  }

  return (
    <>
      <Animated.View
        pointerEvents={locateHidden ? 'none' : 'box-none'}
        style={[styles.button, locateStyle]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show my location"
          disabled={locating}
          onPress={goToUser}
          style={({ pressed }) => [styles.hit, (pressed || locating) && styles.pressed]}>
          <SymbolView
            name={{
              ios: 'location.fill',
              android: 'my_location',
              web: 'my_location',
            }}
            size={26}
            tintColor="#2F80ED"
          />
        </Pressable>
      </Animated.View>
      {showReport ? (
        <Animated.View
          pointerEvents={reportHidden ? 'none' : 'box-none'}
          style={[styles.button, reportStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={reportsOpen ? 'Back to list' : 'Show categories'}
            accessibilityState={{ selected: reportsOpen }}
            onPress={reportsOpen ? showHome : showReports}
            style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
            <SymbolView
              name={{
                ios: 'exclamationmark.triangle.fill',
                android: 'warning',
                web: 'warning',
              }}
              size={26}
              tintColor="#F5C518"
            />
            {reportCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{reportCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E4EC',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
  hit: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: '#3A3A3C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
})
