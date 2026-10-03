import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import { CityMap } from '@/components/city-map-view'
import { MapBottomSheet } from '@/components/map-bottom-sheet'
import { MapReportButton } from '@/components/map-report-button'
import { ReportLocationPin } from '@/components/report-location-pin'
import { useMapSheetStore } from '@/stores/map-sheet-store'

export default function HomeScreen() {
  const { height } = useWindowDimensions()
  const sheetPosition = useSharedValue(height)
  const pickingLocation = useMapSheetStore((state) => state.content === 'pick-location')

  return (
    <View style={styles.container}>
      <CityMap />
      {pickingLocation ? <ReportLocationPin /> : null}
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
