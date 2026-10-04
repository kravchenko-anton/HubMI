import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { issueImageUri, type Issue } from '@/api/issues'
import { GreenActionButton } from '@/components/green-action-button'
import { useCastIssueVote, useIssueDetails } from '@/hooks/use-issue'
import { usePressScale } from '@/hooks/use-press-scale'
import {
  distanceKm,
  formatDistanceKm,
  formatRelativeTime,
  issueCategoryMeta,
  voteLabel,
} from '@/lib/issue-categories'
import type { IssueVote } from '@/lib/issue-votes'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const VOTE_IDLE = '#F4F2F8'
const VOTE_UP = '#F5C518'
const VOTE_DOWN = '#FF453A'
const POP = { damping: 8, stiffness: 280 }
const SETTLE = { damping: 12, stiffness: 220 }

export function IssueDetail({
  issue,
  paddingBottom,
  onContentHeight,
}: {
  issue: Issue
  paddingBottom: number
  onContentHeight?: (height: number) => void
}) {
  const closeIssue = useMapSheetStore((state) => state.closeIssue)
  const openSolve = useMapSheetStore((state) => state.openSolve)
  const backPress = usePressScale()
  const center = useMapViewportStore((state) => state.center)
  const query = useIssueDetails(issue)
  const shown = query.data ?? issue
  const { vote, spinning, ready, isError, cast } = useCastIssueVote(shown.id)
  const score = shown.upvotes
  const busy = !ready || spinning != null
  const meta = issueCategoryMeta(shown.category)
  const imageUri = issueImageUri(shown.image_url)
  const [imageFailed, setImageFailed] = useState(false)
  const showPhoto = Boolean(imageUri) && !imageFailed
  const description = shown.description.trim()
  const distance = formatDistanceKm(distanceKm(center[0], center[1], shown.lng, shown.lat))
  const when = formatRelativeTime(shown.created_at)

  return (
    <BottomSheetScrollView keyboardShouldPersistTaps="handled">
      <View
        onLayout={(event) => onContentHeight?.(event.nativeEvent.layout.height)}
        style={[styles.content, { paddingBottom }]}>
      <View style={styles.toolbar}>
        <Animated.View style={backPress.style}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to list"
            onPress={closeIssue}
            onPressIn={backPress.onPressIn}
            onPressOut={backPress.onPressOut}
            style={styles.back}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              weight="bold"
              tintColor="#16141A"
            />
          </Pressable>
        </Animated.View>
        {shown.solved_at ? null : (
          <GreenActionButton
            label="I solved this"
            accessibilityLabel="Mark this problem as solved"
            onPress={openSolve}
            compact
            style={styles.solve}
          />
        )}
      </View>

      <View style={styles.photo}>
        {showPhoto ? (
          <Image
            source={{ uri: imageUri ?? undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoFallback, { backgroundColor: meta.color }]}>
            <Text style={styles.photoEmoji}>{meta.emoji}</Text>
          </View>
        )}
      </View>

      <Text style={styles.title}>{shown.title}</Text>

      <View style={styles.metaRow}>
        <View style={[styles.chip, { backgroundColor: `${meta.color}22` }]}>
          <Text style={styles.chipEmoji}>{meta.emoji}</Text>
          <Text style={[styles.chipLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={styles.meta}>{distance}</Text>
        {when ? <Text style={styles.meta}>· {when}</Text> : null}
      </View>

      <Text style={description ? styles.description : styles.descriptionEmpty}>
        {description || 'No description'}
      </Text>

      <View style={styles.voteRow}>
        <VoteButton
          active={vote === 'up'}
          activeColor={VOTE_UP}
          idleTint="#8A6A00"
          activeTint="#16141A"
          spinning={spinning === 'up'}
          disabled={busy}
          label={vote === 'up' ? 'Remove upvote' : 'Upvote'}
          icon={{ ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' }}
          tilt={-14}
          onPress={() => cast('up')}
        />
        <VoteCount score={score} vote={vote} />
        <VoteButton
          active={vote === 'down'}
          activeColor={VOTE_DOWN}
          idleTint={VOTE_DOWN}
          activeTint="#FFFFFF"
          spinning={spinning === 'down'}
          disabled={busy}
          label={vote === 'down' ? 'Remove downvote' : 'Downvote'}
          icon={{ ios: 'hand.thumbsdown.fill', android: 'thumb_down', web: 'thumb_down' }}
          tilt={14}
          onPress={() => cast('down')}
        />
      </View>
      {isError ? <Text style={styles.error}>Could not vote</Text> : null}
      </View>
    </BottomSheetScrollView>
  )
}

function VoteButton({
  active,
  activeColor,
  idleTint,
  activeTint,
  spinning,
  disabled,
  label,
  icon,
  tilt,
  onPress,
}: {
  active: boolean
  activeColor: string
  idleTint: string
  activeTint: string
  spinning: boolean
  disabled: boolean
  label: string
  icon: SymbolViewProps['name']
  tilt: number
  onPress: () => void
}) {
  const press = usePressScale()
  const fill = useSharedValue(active ? 1 : 0)
  const pop = useSharedValue(1)
  const turn = useSharedValue(0)
  const wasActive = useRef(active)

  useEffect(() => {
    const becameActive = active && !wasActive.current
    wasActive.current = active
    fill.value = withTiming(active ? 1 : 0, { duration: 200 })
    if (!becameActive) {
      pop.value = withTiming(1, { duration: 180 })
      turn.value = withTiming(0, { duration: 180 })
      return
    }
    pop.value = withSequence(withSpring(1.22, POP), withSpring(1, SETTLE))
    turn.value = withSequence(withTiming(tilt, { duration: 140 }), withSpring(0, SETTLE))
  }, [active, fill, pop, tilt, turn])

  const buttonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(fill.value, [0, 1], [VOTE_IDLE, activeColor]),
  }))
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${turn.value}deg` }],
  }))

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active, disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}>
        <Animated.View style={[styles.voteButton, buttonStyle]}>
          <Animated.View style={iconStyle}>
            <SymbolView name={icon} size={22} tintColor={active ? activeTint : idleTint} />
          </Animated.View>
          {spinning ? (
            <ActivityIndicator
              style={styles.voteSpinner}
              size="small"
              color={active ? activeTint : idleTint}
            />
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

function VoteCount({ score, vote }: { score: number; vote: IssueVote | null }) {
  const scale = useSharedValue(1)
  const seen = useRef<number | null>(null)

  useEffect(() => {
    if (seen.current == null) {
      seen.current = score
      return
    }
    if (seen.current === score) return
    seen.current = score
    scale.value = withSequence(withSpring(1.16, POP), withSpring(1, SETTLE))
  }, [scale, score])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.Text
      style={[
        styles.voteCount,
        vote === 'up' && styles.voteCountUp,
        vote === 'down' && styles.voteCountDown,
        style,
      ]}>
      {voteLabel(score)}
    </Animated.Text>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  solve: {
    marginLeft: 'auto',
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#E7E4EC',
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: {
    fontSize: 64,
  },
  title: {
    color: '#16141A',
    fontSize: 26,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
  },
  chipEmoji: {
    fontSize: 13,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    color: '#60646C',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  description: {
    color: '#16141A',
    fontSize: 16,
    lineHeight: 22,
  },
  descriptionEmpty: {
    color: '#8E8E93',
    fontSize: 16,
    lineHeight: 22,
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  voteButton: {
    width: 64,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteSpinner: {
    position: 'absolute',
    top: 4,
    right: 6,
    transform: [{ scale: 0.65 }],
  },
  voteCount: {
    flex: 1,
    color: '#16141A',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  voteCountUp: {
    color: '#8A6A00',
  },
  voteCountDown: {
    color: '#FF453A',
  },
  error: {
    color: '#FF453A',
    fontSize: 14,
    textAlign: 'center',
  },
})
