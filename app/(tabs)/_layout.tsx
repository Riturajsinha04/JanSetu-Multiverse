import { Tabs, useRouter } from 'expo-router';
import { Home, FileText, Search, Shield, MapPin, Scale, Languages } from 'lucide-react-native';
import { View, Text, StyleSheet, ActivityIndicator, Image, Pressable } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useLang } from '../../lib/langContext';
import { SafeAreaView } from 'react-native-safe-area-context';

function CustomHeader() {
  const { lang, toggleLang } = useLang();

  return (
    <SafeAreaView edges={['top']} style={styles.headerContainer}>
      <View style={styles.headerContent}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
        />
        <Pressable onPress={toggleLang} style={styles.langButton}>
          <Languages size={15} color="#ea580c" />
          <Text style={styles.langText}>
            {lang === 'en' ? 'हिन्दी' : 'English'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const localAuth = await AsyncStorage.getItem('jansetu_local_auth');
      if (localAuth) {
        setAuthenticated(true);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        setAuthenticated(true);
      }
      setLoading(false);
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const localAuth = await AsyncStorage.getItem('jansetu_local_auth');
      if (!session && !localAuth) {
        router.replace('/login');
        setAuthenticated(false);
      } else {
        setAuthenticated(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <CustomHeader />,
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1F2937',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: 'File',
          tabBarIcon: ({ color }) => <FileText size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color }) => <Search size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="hazardmap"
        options={{
          title: 'Hazards',
          tabBarIcon: ({ color }) => <MapPin size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rti"
        options={{
          title: 'RTI',
          tabBarIcon: ({ color }) => <Scale size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  logo: {
    width: 110,
    height: 36,
    resizeMode: 'contain',
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
});

