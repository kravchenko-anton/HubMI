import { SymbolView } from 'expo-symbols'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { REPORT_BUTTON_GAP } from '@/components/map-bottom-sheet'
import { useMapSheetStore } from '@/stores/map-sheet-store'

const BUTTON_SIZE = 52

export function MapReportButton({ animatedPosition }: { animatedPosition: SharedValue<number> }) {
  const insets = useSafeAreaInsets()
  const content = useMapSheetStore((state) => state.content)
  const reportCount = useMapSheetStore((state) => state.reportCount)
  const showReports = useMapSheetStore((state) => state.showReports)
  const showSearch = useMapSheetStore((state) => state.showSearch)
  const reportsOpen = content === 'reports'
  const reportFlow = content === 'compose' || content === 'pick-location'
  const [hidden, setHidden] = useState(false)
  const topInset = insets.top

  const animatedStyle = useAnimatedStyle(() => {
    const top = animatedPosition.value - REPORT_BUTTON_GAP - BUTTON_SIZE
    return {
      top,
      opacity: top < topInset ? 0 : 1,
    }
  })

  useAnimatedReaction(
    () => animatedPosition.value - REPORT_BUTTON_GAP - BUTTON_SIZE < topInset,
    (isHidden, previous) => {
      if (isHidden !== previous) {
        runOnJS(setHidden)(isHidden)
      }
    },
    [topInset],
  )

  if (reportFlow) return null

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      style={[styles.button, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={reportsOpen ? 'Wróć do wyszukiwania' : 'Pokaż ikony'}
        accessibilityState={{ selected: reportsOpen }}
        onPress={reportsOpen ? showSearch : showReports}
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
