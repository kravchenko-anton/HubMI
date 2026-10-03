import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { CityMap } from '@/components/city-map-view'
import { MapBottomSheet } from '@/components/map-bottom-sheet'
import { MapReportButton } from '@/components/map-report-button'

export default function HomeScreen() {
  const { height } = useWindowDimensions()
  const sheetPosition = useSharedValue(height)

  return (
    <View style={styles.container}>
      <CityMap />
      <MapBottomSheet animatedPosition={sheetPosition} />
      <MapReportButton animatedPosition={sheetPosition} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
