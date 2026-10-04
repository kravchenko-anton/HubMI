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
  compact,
  style,
}: {
  label: string
  accessibilityLabel: string
  disabled?: boolean
  busy?: boolean
  success?: boolean
  onPress: () => void
  compact?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const blocked = Boolean(disabled || busy || success)
  const press = usePressScale(blocked ? 1 : 0.97)

  return (
    <Animated.View style={[compact ? styles.hug : styles.fill, press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: blocked, busy }}
        disabled={blocked}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.button, compact && styles.compact, disabled && !busy && !success && styles.disabled]}>
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
          <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: {
    alignSelf: 'stretch',
  },
  hug: {
    alignSelf: 'flex-start',
  },
  button: {
    height: 52,
    borderRadius: 26,
    backgroundColor: ACTION_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  compactLabel: {
    fontSize: 14,
  },
})
