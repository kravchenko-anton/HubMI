import { focusManager, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import { queryClient } from '@/lib/query-client'

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active')
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange)
    return () => subscription.remove()
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
