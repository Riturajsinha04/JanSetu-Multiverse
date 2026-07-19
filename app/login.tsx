import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, Shield, LogIn, User } from 'lucide-react-native';
import { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useLang } from '../lib/langContext';

export default function LoginScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    username: '',
    password: '',
  });

  async function handleSubmit() {
    setError('');

    const uname = form.username.trim().toLowerCase();
    const pass = form.password;

    if (!uname || !pass) {
      setError(T.auth_error_credentials);
      return;
    }

    setLoading(true);

    // 1. Check local authentication bypass first
    if (uname === 'citizen' && pass === '123456') {
      await AsyncStorage.setItem('jansetu_local_auth', 'citizen');
      setLoading(false);
      router.replace('/(tabs)');
      return;
    }

    if (uname === 'admin' && pass === '123456') {
      await AsyncStorage.setItem('jansetu_local_auth', 'admin');
      setLoading(false);
      router.replace('/(tabs)');
      return;
    }

    // 2. Fallback to Supabase
    let email = form.username.trim();
    if (!email.includes('@')) {
      email = `${email.toLowerCase()}@jansetu.com`;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase(),
      password: form.password,
    });
    setLoading(false);

    if (signInError) {
      setError(T.auth_error_credentials);
    } else {
      router.replace('/(tabs)');
    }
  }

  function handlePrefill(username: string) {
    setForm({
      username: username,
      password: '123456',
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoSection}>
            <View style={styles.logoRow}>
              <View style={styles.logoBox}>
                <Text style={styles.logoText}>JS</Text>
              </View>
              <View>
                <Text style={styles.logoTitle}>JanSetu</Text>
                <Text style={styles.logoSubtitle}>MULTIVERSE</Text>
              </View>
            </View>
            <Text style={styles.tagline}>
              Sign in to access the civic intelligence platform
            </Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <Shield size={14} color="white" />
              <Text style={styles.cardHeaderLabel}>SECURE LOGIN</Text>
            </View>

            {/* Card Body */}
            <View style={styles.cardBody}>
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Username</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={16} color="#9ca3af" />
                  <TextInput
                    value={form.username}
                    onChangeText={v => setForm(f => ({ ...f, username: v }))}
                    placeholder="Enter your username"
                    autoCapitalize="none"
                    style={styles.input}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Lock size={16} color="#9ca3af" />
                  <TextInput
                    value={form.password}
                    onChangeText={v => setForm(f => ({ ...f, password: v }))}
                    placeholder="Enter your password"
                    secureTextEntry
                    style={styles.input}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <LogIn size={15} color="white" />
                    <Text style={styles.submitButtonText}>Sign In</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>

          {/* Demo Credentials Box */}
          <View style={styles.demoCard}>
            <Text style={styles.demoTitle}>DEMO CREDENTIALS</Text>
            
            <Pressable 
              onPress={() => handlePrefill('citizen')}
              style={[styles.demoRow, styles.demoRowBorder]}
            >
              <View style={[styles.iconCircle, styles.citizenCircle]}>
                <User size={14} color="#3b82f6" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.demoLabel}>Citizen: </Text>
                <Text style={styles.demoValue}>ID: citizen / Pass: 123456</Text>
              </View>
            </Pressable>

            <Pressable 
              onPress={() => handlePrefill('admin')}
              style={styles.demoRow}
            >
              <View style={[styles.iconCircle, styles.adminCircle]}>
                <Shield size={14} color="#a855f7" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.demoLabel}>Admin: </Text>
                <Text style={styles.demoValue}>ID: admin / Pass: 123456</Text>
              </View>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerDot} />
            <Text style={styles.footerText}>Secured with local authentication</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  logoTitle: {
    fontWeight: '800',
    fontSize: 22,
    color: '#111827',
  },
  logoSubtitle: {
    fontSize: 9,
    color: '#f97316',
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 1,
  },
  tagline: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 16,
  },
  cardHeader: {
    backgroundColor: '#f97316',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 1.5,
  },
  cardBody: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 42,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingLeft: 8,
    fontSize: 13,
    color: '#111827',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#f97316',
  },
  submitButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  demoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 12,
  },
  demoTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  demoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citizenCircle: {
    backgroundColor: '#eff6ff',
  },
  adminCircle: {
    backgroundColor: '#faf5ff',
  },
  demoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  demoValue: {
    fontSize: 12,
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  footerText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
});
