import { useEffect, useState } from 'react'
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

const SPRING = { damping: 18, stiffness: 320 }

export function usePressScale(to = 0.98) {
  const [pressed, setPressed] = useState(false)
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withSpring(pressed ? to : 1, SPRING)
  }, [pressed, scale, to])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return {
    style,
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
  }
}
