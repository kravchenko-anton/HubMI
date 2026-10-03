import type { ComponentType } from 'react'
import { TurboModuleRegistry } from 'react-native'

import type { Issue } from '@/api/issues'

export type CityMapProps = {
  issues: Issue[]
}

function hasMapLibreNative() {
  try {
    return TurboModuleRegistry.get('MLRNCameraModule') != null
  } catch {
    return false
  }
}

// Native MapLibre registers its modules at import time, which crashes Expo Go.
// iOS Expo Go uses the WebView map. A development build keeps native MapLibre.
export const CityMap: ComponentType<CityMapProps> = hasMapLibreNative()
  ? require('@/components/city-map').CityMap
  : require('@/components/city-map-webview').CityMap
