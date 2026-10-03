import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSharedValue } from 'react-native-reanimated'

import type { Issue } from '@/api/issues'
import { CityMap } from '@/components/city-map-view'
import { MapBottomSheet } from '@/components/map-bottom-sheet'
import { MapReportButton } from '@/components/map-report-button'
import { ReportLocationPin } from '@/components/report-location-pin'
import { useMapIssues } from '@/hooks/use-map-issues'
import { useMapSheetStore } from '@/stores/map-sheet-store'

const EMPTY_ISSUES: Issue[] = []

export default function HomeScreen() {
  const { height } = useWindowDimensions()
  const homePosition = useSharedValue(height)
  const modalPosition = useSharedValue(height)
  const pickingLocation = useMapSheetStore((state) => state.content === 'pick-location')
  const { data: issues = EMPTY_ISSUES } = useMapIssues()

  return (
    <View style={styles.container}>
      <CityMap issues={issues} />
      {pickingLocation ? <ReportLocationPin /> : null}
      <MapBottomSheet homePosition={homePosition} modalPosition={modalPosition} />
      <MapReportButton homePosition={homePosition} modalPosition={modalPosition} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
