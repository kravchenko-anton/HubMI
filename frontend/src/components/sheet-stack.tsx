import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react'
import { Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { sheetMotion, useMapSheetStore, type MapSheetContent } from '@/stores/map-sheet-store'

export type SheetPage = 'issue' | 'reports' | 'compose'

const NAV_SPRING = { damping: 22, stiffness: 240, mass: 0.8 }
const EDGE_WIDTH = 24
const PARALLAX = 0.3
const HANDLE_PADDING_TOP = 8
const HANDLE_BAR = 4
const HANDLE_PADDING_BOTTOM = 6

/** Handle block above a stacked page. Sheet height is page content plus this. */
export const SHEET_CHROME = HANDLE_PADDING_TOP + HANDLE_BAR + HANDLE_PADDING_BOTTOM

type Motion = 'idle' | 'push' | 'pop'

export function overlayPages(stack: MapSheetContent[]): SheetPage[] {
  const pages: SheetPage[] = []
  for (const name of stack) {
    if (name === 'issue' || name === 'reports' || name === 'compose') pages.push(name)
  }
  return pages
}

function isPrefix(shorter: SheetPage[], longer: SheetPage[]) {
  return shorter.every((page, index) => longer[index] === page)
}

function transition(current: SheetPage[], next: SheetPage[]): Motion | 'replace' {
  if (next.length > current.length && isPrefix(current, next)) return 'push'
  if (next.length < current.length && next.length > 0 && isPrefix(next, current)) return 'pop'
  return 'replace'
}

function edgePan(
  translateX: SharedValue<number>,
  slideCard: SharedValue<number>,
  pageCount: SharedValue<number>,
  widthSv: SharedValue<number>,
  onPop: () => void,
) {
  return Gesture.Pan()
    .activeOffsetX(8)
    .failOffsetY([-16, 16])
    .onStart(() => {
      cancelAnimation(translateX)
      slideCard.value = pageCount.value > 1 ? 0 : 1
    })
    .onUpdate((event) => {
      translateX.value = Math.max(0, event.translationX)
    })
    .onEnd((event) => {
      const distance = widthSv.value
      const shouldPop = translateX.value > distance * 0.3 || event.velocityX > 800
      if (shouldPop) {
        translateX.value = withSpring(distance, NAV_SPRING, (finished) => {
          if (finished) runOnJS(onPop)()
        })
        return
      }
      translateX.value = withSpring(0, NAV_SPRING)
    })
}

export function dockPan(dragY: SharedValue<number>, onCancel: () => void) {
  return Gesture.Pan()
    .activeOffsetY(14)
    .failOffsetX([-20, 20])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY)
    })
    .onEnd((event) => {
      if (dragY.value > 56 || event.velocityY > 800) {
        dragY.value = withTiming(0, { duration: 160 })
        runOnJS(onCancel)()
        return
      }
      dragY.value = withSpring(0, NAV_SPRING)
    })
}

export function SheetStack({
  renderPage,
  onSettledPage,
}: {
  renderPage: (page: SheetPage) => ReactNode
  onSettledPage?: (page: SheetPage) => void
}) {
  const stack = useMapSheetStore((state) => state.stack)
  const overlay = overlayPages(stack)
  const overlayKey = overlay.join(',')
  const { width } = useWindowDimensions()
  const widthSv = useSharedValue(width)
  const translateX = useSharedValue(0)
  const slideCard = useSharedValue(1)
  const pageCount = useSharedValue(1)
  const [shown, setShown] = useState(overlay)
  const [motion, setMotion] = useState<Motion>('idle')
  const [skipMotion, setSkipMotion] = useState(false)
  const shownKey = shown.join(',')

  if (skipMotion) {
    setSkipMotion(false)
    if (overlay.length > 0 && overlayKey !== shownKey) setShown(overlay)
    if (motion !== 'idle') setMotion('idle')
  } else if (motion === 'idle' && overlay.length > 0 && overlayKey !== shownKey) {
    const kind = transition(shown, overlay)
    if (kind === 'push') {
      setShown(overlay)
      setMotion('push')
    } else if (kind === 'pop') {
      setMotion('pop')
    } else {
      setShown(overlay)
    }
  }

  const finishGesturePop = useCallback(() => {
    setSkipMotion(true)
    const { content, cancelCompose, closeIssue, showHome } = useMapSheetStore.getState()
    if (content === 'compose') {
      Keyboard.dismiss()
      cancelCompose()
      return
    }
    sheetMotion.instantDismiss = true
    if (content === 'issue') closeIssue()
    else showHome()
  }, [])

  const pan = edgePan(translateX, slideCard, pageCount, widthSv, finishGesturePop)

  useLayoutEffect(() => {
    const applyPop = () => {
      const next = overlayPages(useMapSheetStore.getState().stack)
      if (next.length > 0) setShown(next)
      setMotion('idle')
    }

    widthSv.value = width
    pageCount.value = shown.length
    if (shown.length < 2 && motion !== 'pop') slideCard.value = 1

    if (motion === 'push') {
      slideCard.value = 0
      cancelAnimation(translateX)
      translateX.value = width
      translateX.value = withSpring(0, NAV_SPRING, (finished) => {
        if (finished) runOnJS(setMotion)('idle')
      })
      return
    }

    if (motion !== 'pop') return
    slideCard.value = shown.length > 1 ? 0 : 1
    cancelAnimation(translateX)
    translateX.value = withSpring(width, NAV_SPRING, (finished) => {
      if (finished) runOnJS(applyPop)()
    })
  }, [motion, pageCount, shown.length, slideCard, translateX, width, widthSv])

  const top = shown[shown.length - 1]
  const under = shown.length > 1 ? shown[shown.length - 2] : null

  useLayoutEffect(() => {
    if (motion === 'idle' && top) onSettledPage?.(top)
  }, [motion, onSettledPage, top])

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideCard.value * translateX.value }],
  }))
  const topStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - slideCard.value) * translateX.value }],
  }))
  const underStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (1 - slideCard.value) * (-widthSv.value * PARALLAX + translateX.value * PARALLAX),
      },
    ],
  }))

  if (!top) return null

  return (
    <View style={styles.fill}>
      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View style={styles.pages}>
          {under ? (
            <Animated.View pointerEvents="none" style={[styles.under, underStyle]}>
              {renderPage(under)}
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.page, topStyle]}>{renderPage(top)}</Animated.View>
        </View>
        <GestureDetector gesture={pan}>
          <View style={styles.edge} />
        </GestureDetector>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#FEFDFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: HANDLE_PADDING_TOP,
    paddingBottom: HANDLE_PADDING_BOTTOM,
  },
  handle: {
    width: 36,
    height: HANDLE_BAR,
    borderRadius: 2,
    backgroundColor: '#D0CED4',
  },
  pages: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  under: {
    ...StyleSheet.absoluteFill,
  },
  edge: {
    position: 'absolute',
    left: 0,
    top: 52,
    bottom: 0,
    width: EDGE_WIDTH,
    zIndex: 4,
  },
})

export function DockSurface({
  dragY,
  gesture,
  children,
}: {
  dragY: SharedValue<number>
  gesture: ReturnType<typeof Gesture.Pan>
  children: ReactNode
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }))

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, style]}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        {children}
      </Animated.View>
    </GestureDetector>
  )
}
