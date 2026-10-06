import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { BASE_URL, errorMessage } from '../api/client'
import { Button, ErrorText, Field, styles } from '../components/ui'

export default function SignInScreen() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // On success the root layout's Stack.Protected guard flips and the
      // router moves to the scanner by itself - nothing to navigate here.
      await signIn(username.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { flexGrow: 1, justifyContent: 'center' }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Text style={[styles.title, { fontSize: 28 }]}>Stocktaker</Text>
            <Text style={styles.subtitle}>Sign in to scan and move stock.</Text>
          </View>

          <Field
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <ErrorText message={error} />
          <Button title="Sign in" onPress={handleSubmit} loading={submitting} />

          <Text style={[styles.subtitle, { fontSize: 12, textAlign: 'center' }]}>Server: {BASE_URL}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
