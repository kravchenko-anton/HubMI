import type { ComponentType } from 'react'
import { TurboModuleRegistry } from 'react-native'

function hasMapLibreNative() {
  try {
    return TurboModuleRegistry.get('MLRNCameraModule') != null
  } catch {
    return false
  }
}

// Native MapLibre registers its modules at import time, which crashes Expo Go.
// iOS Expo Go uses the WebView map. A development build keeps native MapLibre.
export const CityMap: ComponentType = hasMapLibreNative()
  ? require('@/components/city-map').CityMap
  : require('@/components/city-map-webview').CityMap
