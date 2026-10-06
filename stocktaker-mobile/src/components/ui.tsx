// Small shared building blocks and the colour tokens every screen uses.
// Kept deliberately tiny - like the web dashboard's hand-rolled CSS, this
// app is small enough that a component library would be more weight than
// help. Buttons are large on purpose: warehouse workers often wear gloves.

import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInputProps, ViewStyle } from 'react-native'

export const colors = {
  bg: '#f4f6f8',
  surface: '#ffffff',
  text: '#16202a',
  muted: '#5f6b76',
  border: '#d5dbe1',
  accent: '#1f6feb',
  success: '#1a7f37',
  danger: '#cf222e',
  warning: '#9a6700',
  warningBg: '#fff8c5',
}

type ButtonVariant = 'primary' | 'success' | 'danger' | 'secondary'

const buttonColors: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.accent, fg: '#fff' },
  success: { bg: colors.success, fg: '#fff' },
  danger: { bg: colors.danger, fg: '#fff' },
  secondary: { bg: colors.surface, fg: colors.text },
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}) {
  const { bg, fg } = buttonColors[variant]
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'secondary' && styles.buttonOutline,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  )
}

export function Field({ label, ...inputProps }: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} {...inputProps} style={[styles.input, inputProps.style]} />
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  )
}

export function CenteredSpinner() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  )
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted },
  body: { fontSize: 16, color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.muted },
  field: { gap: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: colors.text,
  },
  button: {
    minHeight: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 17, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 15 },
  row: { flexDirection: 'row', gap: 12 },
})
