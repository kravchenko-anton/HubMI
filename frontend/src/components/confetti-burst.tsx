'use no memo'

import { useEffect, useMemo } from 'react'
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { ConfettiHost } from '@/components/confetti-host'
import { useConfettiStore, type ConfettiOrigin } from '@/stores/confetti-store'

const COLORS = [
  '#1F8A4C',
  '#34C759',
  '#F5C518',
  '#FF9F0A',
  '#2F80ED',
  '#FF4D8D',
  '#BF5AF2',
  '#FF453A',
  '#64D2FF',
]

const PIECE_COUNT = 64

type Piece = {
  x: number
  delay: number
  duration: number
  drift: number
  flutter: number
  wobble: number
  spin: number
  w: number
  h: number
  color: string
  radius: number
  vy: number
  vx: number
  gravity: number
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makePieces(origin: ConfettiOrigin, seed: number): Piece[] {
  const rand = mulberry32(seed + (origin === 'top' ? 1 : 97))
  return Array.from({ length: PIECE_COUNT }, () => {
    const w = 8 + rand() * 8
    const tall = rand() > 0.28
    const h = tall ? w * (1.4 + rand() * 1.1) : w * (0.55 + rand() * 0.4)
    const color = COLORS[Math.floor(rand() * COLORS.length)] ?? COLORS[0]
    return {
      x: rand(),
      delay: origin === 'top' ? rand() * 280 : rand() * 140,
      duration: origin === 'top' ? 1100 + rand() * 400 : 1400 + rand() * 500,
      drift: (rand() - 0.5) * 90,
      flutter: 1.5 + rand() * 2.5,
      wobble: 12 + rand() * 18,
      spin: (rand() - 0.5) * 640,
      w,
      h,
      color,
      radius: rand() > 0.72 ? w / 2 : 2,
      vy: 900 + rand() * 700,
      vx: (rand() - 0.5) * 180,
      gravity: 40 + rand() * 80,
    }
  })
}

function ConfettiPiece({
  origin,
  width,
  height,
  piece,
}: {
  origin: ConfettiOrigin
  width: number
  height: number
  piece: Piece
}) {
  const progress = useSharedValue(0)

  useEffect(() => {
    const duration = Math.max(1, Math.round(piece.duration))
    const timer = setTimeout(() => {
      progress.value = withTiming(1, { duration, easing: Easing.linear })
    }, Math.round(piece.delay))
    return () => clearTimeout(timer)
  }, [piece.delay, piece.duration, progress])

  const style = useAnimatedStyle(() => {
    const t = progress.value
    const fade = t > 0.78 ? Math.max(0, (1 - t) / 0.22) : t === 0 ? 0 : 1
    if (origin === 'top') {
      const fall = t * 0.72 + t * t * 0.28
      const sway = Math.sin(t * piece.flutter * Math.PI * 2) * piece.wobble
      return {
        opacity: fade,
        transform: [
          { translateX: piece.x * width + piece.drift * t + sway },
          { translateY: -24 + (height + 48) * fall },
          { rotate: `${piece.spin * t}deg` },
        ],
      }
    }

    const time = (t * piece.duration) / 1000
    const rise = piece.vy * time - 0.5 * piece.gravity * time * time
    return {
      opacity: fade,
      transform: [
        { translateX: piece.x * width + piece.vx * time },
        { translateY: height + 12 - rise },
        { rotate: `${piece.spin * t}deg` },
      ],
    }
  })

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: piece.w,
          height: piece.h,
          borderRadius: piece.radius,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  )
}

export function ConfettiBurst() {
  const id = useConfettiStore((state) => state.id)
  const origin = useConfettiStore((state) => state.origin)
  const { width, height } = useWindowDimensions()
  const pieces = useMemo(() => (origin ? makePieces(origin, id) : []), [origin, id])

  useEffect(() => {
    if (id === 0) return
    const timer = setTimeout(() => useConfettiStore.getState().stop(id), 2500)
    return () => clearTimeout(timer)
  }, [id])

  if (!origin || width <= 0 || height <= 0) return null

  return (
    <ConfettiHost>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.layer, { width, height }]}>
        {pieces.map((piece, index) => (
          <ConfettiPiece
            key={`${id}-${index}`}
            origin={origin}
            width={width}
            height={height}
            piece={piece}
          />
        ))}
      </View>
    </ConfettiHost>
  )
}

const styles = StyleSheet.create({
  layer: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    left: 0,
    top: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  piece: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
})
