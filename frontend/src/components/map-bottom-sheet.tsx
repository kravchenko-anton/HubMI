import BottomSheet, { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet'
import { SymbolView } from 'expo-symbols'
import { useEffect, useRef, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMapSheetStore } from '@/stores/map-sheet-store'

const SHEET_BACKGROUND = '#FEFDFF';
const SHEET_HANDLE_HEIGHT = 24;
const SEARCH_BAR_HEIGHT = 52;
const SHEET_CONTENT_PADDING_TOP = 4;
const SHEET_CONTENT_PADDING_BOTTOM = 20;

export const COLLAPSED_SHEET_HEIGHT =
  SHEET_HANDLE_HEIGHT + SHEET_CONTENT_PADDING_TOP + SEARCH_BAR_HEIGHT + SHEET_CONTENT_PADDING_BOTTOM;
export const REPORT_BUTTON_GAP = 20;

const REPORTS = [
  { id: 'light', label: 'Oświetlenie', emoji: '💡' },
  { id: 'road', label: 'Droga', emoji: '🚧' },
  { id: 'waste', label: 'Śmieci', emoji: '🗑️' },
  { id: 'loud', label: 'Hałas', emoji: '📢' },
  { id: 'access', label: 'Dostępność', emoji: '♿' },
  { id: 'animals', label: 'Zwierzęta', emoji: '🐾' },
  { id: 'vandalism', label: 'Wandalizm', emoji: '🎨' },
  { id: 'nature', label: 'Natura', emoji: '🍂' },
  { id: 'other', label: 'Inne', emoji: '❓' },
] as const;

const PLACES = [
  { id: 'karkonoska', name: 'Karkonoska', detail: 'Ulica · Kraków' },
  { id: 'rynek', name: 'Rynek Główny', detail: 'Stare Miasto' },
  { id: 'wawel', name: 'Wawel', detail: 'Zamek · Kraków' },
  { id: 'kazimierz', name: 'Kazimierz', detail: 'Dzielnica · Kraków' },
  { id: 'galeria', name: 'Galeria Krakowska', detail: 'Centrum handlowe' },
  { id: 'dworzec', name: 'Dworzec Główny', detail: 'Dworzec · Kraków' },
  { id: 'blonia', name: 'Błonia', detail: 'Park · Kraków' },
  { id: 'nowa-huta', name: 'Plac Centralny', detail: 'Nowa Huta' },
] as const;

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function MapBottomSheet({ animatedPosition }: { animatedPosition: SharedValue<number> }) {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const content = useMapSheetStore((state) => state.content);
  const searchOpen = useMapSheetStore((state) => state.searchOpen);
  const sheetKey = content === 'reports' ? 'reports' : searchOpen ? 'search-open' : 'search';

  useEffect(() => {
    const timer = setTimeout(() => {
      sheetRef.current?.snapToIndex(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [sheetKey]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose={false}
      topInset={insets.top}
      maxDynamicContentSize={height - insets.top - 12}
      animatedPosition={animatedPosition}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}>
      <BottomSheetView
        key={sheetKey}
        style={[styles.content, { paddingBottom: SHEET_CONTENT_PADDING_BOTTOM + insets.bottom }]}>
        {content === 'reports' ? <ReportsContent /> : <SearchContent />}
      </BottomSheetView>
    </BottomSheet>
  );
}

function SearchContent() {
  const searchOpen = useMapSheetStore((state) => state.searchOpen);
  const query = useMapSheetStore((state) => state.query);
  const destination = useMapSheetStore((state) => state.destination);
  const notice = useMapSheetStore((state) => state.notice);
  const setQuery = useMapSheetStore((state) => state.setQuery);
  const openSearch = useMapSheetStore((state) => state.openSearch);
  const closeSearch = useMapSheetStore((state) => state.closeSearch);
  const selectDestination = useMapSheetStore((state) => state.selectDestination);
  const clearNotice = useMapSheetStore((state) => state.clearNotice);
  const [listening, setListening] = useState(false);
  const listenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 1800);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  useEffect(
    () => () => {
      if (listenTimer.current) clearTimeout(listenTimer.current);
    },
    [],
  );

  const handleCloseSearch = () => {
    Keyboard.dismiss();
    closeSearch();
  };

  const handleMic = () => {
    if (listening) return;
    setListening(true);
    listenTimer.current = setTimeout(() => {
      const pool = PLACES.filter((place) => place.name !== destination);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      selectDestination(pick.name, `Jedziemy: ${pick.name}`);
      setListening(false);
    }, 700);
  };

  const foldedQuery = fold(query.trim());
  const results = PLACES.filter((place) =>
    foldedQuery ? fold(place.name).includes(foldedQuery) || fold(place.detail).includes(foldedQuery) : true,
  );

  return (
    <View style={styles.searchContent}>
      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.searchBar}>
        {searchOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zamknij wyszukiwanie"
            hitSlop={8}
            onPress={handleCloseSearch}
            style={styles.searchBack}>
            <SymbolView
              name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
              size={18}
              tintColor="#111111"
            />
          </Pressable>
        ) : null}

        {searchOpen ? (
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Dokąd jedziemy?"
            placeholderTextColor="#8E8E93"
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
        ) : (
          <Pressable style={styles.searchPressable} onPress={openSearch}>
            <Text style={styles.searchPlaceholder}>Dokąd jedziemy?</Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Szukaj głosem"
          hitSlop={8}
          onPress={handleMic}>
          <SymbolView
            name={{ ios: 'mic', android: 'mic', web: 'mic' }}
            size={20}
            tintColor={listening ? '#2F80ED' : '#8E8E93'}
          />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchResults}>
          {results.length === 0 ? (
            <Text style={styles.emptyResults}>Brak wyników</Text>
          ) : (
            results.map((place) => {
              const selected = place.name === destination;
              return (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    Keyboard.dismiss();
                    selectDestination(place.name);
                  }}
                  style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
                  <View style={[styles.resultIcon, selected && styles.resultIconSelected]}>
                    <SymbolView
                      name={{ ios: 'mappin.circle.fill', android: 'location_on', web: 'location_on' }}
                      size={22}
                      tintColor={selected ? '#2F80ED' : '#8E8E93'}
                    />
                  </View>
                  <View style={styles.resultText}>
                    <Text style={styles.resultName}>{place.name}</Text>
                    <Text style={styles.resultDetail}>{place.detail}</Text>
                  </View>
                  {selected ? <Text style={styles.resultCurrent}>Teraz</Text> : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

function ReportsContent() {
  const showSearch = useMapSheetStore((state) => state.showSearch);
  const submitReport = useMapSheetStore((state) => state.submitReport);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Co widzisz?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć do wyszukiwania"
          onPress={showSearch}
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
            onPress={() => submitReport(item.label)}
            style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
            <View style={styles.iconCircle}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.iconLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
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
  content: {
    paddingHorizontal: 16,
  },
  searchContent: {
    gap: 14,
    paddingTop: SHEET_CONTENT_PADDING_TOP,
  },
  notice: {
    alignSelf: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noticeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SEARCH_BAR_HEIGHT,
    borderRadius: 26,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E4EC',
    gap: 8,
  },
  searchBack: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPressable: {
    flex: 1,
    justifyContent: 'center',
  },
  searchPlaceholder: {
    color: '#8E8E93',
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: '#111111',
    fontSize: 16,
    paddingVertical: 0,
  },
  searchResults: {
    gap: 2,
  },
  emptyResults: {
    color: '#8E8E93',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 28,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4F2F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconSelected: {
    backgroundColor: '#E8F1FD',
  },
  resultText: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  resultDetail: {
    color: '#8E8E93',
    fontSize: 13,
  },
  resultCurrent: {
    color: '#2F80ED',
    fontSize: 13,
    fontWeight: '600',
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
    backgroundColor: '#F4F2F8',
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
});
