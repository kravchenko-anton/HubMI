import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { ISSUE_CATEGORIES, issueImageUri, type Issue, type IssueCategory } from '@/api/issues'
import { useMapIssues } from '@/hooks/use-map-issues'
import { usePressScale } from '@/hooks/use-press-scale'
import {
  areaProblemLabel,
  distanceKm,
  formatDistanceKm,
  formatRelativeTime,
  isSameLocalDay,
  issueCategoryMeta,
  voteLabel,
} from '@/lib/issue-categories'
import { useIssueVoteStore } from '@/stores/issue-vote-store'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const EMPTY_ISSUES: Issue[] = []
const HANDLE_HEIGHT = 24

export const HOME_PEEK = 156
export const HOME_HEADER_HEIGHT = HOME_PEEK - HANDLE_HEIGHT

type FeedFilter = 'all' | IssueCategory

function categoryId(category: string): IssueCategory {
  return (ISSUE_CATEGORIES as readonly string[]).includes(category)
    ? (category as IssueCategory)
    : 'other'
}

function todayLine(count: number) {
  if (count === 0) return 'None today'
  if (count === 1) return '1 today'
  return `${count} today`
}

function useLiveArea() {
  const query = useMapIssues()
  const center = useMapViewportStore((state) => state.center)
  const issues = query.data ?? EMPTY_ISSUES
  const todayCount = useMemo(
    () => issues.filter((issue) => isSameLocalDay(issue.created_at)).length,
    [issues],
  )
  const nearest = useMemo(() => {
    let best: { issue: Issue; km: number } | null = null
    for (const issue of issues) {
      const km = distanceKm(center[0], center[1], issue.lng, issue.lat)
      if (!best || km < best.km) best = { issue, km }
    }
    return best
  }, [issues, center])
  const ranked = useMemo(
    () => [...issues].sort((a, b) => b.upvotes - a.upvotes || b.id - a.id),
    [issues],
  )
  const leaderId = useMemo(() => {
    if (ranked.length < 2) return null
    return ranked[0].upvotes > ranked[1].upvotes ? ranked[0].id : null
  }, [ranked])

  return { ...query, issues, todayCount, nearest, ranked, leaderId, center }
}

export function IssueFeedHeader({ bottomInset }: { bottomInset: number }) {
  const { issues, isPending, isFetching, isError, todayCount, nearest } = useLiveArea()
  const waiting = isPending && issues.length === 0
  const failed = isError && issues.length === 0
  const summary = failed
    ? 'Could not load reports'
    : nearest
      ? `${areaProblemLabel(issues.length)}. ${todayLine(todayCount)}. Nearest ${formatDistanceKm(nearest.km)}`
      : `${areaProblemLabel(issues.length)}. Nothing nearby`

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={waiting ? 'Loading reports' : summary}
      style={[styles.header, { height: HOME_HEADER_HEIGHT + bottomInset, paddingBottom: bottomInset }]}>
      {waiting ? (
        <HeaderSkeleton />
      ) : (
        <>
          <View style={styles.summary}>
            <CountBlock count={failed ? null : issues.length} live={isFetching} />
            {failed ? (
              <Text style={styles.statPrimary}>Could not load reports</Text>
            ) : (
              <View style={styles.stats}>
                <Text style={styles.statPrimary}>{todayLine(todayCount)}</Text>
                <Text style={styles.statSecondary}>
                  {nearest ? `Nearest ${formatDistanceKm(nearest.km)}` : 'Nothing nearby'}
                </Text>
              </View>
            )}
          </View>
          {nearest && !failed ? (
            <NearestIssue issue={nearest.issue} distance={formatDistanceKm(nearest.km)} />
          ) : (
            <View style={styles.nearestQuiet}>
              <Text style={styles.nearestQuietText}>
                {failed ? 'Move the map to try again' : 'No reports in this area'}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

function CountBlock({ count, live }: { count: number | null; live: boolean }) {
  const label = count == null ? '—' : String(count)

  return (
    <View style={styles.countCol}>
      <View style={styles.countWrap}>
        <Animated.View key={label} entering={FadeIn.duration(220)}>
          <Text style={styles.count}>{label}</Text>
        </Animated.View>
        <LivePulse active={live} />
      </View>
      <Text style={styles.countCaption}>nearby</Text>
    </View>
  )
}

function LivePulse({ active }: { active: boolean }) {
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = active
      ? withRepeat(withTiming(0.25, { duration: 700 }), -1, true)
      : withTiming(1, { duration: 180 })
  }, [active, opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return <Animated.View style={[styles.pulse, style]} />
}

function HeaderSkeleton() {
  const opacity = useSharedValue(0.45)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true)
  }, [opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={style}>
      <View style={styles.summary}>
        <View style={styles.countCol}>
          <View style={styles.countBone} />
          <View style={styles.captionBone} />
        </View>
        <View style={styles.stats}>
          <View style={styles.statBone} />
          <View style={[styles.statBone, styles.statBoneShort]} />
        </View>
      </View>
      <View style={styles.nearestBone} />
    </Animated.View>
  )
}

function NearestIssue({ issue, distance }: { issue: Issue; distance: string }) {
  const press = usePressScale()
  const meta = issueCategoryMeta(issue.category)

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${meta.label}. ${issue.title}. ${distance}`}
        onPress={() => useMapSheetStore.getState().openIssue(issue)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.nearest}>
        <Text style={styles.nearestEmoji}>{meta.emoji}</Text>
        <Text style={styles.nearestTitle} numberOfLines={1}>
          {issue.title}
        </Text>
        <Text style={styles.nearestDistance}>{distance}</Text>
      </Pressable>
    </Animated.View>
  )
}

export function IssueFeed({
  paddingBottom,
  onContentHeight,
}: {
  paddingBottom: number
  onContentHeight?: (height: number) => void
}) {
  const { issues, isPending, isError, ranked, leaderId, center } = useLiveArea()
  const notice = useMapSheetStore((state) => state.notice)
  const clearNotice = useMapSheetStore((state) => state.clearNotice)
  const [filter, setFilter] = useState<FeedFilter>('all')
  const waiting = isPending && issues.length === 0
  const failed = isError && issues.length === 0

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(clearNotice, 1800)
    return () => clearTimeout(timer)
  }, [notice, clearNotice])

  const chips = useMemo(() => {
    const counts = new Map<IssueCategory, number>()
    for (const issue of issues) {
      const id = categoryId(issue.category)
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return ISSUE_CATEGORIES.filter((id) => counts.has(id)).map((id) => ({
      id,
      count: counts.get(id) ?? 0,
      ...issueCategoryMeta(id),
    }))
  }, [issues])

  const activeFilter: FeedFilter =
    filter !== 'all' && chips.some((chip) => chip.id === filter) ? filter : 'all'

  const visible = useMemo(
    () =>
      activeFilter === 'all'
        ? ranked
        : ranked.filter((issue) => categoryId(issue.category) === activeFilter),
    [ranked, activeFilter],
  )

  return (
    <BottomSheetScrollView style={styles.feed} keyboardShouldPersistTaps="handled">
      <View
        onLayout={(event) => onContentHeight?.(event.nativeEvent.layout.height)}
        style={[styles.content, { paddingBottom }]}>
      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {issues.length > 0 ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}>
          <CategoryChip
            label="All"
            count={issues.length}
            selected={activeFilter === 'all'}
            onPress={() => setFilter('all')}
          />
          {chips.map((chip) => (
            <CategoryChip
              key={chip.id}
              label={chip.label}
              emoji={chip.emoji}
              count={chip.count}
              selected={activeFilter === chip.id}
              onPress={() => setFilter(chip.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {waiting ? (
        <SkeletonRows />
      ) : failed ? (
        <Text style={styles.empty}>Could not load reports</Text>
      ) : issues.length === 0 ? (
        <Text style={styles.empty}>No reports in this area</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>No reports in this category</Text>
      ) : (
        <View style={styles.list}>
          {visible.map((issue, index) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              index={index}
              top={issue.id === leaderId}
              centerLng={center[0]}
              centerLat={center[1]}
            />
          ))}
        </View>
      )}
      </View>
    </BottomSheetScrollView>
  )
}

function CategoryChip({
  label,
  emoji,
  count,
  selected,
  onPress,
}: {
  label: string
  emoji?: string
  count: number
  selected: boolean
  onPress: () => void
}) {
  const [pressed, setPressed] = useState(false)
  const scale = useSharedValue(1)
  const target = pressed ? 0.96 : selected ? 1.04 : 1

  useEffect(() => {
    scale.value = withSpring(target, { damping: 16, stiffness: 280 })
  }, [scale, target])

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${count}`}
        accessibilityState={{ selected }}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.chip, selected && styles.chipOn]}>
        {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
        <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Text>
        <Text style={[styles.chipCount, selected && styles.chipCountOn]}>{count}</Text>
      </Pressable>
    </Animated.View>
  )
}

function SkeletonRows() {
  const opacity = useSharedValue(0.45)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 700 }), -1, true)
  }, [opacity])
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={[styles.list, style]}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.row}>
          <View style={[styles.thumb, styles.bone]} />
          <View style={styles.rowText}>
            <View style={[styles.lineBone, styles.lineBoneTitle]} />
            <View style={[styles.lineBone, styles.lineBoneBody]} />
          </View>
        </View>
      ))}
    </Animated.View>
  )
}

function IssueRow({
  issue,
  index,
  top,
  centerLng,
  centerLat,
}: {
  issue: Issue
  index: number
  top: boolean
  centerLng: number
  centerLat: number
}) {
  const press = usePressScale()
  const meta = issueCategoryMeta(issue.category)
  const quote = issue.description.trim()
  const imageUri = issueImageUri(issue.image_url)
  const [imageFailed, setImageFailed] = useState(false)
  const showPhoto = Boolean(imageUri) && !imageFailed
  const distance = formatDistanceKm(distanceKm(centerLng, centerLat, issue.lng, issue.lat))
  const when = formatRelativeTime(issue.created_at)
  const vote = useIssueVoteStore((state) => {
    const pending = state.pending[issue.id]
    if (pending) return pending.next
    return state.votes[issue.id] ?? null
  })
  const motion = index < 8

  return (
    <Animated.View
      entering={motion ? FadeInDown.duration(280).delay(index * 40) : undefined}
      exiting={motion ? FadeOut.duration(160) : undefined}>
      <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={issue.title}
        onPress={() => useMapSheetStore.getState().openIssue(issue)}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.row}>
        <View style={[styles.thumb, !showPhoto && { backgroundColor: meta.color }]}>
          {showPhoto ? (
            <Image
              source={{ uri: imageUri ?? undefined }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <Text style={styles.thumbEmoji}>{meta.emoji}</Text>
          )}
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {issue.title}
          </Text>
          {quote ? (
            <Text style={styles.rowQuote} numberOfLines={1}>
              {quote}
            </Text>
          ) : null}
          <View style={styles.metaLine}>
            <View style={[styles.metaChip, { backgroundColor: `${meta.color}22` }]}>
              <Text style={styles.metaEmoji}>{meta.emoji}</Text>
              <Text style={[styles.metaLabel, { color: meta.color }]} numberOfLines={1}>
                {meta.label}
              </Text>
            </View>
            <Text style={styles.metaText} numberOfLines={1}>
              {when ? `${distance} · ${when}` : distance}
            </Text>
            <Text
              style={[
                styles.votes,
                vote === 'up' && styles.votesUp,
                vote === 'down' && styles.votesDown,
              ]}>
              {voteLabel(issue.upvotes)}
            </Text>
            {top ? (
              <View style={styles.topChip}>
                <Text style={styles.topText}>Top</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 2,
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 56,
  },
  countCol: {
    minWidth: 72,
  },
  countWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  count: {
    color: '#16141A',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  countCaption: {
    color: '#60646C',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -2,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: '#34C759',
  },
  stats: {
    flex: 1,
    gap: 2,
  },
  statPrimary: {
    color: '#16141A',
    fontSize: 16,
    fontWeight: '700',
  },
  statSecondary: {
    color: '#60646C',
    fontSize: 14,
    fontWeight: '500',
  },
  nearest: {
    height: 44,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F4F2F8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nearestQuiet: {
    height: 44,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearestQuietText: {
    color: '#60646C',
    fontSize: 14,
    fontWeight: '600',
  },
  nearestEmoji: {
    fontSize: 18,
  },
  nearestTitle: {
    flex: 1,
    color: '#16141A',
    fontSize: 15,
    fontWeight: '600',
  },
  nearestDistance: {
    color: '#60646C',
    fontSize: 13,
    fontWeight: '600',
  },
  countBone: {
    width: 48,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E7E4EC',
  },
  captionBone: {
    width: 52,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    backgroundColor: '#E7E4EC',
  },
  statBone: {
    height: 14,
    width: '72%',
    borderRadius: 7,
    backgroundColor: '#E7E4EC',
  },
  statBoneShort: {
    width: '48%',
  },
  nearestBone: {
    height: 44,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#E7E4EC',
  },
  feed: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 12,
  },
  notice: {
    alignSelf: 'flex-start',
    backgroundColor: '#16141A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noticeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  chipsScroll: {
    marginHorizontal: -16,
    flexGrow: 0,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: '#F4F2F8',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipOn: {
    backgroundColor: '#16141A',
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    color: '#16141A',
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelOn: {
    color: '#FFFFFF',
  },
  chipCount: {
    color: '#60646C',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chipCountOn: {
    color: 'rgba(255,255,255,0.72)',
  },
  empty: {
    color: '#60646C',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 28,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#F4F2F8',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7E4EC',
  },
  thumbEmoji: {
    fontSize: 26,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    color: '#16141A',
    fontSize: 16,
    fontWeight: '700',
  },
  rowQuote: {
    color: '#60646C',
    fontSize: 13,
    lineHeight: 17,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
  },
  metaEmoji: {
    fontSize: 11,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaText: {
    color: '#60646C',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  votes: {
    color: '#16141A',
    fontSize: 12,
    fontWeight: '700',
  },
  votesUp: {
    color: '#8A6A00',
  },
  votesDown: {
    color: '#FF453A',
  },
  topChip: {
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: '#FFF4CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topText: {
    color: '#8A6A00',
    fontSize: 11,
    fontWeight: '700',
  },
  bone: {
    backgroundColor: '#E7E4EC',
  },
  lineBone: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E7E4EC',
  },
  lineBoneTitle: {
    width: '72%',
  },
  lineBoneBody: {
    width: '46%',
    marginTop: 6,
  },
})
