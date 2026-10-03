import { SymbolView } from 'expo-symbols'
import { StyleSheet, View } from 'react-native'

const BUBBLE = 48
const TIP = 16

export function ReportLocationPin() {
  return (
    <View pointerEvents="none" style={styles.layer}>
      <View style={styles.anchor}>
        <View style={styles.bubble}>
          <SymbolView
            name={{
              ios: 'exclamationmark.triangle.fill',
              android: 'warning',
              web: 'warning',
            }}
            size={22}
            tintColor="#F5C518"
          />
        </View>
        <View style={styles.tip} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchor: {
    alignItems: 'center',
    transform: [{ translateY: -((BUBBLE + TIP) / 2) }],
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: '#16141A',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  tip: {
    width: 3,
    height: TIP,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: '#16141A',
  },
})
