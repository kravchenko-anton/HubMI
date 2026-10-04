import { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { SymbolView } from 'expo-symbols'
import { useEffect, useState, type ReactNode } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'

import { solveIssue, uploadIssueImage, type Issue } from '@/api/issues'
import { GreenActionButton } from '@/components/green-action-button'
import { ReportCamera } from '@/components/report-camera'
import { dropIssue } from '@/hooks/use-issue'
import { usePressScale } from '@/hooks/use-press-scale'
import { useConfettiStore } from '@/stores/confetti-store'
import { useMapSheetStore } from '@/stores/map-sheet-store'

export function SolveComposer({
  issue,
  paddingBottom,
  onContentHeight,
}: {
  issue: Issue
  paddingBottom: number
  onContentHeight?: (height: number) => void
}) {
  const cancelSolve = useMapSheetStore((state) => state.cancelSolve)
  const finishSolve = useMapSheetStore((state) => state.finishSolve)
  const queryClient = useQueryClient()
  const backPress = usePressScale()
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const imageUrl = photo ? await uploadIssueImage(photo) : null
      return solveIssue(issue.id, { note: note.trim(), image_url: imageUrl })
    },
    onSuccess: (solved) => {
      dropIssue(queryClient, solved.id)
      queryClient.invalidateQueries({ queryKey: ['issues'] })
      useMapSheetStore.getState().setSelectedIssue(solved)
      useConfettiStore.getState().play('bottom')
      setSuccess(true)
    },
    onError: () => setError('Could not mark this as solved'),
  })

  useEffect(() => {
    if (!success) return
    const timer = setTimeout(finishSolve, 700)
    return () => clearTimeout(timer)
  }, [finishSolve, success])

  const openLibrary = async () => {
    if (picking || mutation.isPending || success) return
    setPicking(true)
    setError(null)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setError('Allow photo access to add one.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      })
      if (!result.canceled) setPhoto(result.assets[0]?.uri ?? null)
    } catch {
      setError("Couldn't add the photo.")
    } finally {
      setPicking(false)
    }
  }

  const busy = mutation.isPending || success

  return (
    <BottomSheetScrollView keyboardShouldPersistTaps="handled">
      <View
        onLayout={(event) => onContentHeight?.(event.nativeEvent.layout.height)}
        style={[styles.content, { paddingBottom }]}>
      <View style={styles.header}>
        <ScalePress press={backPress} label="Back to the problem" onPress={cancelSolve} style={styles.back}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            size={18}
            tintColor="#111111"
          />
        </ScalePress>
        <Text style={styles.title} numberOfLines={1}>
          Solved it?
        </Text>
      </View>

      <Text style={styles.lead}>Add a short note or a photo if you want. Both are optional.</Text>

      <Text style={styles.section}>Photo</Text>
      {photo ? (
        <View style={styles.thumbWell}>
          <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            hitSlop={6}
            onPress={() => setPhoto(null)}
            style={styles.thumbRemove}>
            <SymbolView
              name={{ ios: 'xmark', android: 'close', web: 'close' }}
              size={10}
              weight="bold"
              tintColor="#FFFFFF"
            />
          </Pressable>
        </View>
      ) : (
        <View style={styles.photoActions}>
          <PhotoChoice
            label="Take photo"
            source="camera"
            disabled={busy}
            onPress={() => {
              Keyboard.dismiss()
              setCameraOpen(true)
            }}
          />
          <PhotoChoice
            label="From library"
            source="library"
            disabled={busy}
            onPress={() => void openLibrary()}
          />
        </View>
      )}

      <Text style={styles.section}>Note</Text>
      <BottomSheetTextInput
        value={note}
        onChangeText={setNote}
        placeholder="What did you fix?"
        placeholderTextColor="#8E8E93"
        style={styles.input}
        multiline
        textAlignVertical="top"
        editable={!busy}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <GreenActionButton
        label="Mark as solved"
        accessibilityLabel="Mark as solved"
        busy={mutation.isPending}
        success={success}
        onPress={() => {
          Keyboard.dismiss()
          setError(null)
          mutation.mutate()
        }}
      />

      </View>
      <ReportCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(uri) => {
          setPhoto(uri)
          setCameraOpen(false)
        }}
        onOpenLibrary={() => {
          setCameraOpen(false)
          setTimeout(() => {
            void openLibrary()
          }, 240)
        }}
      />
    </BottomSheetScrollView>
  )
}

function PhotoChoice({
  label,
  source,
  disabled,
  onPress,
}: {
  label: string
  source: 'camera' | 'library'
  disabled: boolean
  onPress: () => void
}) {
  const press = usePressScale(disabled ? 1 : 0.97)
  return (
    <ScalePress press={press} label={label} disabled={disabled} onPress={onPress} style={styles.photoAction}>
      <View style={styles.photoIcon}>
        <SymbolView
          name={
            source === 'camera'
              ? { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }
              : { ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }
          }
          size={24}
          tintColor="#16141A"
        />
      </View>
      <Text style={styles.photoLabel}>{label}</Text>
    </ScalePress>
  )
}

function ScalePress({
  press,
  onPress,
  label,
  disabled,
  style,
  children,
}: {
  press: ReturnType<typeof usePressScale>
  onPress: () => void
  label: string
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[style, disabled && styles.disabled]}>
        {children}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#16141A',
    fontSize: 28,
    fontWeight: '700',
  },
  lead: {
    color: '#60646C',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 18,
  },
  section: {
    color: '#16141A',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  photoAction: {
    flex: 1,
    minHeight: 112,
    minWidth: 140,
    borderRadius: 20,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    color: '#16141A',
    fontSize: 15,
    fontWeight: '600',
  },
  thumbWell: {
    height: 200,
    marginBottom: 18,
    padding: 8,
    borderRadius: 24,
    backgroundColor: '#F4F2F8',
  },
  thumb: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#E7E4EC',
  },
  thumbRemove: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22, 20, 26, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 96,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E4EC',
    color: '#111111',
    fontSize: 16,
  },
  error: {
    color: '#FF453A',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  disabled: {
    opacity: 0.5,
  },
})
