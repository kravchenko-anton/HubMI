import { SymbolView } from 'expo-symbols'
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'

import { usePressScale } from '@/hooks/use-press-scale'

export const ACTION_GREEN = '#1F8A4C'

export function GreenActionButton({
  label,
  accessibilityLabel,
  disabled,
  busy,
  success,
  onPress,
  style,
}: {
  label: string
  accessibilityLabel: string
  disabled?: boolean
  busy?: boolean
  success?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const blocked = Boolean(disabled || busy || success)
  const press = usePressScale(blocked ? 1 : 0.97)

  return (
    <Animated.View style={[styles.fill, press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: blocked, busy }}
        disabled={blocked}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.button, disabled && !busy && !success && styles.disabled]}>
        {success ? (
          <SymbolView
            name={{ ios: 'checkmark', android: 'check', web: 'check' }}
            size={22}
            weight="bold"
            tintColor="#FFFFFF"
          />
        ) : busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: {
    alignSelf: 'stretch',
  },
  button: {
    height: 52,
    borderRadius: 26,
    backgroundColor: ACTION_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
})
