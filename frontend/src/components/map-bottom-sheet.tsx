import BottomSheet, { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { SymbolView } from 'expo-symbols'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IssueDetail } from '@/components/issue-detail'
import { HOME_PEEK, IssueFeed, IssueFeedHeader } from '@/components/issue-feed'
import { PickLocationDock, ReportComposer } from '@/components/report-composer'
import {
  dockPan,
  DockSurface,
  SHEET_CHROME,
  SheetStack,
  type SheetPage,
} from '@/components/sheet-stack'
import { sheetMotion, useMapSheetStore } from '@/stores/map-sheet-store'

const SHEET_BACKGROUND = '#FEFDFF'
const SHEET_CONTENT_PADDING_BOTTOM = 20
const DOCK_BODY = 168
const REPORT_ROW = 72 + 8 + 16 + 22
const REPORTS_BODY = 4 + 36 + 22 + REPORT_ROW * 3
const ISSUE_BODY = 4 + 36 + 12 * 5 + 240 + 34 + 26 + 22 + 52

function keepHeight(current: number, next: number) {
  if (next <= 0 || Math.abs(current - next) < 2) return current
  return next
}

export const REPORT_BUTTON_GAP = 20

const REPORTS = [
  { id: 'light', label: 'Lighting', emoji: '💡', tint: '#FFF4CC' },
  { id: 'road', label: 'Road', emoji: '🚧', tint: '#FFE8D6' },
  { id: 'waste', label: 'Trash', emoji: '🗑️', tint: '#E5F6EC' },
  { id: 'loud', label: 'Noise', emoji: '📢', tint: '#F3E8FF' },
  { id: 'access', label: 'Accessibility', emoji: '♿', tint: '#E8F1FF' },
  { id: 'animals', label: 'Animals', emoji: '🐾', tint: '#FFE8F0' },
  { id: 'vandalism', label: 'Vandalism', emoji: '🎨', tint: '#FDE8F3' },
  { id: 'nature', label: 'Nature', emoji: '🍂', tint: '#E7F6E9' },
  { id: 'other', label: 'Other', emoji: '❓', tint: '#F0EEEA' },
] as const

export function MapBottomSheet({
  homePosition,
  modalPosition,
}: {
  homePosition: SharedValue<number>
  modalPosition: SharedValue<number>
}) {
  const homeRef = useRef<BottomSheet>(null)
  const modalRef = useRef<BottomSheetModal>(null)
  const opened = useRef(false)
  const wasPicking = useRef(false)
  const savedHomeIndex = useRef(1)
  const closedForPick = useRef(false)
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const content = useMapSheetStore((state) => state.content)
  const selectedIssue = useMapSheetStore((state) => state.selectedIssue)
  const picking = content === 'pick-location'
  const paddingBottom = SHEET_CONTENT_PADDING_BOTTOM + insets.bottom
  const dockHeight = DOCK_BODY + insets.bottom
  const [feedHeight, setFeedHeight] = useState(0)
  const [issueHeight, setIssueHeight] = useState(0)
  const [reportsHeight, setReportsHeight] = useState(0)
  const [dockContentHeight, setDockContentHeight] = useState(0)
  const [settledPage, setSettledPage] = useState<SheetPage | null>(null)
  const lastOverlaySnap = useRef(0)
  const onFeedHeight = useCallback((next: number) => {
    setFeedHeight((current) => keepHeight(current, next))
  }, [])
  const onIssueHeight = useCallback((next: number) => {
    setIssueHeight((current) => keepHeight(current, next))
  }, [])
  const onReportsHeight = useCallback((next: number) => {
    setReportsHeight((current) => keepHeight(current, next))
  }, [])
  const onDockHeight = useCallback((next: number) => {
    setDockContentHeight((current) => keepHeight(current, next))
  }, [])
  const onSettledPage = useCallback((page: SheetPage) => {
    const current = useMapSheetStore.getState().content
    if (current === 'home' || current === 'pick-location') return
    setSettledPage(page)
  }, [])
  const sheetContainerHeight = Math.max(windowHeight - insets.top, 0)
  const peek = HOME_PEEK + insets.bottom
  const homeMax = Math.round(sheetContainerHeight * 0.72)
  const homeExpanded =
    feedHeight > 0 ? Math.max(peek, Math.min(homeMax, HOME_PEEK + feedHeight)) : homeMax
  const homeSnapPoints = useMemo(() => [peek, homeExpanded], [peek, homeExpanded])
  const overlayMax = Math.max(Math.round(sheetContainerHeight * 0.9), dockHeight)
  const pageSnap = useCallback(
    (page: SheetPage) => {
      if (page === 'compose') return overlayMax
      const body =
        page === 'reports'
          ? reportsHeight || REPORTS_BODY + paddingBottom
          : issueHeight || ISSUE_BODY + paddingBottom
      return Math.min(overlayMax, body + SHEET_CHROME)
    },
    [issueHeight, overlayMax, paddingBottom, reportsHeight],
  )
  const overlayPage =
    content === 'issue' || content === 'reports' || content === 'compose' ? content : null
  const overlayCandidates = [overlayPage, settledPage].filter(
    (page): page is SheetPage => page != null,
  )
  const resolvedDock = dockContentHeight > 0 ? dockContentHeight + SHEET_CHROME : dockHeight
  const overlaySnap = picking
    ? resolvedDock
    : overlayCandidates.length === 0 || overlayCandidates.some((page) => page === 'compose')
      ? overlayMax
      : Math.max(...overlayCandidates.map(pageSnap))
  if (content !== 'home') lastOverlaySnap.current = overlaySnap
  const modalSnapPoints = useMemo(
    () => [content === 'home' ? lastOverlaySnap.current || overlayMax : overlaySnap],
    [content, overlaySnap],
  )

  const renderPage = useCallback(
    (page: SheetPage) => {
      if (page === 'compose') return <ReportComposer paddingBottom={paddingBottom} />
      if (page === 'issue' && selectedIssue) {
        return (
          <IssueDetail
            key={selectedIssue.id}
            issue={selectedIssue}
            paddingBottom={paddingBottom}
            onContentHeight={onIssueHeight}
          />
        )
      }
      if (page === 'reports') {
        return (
          <BottomSheetView style={styles.content}>
            <View onLayout={(event) => onReportsHeight(event.nativeEvent.layout.height)} style={{ paddingBottom }}>
              <ReportsContent />
            </View>
          </BottomSheetView>
        )
      }
      return null
    },
    [onIssueHeight, onReportsHeight, paddingBottom, selectedIssue],
  )

  useEffect(() => {
    if (content === 'home') setSettledPage(null)
  }, [content])

  useEffect(() => {
    if (content === 'pick-location') {
      closedForPick.current = true
      homeRef.current?.close()
      return
    }
    if (!closedForPick.current) return
    closedForPick.current = false
    homeRef.current?.snapToIndex(savedHomeIndex.current)
  }, [content])

  useEffect(() => {
    if (content === 'home') {
      if (!opened.current) return
      const instant = sheetMotion.instantDismiss
      sheetMotion.instantDismiss = false
      modalRef.current?.dismiss(instant ? { duration: 1 } : undefined)
      return
    }

    if (!opened.current) {
      opened.current = true
      modalRef.current?.present()
    } else if (picking !== wasPicking.current) {
      modalRef.current?.snapToIndex(0)
    }
    wasPicking.current = picking
  }, [content, picking])

  const handleDismiss = () => {
    opened.current = false
    wasPicking.current = false
    if (useMapSheetStore.getState().content !== 'home') {
      useMapSheetStore.getState().showHome()
    }
  }

  return (
    <>
      <BottomSheet
        ref={homeRef}
        index={1}
        snapPoints={homeSnapPoints}
        enablePanDownToClose={false}
        topInset={insets.top}
        animatedPosition={homePosition}
        onChange={(index) => {
          if (index >= 0) savedHomeIndex.current = index
        }}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}>
        <View style={styles.home}>
          <IssueFeedHeader bottomInset={insets.bottom} />
          <View style={[styles.feed, { marginTop: -insets.bottom }]}>
            <IssueFeed paddingBottom={paddingBottom} onContentHeight={onFeedHeight} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheetModal
        ref={modalRef}
        name="map-overlay"
        snapPoints={modalSnapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={!picking}
        enableContentPanningGesture={!picking}
        enableHandlePanningGesture={false}
        handleComponent={null}
        backgroundComponent={null}
        topInset={insets.top}
        animatedPosition={modalPosition}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={handleDismiss}>
        <View style={styles.modalFill}>
          {picking ? (
            <LocationDock paddingBottom={paddingBottom} onContentHeight={onDockHeight} />
          ) : (
            <SheetStack renderPage={renderPage} onSettledPage={onSettledPage} />
          )}
        </View>
      </BottomSheetModal>
    </>
  )
}

function LocationDock({
  paddingBottom,
  onContentHeight,
}: {
  paddingBottom: number
  onContentHeight: (height: number) => void
}) {
  const cancelPickLocation = useMapSheetStore((state) => state.cancelPickLocation)
  const dragY = useSharedValue(0)
  const gesture = dockPan(dragY, cancelPickLocation)

  return (
    <DockSurface dragY={dragY} gesture={gesture}>
      <View
        onLayout={(event) => onContentHeight(event.nativeEvent.layout.height)}
        style={[styles.content, { paddingBottom }]}>
        <PickLocationDock />
      </View>
    </DockSurface>
  )
}

function ReportsContent() {
  const showHome = useMapSheetStore((state) => state.showHome)
  const startReport = useMapSheetStore((state) => state.startReport)

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>What do you see?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to list"
          onPress={showHome}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            size={16}
            weight="bold"
            tintColor="#111111"
          />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {REPORTS.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => startReport(item)}
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
            <View style={[styles.iconCircle, { backgroundColor: item.tint }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.iconLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: SHEET_BACKGROUND,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    backgroundColor: '#D0CED4',
    width: 36,
  },
  home: {
    flex: 1,
  },
  feed: {
    flex: 1,
  },
  modalFill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingTop: 4,
  },
  title: {
    color: '#16141A',
    fontSize: 28,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  iconLabel: {
    marginTop: 8,
    color: '#16141A',
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
})
