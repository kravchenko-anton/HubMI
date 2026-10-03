import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera'
import { SymbolView } from 'expo-symbols'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type ReportCameraProps = {
  visible: boolean
  onClose: () => void
  onCapture: (uri: string) => void
  onOpenLibrary: () => void
}

const OPEN_SPRING = { damping: 22, stiffness: 260, mass: 0.75 }

function dismissPan(dragY: SharedValue<number>, travel: number, onClose: () => void) {
  return Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY)
    })
    .onEnd((event) => {
      const shouldClose = dragY.value > travel * 0.22 || event.velocityY > 900
      if (shouldClose) {
        dragY.value = withTiming(travel, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)()
        })
        return
      }
      dragY.value = withSpring(0, OPEN_SPRING)
    })
}

export function ReportCamera({ visible, onClose, onCapture, onOpenLibrary }: ReportCameraProps) {
  const progress = useSharedValue(0)
  const [rendered, setRendered] = useState(visible)
  if (visible && !rendered) setRendered(true)

  useEffect(() => {
    if (!rendered) return
    if (visible) {
      progress.value = withSpring(1, OPEN_SPRING)
      return
    }
    progress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setRendered)(false)
    })
  }, [progress, rendered, visible])

  if (!rendered) return null

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <CameraStage
          progress={progress}
          onClose={onClose}
          onCapture={onCapture}
          onOpenLibrary={onOpenLibrary}
        />
      </GestureHandlerRootView>
    </Modal>
  )
}

function CameraStage({
  progress,
  onClose,
  onCapture,
  onOpenLibrary,
}: {
  progress: SharedValue<number>
  onClose: () => void
  onCapture: (uri: string) => void
  onOpenLibrary: () => void
}) {
  const cameraRef = useRef<CameraView>(null)
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [torch, setTorch] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) return
    requestPermission()
  }, [permission, requestPermission])

  const granted = permission?.granted === true
  const cardHeight = Math.min(height * 0.72, height - insets.top - insets.bottom - 36)
  const dragY = useSharedValue(0)
  const pan = dismissPan(dragY, Math.min(height * 0.45, 280), onClose)

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value * (1 - Math.min(dragY.value / (height * 0.5), 1)),
  }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 56 + dragY.value },
      { scale: 0.94 + progress.value * 0.06 },
    ],
  }))

  const capture = async () => {
    if (!ready || busy) return
    setBusy(true)
    setMenuOpen(false)
    try {
      const picture = await cameraRef.current?.takePictureAsync({ quality: 0.7 })
      if (picture?.uri) onCapture(picture.uri)
      else setBusy(false)
    } catch {
      setError("Couldn't take the photo.")
      setBusy(false)
    }
  }

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable accessibilityLabel="Close camera" style={styles.backdropPress} onPress={onClose} />
      </Animated.View>

      <View
        pointerEvents="box-none"
        style={[styles.stage, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={[styles.card, { height: cardHeight }, cardStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.grabberHit}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          {granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.preview}
              facing={facing}
              mode="picture"
              animateShutter
              enableTorch={torch && facing === 'back'}
              onCameraReady={() => setReady(true)}
              onMountError={() => setError('Camera is unavailable.')}
            />
          ) : (
            <View style={styles.permission}>
              {permission == null ? (
                <ActivityIndicator color="#16141A" />
              ) : (
                <>
                  <Text style={styles.permissionTitle}>Turn on the camera</Text>
                  <Text style={styles.permissionBody}>The photo will appear in this window.</Text>
                  <Pressable accessibilityRole="button" onPress={requestPermission} style={styles.permissionButton}>
                    <Text style={styles.permissionButtonText}>Allow</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={() => {
              setMenuOpen(false)
              setFacing((current) => (current === 'back' ? 'front' : 'back'))
            }}
            style={styles.flip}>
            <SymbolView
              name={{
                ios: 'arrow.triangle.2.circlepath',
                android: 'cameraswitch',
                web: 'cameraswitch',
              }}
              size={18}
              tintColor="#FFFFFF"
            />
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.controls}>
            {menuOpen ? (
              <View style={styles.menu}>
                <Pressable accessibilityRole="button" onPress={onOpenLibrary} style={styles.menuItem}>
                  <Text style={styles.menuText}>Library</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTorch((current) => !current)}
                  style={styles.menuItem}>
                  <Text style={styles.menuText}>{torch ? 'Turn off flashlight' : 'Flashlight'}</Text>
                </Pressable>
              </View>
            ) : null}

            <RoundButton label="Back" onPress={onClose}>
              <SymbolView
                name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
                size={18}
                tintColor="#FFFFFF"
              />
            </RoundButton>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              disabled={!granted || !ready || busy}
              onPress={capture}
              style={({ pressed }) => [
                styles.shutterRing,
                pressed && styles.pressed,
                (!granted || !ready || busy) && styles.disabled,
              ]}>
              <View style={styles.shutterCore} />
            </Pressable>

            <RoundButton label="More" onPress={() => setMenuOpen((open) => !open)}>
              <SymbolView
                name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
                size={18}
                tintColor="#FFFFFF"
              />
            </RoundButton>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

function RoundButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 16, 22, 0.42)',
  },
  backdropPress: {
    flex: 1,
  },
  stage: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  grabberHit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  card: {
    borderRadius: 40,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 16,
  },
  preview: {
    flex: 1,
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
    backgroundColor: '#F4F2F8',
  },
  permissionTitle: {
    color: '#16141A',
    fontSize: 22,
    fontWeight: '700',
  },
  permissionBody: {
    color: '#8E8E93',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 8,
    backgroundColor: '#16141A',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  flip: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 20, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    position: 'absolute',
    top: 68,
    left: 20,
    right: 20,
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(20, 20, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterCore: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.45,
  },
  menu: {
    position: 'absolute',
    right: 16,
    bottom: 78,
    minWidth: 168,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 28, 30, 0.94)',
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
