import {
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { SymbolView } from 'expo-symbols'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ReportCamera } from '@/components/report-camera'
import { MAX_REPORT_PHOTOS, useMapSheetStore, type ReportLocation } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

function formatCoords(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

async function placeLabel(latitude: number, longitude: number) {
  if (Platform.OS === 'web') return formatCoords(latitude, longitude)
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude })
    if (!place) return formatCoords(latitude, longitude)
    if (place.formattedAddress) return place.formattedAddress
    const street = [place.street, place.streetNumber].filter(Boolean).join(' ')
    const line = [street || place.name, place.city || place.district || place.subregion]
      .filter(Boolean)
      .join(', ')
    return line || formatCoords(latitude, longitude)
  } catch {
    return formatCoords(latitude, longitude)
  }
}

export async function pickReportPhotos(): Promise<'added' | 'cancel' | string> {
  const { draft, addPhotos } = useMapSheetStore.getState()
  const room = MAX_REPORT_PHOTOS - draft.photos.length
  if (room <= 0) return 'Możesz dodać najwyżej 5 zdjęć.'

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return 'Włącz dostęp do zdjęć, żeby je dodać.'
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: room,
    })
    if (result.canceled) return 'cancel'
    addPhotos(result.assets.map((asset) => asset.uri))
    return 'added'
  } catch {
    return 'Nie udało się dodać zdjęcia.'
  }
}

export function ReportComposer({ paddingBottom }: { paddingBottom: number }) {
  const category = useMapSheetStore((state) => state.draft.category)
  const photos = useMapSheetStore((state) => state.draft.photos)
  const title = useMapSheetStore((state) => state.draft.title)
  const description = useMapSheetStore((state) => state.draft.description)
  const location = useMapSheetStore((state) => state.draft.location)
  const cancelCompose = useMapSheetStore((state) => state.cancelCompose)
  const setTitle = useMapSheetStore((state) => state.setTitle)
  const setDescription = useMapSheetStore((state) => state.setDescription)
  const addPhotos = useMapSheetStore((state) => state.addPhotos)
  const removePhoto = useMapSheetStore((state) => state.removePhoto)
  const setUserLocation = useMapSheetStore((state) => state.setUserLocation)
  const beginPickLocation = useMapSheetStore((state) => state.beginPickLocation)
  const submitReport = useMapSheetStore((state) => state.submitReport)
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null)
  const titleOffset = useRef(0)
  const descriptionOffset = useRef(0)
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [locating, setLocating] = useState(location == null)
  const [pickingPhoto, setPickingPhoto] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [photoHint, setPhotoHint] = useState<string | null>(null)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height)
    })
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  useEffect(() => {
    if (useMapSheetStore.getState().draft.location) {
      setLocating(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (cancelled || permission.status !== 'granted') return
        const position = await Location.getCurrentPositionAsync({})
        if (cancelled) return
        const { latitude, longitude } = position.coords
        const label = await placeLabel(latitude, longitude)
        if (cancelled) return
        setUserLocation({ latitude, longitude, label, source: 'user' })
      } finally {
        if (!cancelled) setLocating(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [setUserLocation])

  if (!category) return null

  const room = MAX_REPORT_PHOTOS - photos.length
  const canSend = location != null && !locating

  const revealField = (offset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(offset - 12, 0), animated: true })
    }, 280)
  }

  const openLibrary = async () => {
    if (pickingPhoto || room <= 0) return
    setPickingPhoto(true)
    setPhotoHint(null)
    const result = await pickReportPhotos()
    if (result !== 'added' && result !== 'cancel') setPhotoHint(result)
    setPickingPhoto(false)
  }

  return (
    <BottomSheetScrollView
      ref={scrollRef}
      style={
        keyboardHeight > 0
          ? { height: windowHeight - insets.top - keyboardHeight - 28 }
          : undefined
      }
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingBottom }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć do kategorii"
          onPress={() => {
            Keyboard.dismiss()
            cancelCompose()
          }}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <SymbolView
            name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
            size={18}
            tintColor="#111111"
          />
        </Pressable>
        <Text style={styles.emoji}>{category.emoji}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {category.label}
        </Text>
      </View>

      <Text style={styles.section}>Zdjęcia</Text>
      {photos.length === 0 ? (
        <View style={styles.photoActions}>
          <PhotoAction
            label="Zrób zdjęcie"
            source="camera"
            disabled={pickingPhoto}
            onPress={() => {
              Keyboard.dismiss()
              setCameraOpen(true)
            }}
          />
          <PhotoAction
            label="Z galerii"
            source="library"
            disabled={pickingPhoto}
            onPress={() => void openLibrary()}
          />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.photoStrip}>
          {room > 0 ? (
            <>
              <PhotoTile
                label="Aparat"
                source="camera"
                disabled={pickingPhoto}
                onPress={() => {
                  Keyboard.dismiss()
                  setCameraOpen(true)
                }}
              />
              <PhotoTile
                label="Galeria"
                source="library"
                disabled={pickingPhoto}
                onPress={() => void openLibrary()}
              />
            </>
          ) : null}
          {photos.map((photo) => (
            <View key={photo.id} style={styles.thumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Usuń zdjęcie"
                hitSlop={6}
                onPress={() => removePhoto(photo.id)}
                style={styles.thumbRemove}>
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={10}
                  weight="bold"
                  tintColor="#FFFFFF"
                />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
      <Text style={styles.hint}>
        {photoHint ?? `${photos.length} z ${MAX_REPORT_PHOTOS} · zdjęcia są opcjonalne`}
      </Text>

      <Text style={styles.section}>Miejsce</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={location ? 'Zmień miejsce zgłoszenia' : 'Wskaż miejsce na mapie'}
        onPress={beginPickLocation}
        style={({ pressed }) => [styles.locationCard, pressed && styles.pressed]}>
        <View style={styles.locationIcon}>
          {locating ? (
            <ActivityIndicator color="#2F80ED" />
          ) : (
            <SymbolView
              name={{ ios: 'mappin.circle.fill', android: 'location_on', web: 'location_on' }}
              size={22}
              tintColor={location?.source === 'picked' ? '#16141A' : '#2F80ED'}
            />
          )}
        </View>
        <View style={styles.locationText}>
          <Text style={styles.locationTitle}>{locationTitle(location, locating)}</Text>
          <Text style={styles.locationDetail} numberOfLines={2}>
            {locationDetail(location, locating)}
          </Text>
        </View>
        <Text style={styles.locationAction}>{location ? 'Zmień' : 'Wskaż'}</Text>
      </Pressable>
      <Text style={styles.hint}>Domyślnie tam, gdzie jesteś. Zmień, jeśli odszedłeś.</Text>

      <Text style={styles.section}>Szczegóły</Text>
      <View onLayout={(event) => { titleOffset.current = event.nativeEvent.layout.y }}>
        <Text style={styles.fieldLabel}>
          Tytuł <Text style={styles.optional}>opcjonalnie</Text>
        </Text>
        <BottomSheetTextInput
          value={title}
          onChangeText={setTitle}
          onFocus={() => revealField(titleOffset.current)}
          placeholder="Np. zepsuta lampa"
          placeholderTextColor="#8E8E93"
          style={styles.input}
          returnKeyType="next"
        />
      </View>
      <View
        onLayout={(event) => { descriptionOffset.current = event.nativeEvent.layout.y }}
        style={styles.descriptionBlock}>
        <Text style={styles.fieldLabel}>
          Opis <Text style={styles.optional}>opcjonalnie</Text>
        </Text>
        <BottomSheetTextInput
          value={description}
          onChangeText={setDescription}
          onFocus={() => revealField(descriptionOffset.current)}
          placeholder="Co dokładnie widzisz?"
          placeholderTextColor="#8E8E93"
          style={[styles.input, styles.inputMultiline]}
          multiline
          textAlignVertical="top"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Wyślij zgłoszenie"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={() => {
          Keyboard.dismiss()
          submitReport()
        }}
        style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && canSend && styles.pressed]}>
        <Text style={styles.sendText}>Wyślij zgłoszenie</Text>
      </Pressable>
      <ReportCamera
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(uri) => {
          addPhotos([uri])
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

export function PickLocationDock() {
  const cancelPickLocation = useMapSheetStore((state) => state.cancelPickLocation)
  const setPickedLocation = useMapSheetStore((state) => state.setPickedLocation)
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    if (saving) return
    setSaving(true)
    const [longitude, latitude] = useMapViewportStore.getState().center
    const label = await placeLabel(latitude, longitude)
    setPickedLocation({ longitude, latitude, label, source: 'picked' })
  }

  return (
    <View style={styles.pick}>
      <Text style={styles.pickTitle}>Przesuń mapę na miejsce problemu</Text>
      <View style={styles.pickActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Anuluj zmianę miejsca"
          onPress={cancelPickLocation}
          style={({ pressed }) => [styles.pickCancel, pressed && styles.pressed]}>
          <Text style={styles.pickCancelText}>Anuluj</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zatwierdź miejsce"
          disabled={saving}
          onPress={confirm}
          style={({ pressed }) => [styles.pickDone, pressed && styles.pressed]}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.pickDoneText}>Gotowe</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function locationTitle(location: ReportLocation | null, locating: boolean) {
  if (locating && !location) return 'Szukam Cię…'
  if (!location) return 'Brak lokalizacji'
  if (location.source === 'picked') return 'Wybrane miejsce'
  return 'Twoja lokalizacja'
}

function locationDetail(location: ReportLocation | null, locating: boolean) {
  if (location) return location.label
  if (locating) return 'Za chwilę ustawimy punkt, w którym jesteś.'
  return 'Wskaż problem na mapie.'
}

function PhotoSymbol({ source, size }: { source: 'camera' | 'library'; size: number }) {
  if (source === 'camera') {
    return (
      <SymbolView
        name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
        size={size}
        tintColor="#16141A"
      />
    )
  }

  return (
    <SymbolView
      name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library', web: 'photo_library' }}
      size={size}
      tintColor="#16141A"
    />
  )
}

function PhotoAction({
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.photoAction, pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={styles.photoActionIcon}>
        <PhotoSymbol source={source} size={26} />
      </View>
      <Text style={styles.photoActionLabel}>{label}</Text>
    </Pressable>
  )
}

function PhotoTile({
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.photoTile, pressed && styles.pressed]}>
      <PhotoSymbol source={source} size={22} />
      <Text style={styles.photoTileLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 0,
  },
  descriptionBlock: {
    marginTop: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    flex: 1,
    color: '#16141A',
    fontSize: 28,
    fontWeight: '700',
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
  },
  photoAction: {
    flex: 1,
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionLabel: {
    color: '#16141A',
    fontSize: 15,
    fontWeight: '600',
  },
  photoStrip: {
    gap: 10,
    paddingRight: 4,
  },
  photoTile: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoTileLabel: {
    color: '#16141A',
    fontSize: 12,
    fontWeight: '600',
  },
  thumbWrap: {
    width: 96,
    height: 96,
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 18,
    backgroundColor: '#F4F2F8',
  },
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(22, 20, 26, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 20,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E4EC',
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flex: 1,
    gap: 2,
  },
  locationTitle: {
    color: '#16141A',
    fontSize: 16,
    fontWeight: '600',
  },
  locationDetail: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
  },
  locationAction: {
    color: '#2F80ED',
    fontSize: 15,
    fontWeight: '600',
  },
  fieldLabel: {
    color: '#16141A',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  optional: {
    color: '#8E8E93',
    fontWeight: '500',
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E4EC',
    color: '#111111',
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 96,
    marginBottom: 18,
  },
  send: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#16141A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sendDisabled: {
    opacity: 0.35,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pick: {
    gap: 14,
    paddingTop: 4,
  },
  pickTitle: {
    color: '#16141A',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  pickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  pickCancel: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickCancelText: {
    color: '#16141A',
    fontSize: 16,
    fontWeight: '600',
  },
  pickDone: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16141A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickDoneText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
})
