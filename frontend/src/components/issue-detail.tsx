import { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import { SymbolView } from 'expo-symbols'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { issueImageUri, type Issue } from '@/api/issues'
import { useCastIssueVote, useIssueDetails } from '@/hooks/use-issue'
import { usePressScale } from '@/hooks/use-press-scale'
import {
  distanceKm,
  formatDistanceKm,
  formatRelativeTime,
  issueCategoryMeta,
  voteLabel,
} from '@/lib/issue-categories'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

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
  const backPress = usePressScale()
  const upPress = usePressScale()
  const downPress = usePressScale()
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
        <Animated.View style={upPress.style}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={vote === 'up' ? 'Remove upvote' : 'Upvote'}
            accessibilityState={{ selected: vote === 'up', disabled: busy }}
            disabled={busy}
            onPress={() => cast('up')}
            onPressIn={upPress.onPressIn}
            onPressOut={upPress.onPressOut}
            style={[
              styles.voteButton,
              vote === 'up' && styles.voteUpOn,
              spinning === 'up' && styles.pressed,
            ]}>
            {spinning === 'up' ? (
              <ActivityIndicator color={vote === 'up' ? '#16141A' : '#8A6A00'} />
            ) : (
              <SymbolView
                name={{ ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' }}
                size={22}
                tintColor={vote === 'up' ? '#16141A' : '#8A6A00'}
              />
            )}
          </Pressable>
        </Animated.View>
        <Text
          style={[
            styles.voteCount,
            vote === 'up' && styles.voteCountUp,
            vote === 'down' && styles.voteCountDown,
          ]}>
          {voteLabel(score)}
        </Text>
        <Animated.View style={downPress.style}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={vote === 'down' ? 'Remove downvote' : 'Downvote'}
            accessibilityState={{ selected: vote === 'down', disabled: busy }}
            disabled={busy}
            onPress={() => cast('down')}
            onPressIn={downPress.onPressIn}
            onPressOut={downPress.onPressOut}
            style={[
              styles.voteButton,
              vote === 'down' && styles.voteDownOn,
              spinning === 'down' && styles.pressed,
            ]}>
            {spinning === 'down' ? (
              <ActivityIndicator color={vote === 'down' ? '#FFFFFF' : '#FF453A'} />
            ) : (
              <SymbolView
                name={{ ios: 'hand.thumbsdown.fill', android: 'thumb_down', web: 'thumb_down' }}
                size={22}
                tintColor={vote === 'down' ? '#FFFFFF' : '#FF453A'}
              />
            )}
          </Pressable>
        </Animated.View>
      </View>
      {isError ? <Text style={styles.error}>Could not vote</Text> : null}
      </View>
    </BottomSheetScrollView>
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
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteUpOn: {
    backgroundColor: '#F5C518',
  },
  voteDownOn: {
    backgroundColor: '#FF453A',
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
  pressed: {
    opacity: 0.7,
  },
})
