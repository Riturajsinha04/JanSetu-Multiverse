import { ScrollView, View, Text, Pressable, TextInput, Alert, ActivityIndicator, Platform, Image, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import {
  Brain, MapPin, AlertTriangle, CheckCircle, ArrowRight, Loader,
  FileText, Mic, MicOff, Volume2, ChevronDown, LogIn, Download,
  Camera as CameraIcon, Image as ImageIcon
} from 'lucide-react-native';
import { useState, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import { createComplaint } from '../../lib/neo4j';
import { analyzeComplaint } from '../../lib/aiAnalyzer';
import { LOCATIONS, CITY_OPTIONS } from '../../lib/locations';
import { useLang } from '../../lib/langContext';
import { supabase } from '../../lib/supabase';
import { compressImage, formatBytes } from '../../lib/imageCompressor';
import { validateComplaintWithLLM } from '../../lib/llmValidator';
import AsyncStorage from '@react-native-async-storage/async-storage';

const URGENCY_CONFIG = {
  LOW: { label: 'Low', colors: 'bg-blue-100 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  MEDIUM: { label: 'Medium', colors: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  HIGH: { label: 'High', colors: 'bg-orange-100 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Critical', colors: 'bg-red-100 border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
};

const VOICE_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

const CUSTOM_RECORDING_OPTIONS: any = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: 2, // MPEG_4
    audioEncoder: 3, // AAC
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: 0x7f,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

export default function SubmitScreen() {
  const { T } = useLang();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    text: '',
    area: '',
    ward: '',
    city: 'Delhi',
  });
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeComplaint> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [voiceLang, setVoiceLang] = useState<'en' | 'hi' | 'pa' | 'bn' | 'ta'>('en');
  const [showVoiceLangDropdown, setShowVoiceLangDropdown] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  // Image & LLM state variables
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [compressedImage, setCompressedImage] = useState<any | null>(null);
  const [llmValidating, setLlmValidating] = useState(false);
  const [llmResult, setLlmResult] = useState<any | null>(null);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  const filteredLocations = LOCATIONS.filter(l => l.city === form.city);

  useEffect(() => {
    async function loadUserData() {
      try {
        const localAuth = await AsyncStorage.getItem('jansetu_local_auth');
        if (localAuth) {
          setForm(f => ({
            ...f,
            name: localAuth === 'admin' ? 'Admin User' : 'Citizen User',
            phone: '9876543210',
          }));
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          const u = session.user;
          const fullName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Citizen User';
          setForm(f => ({
            ...f,
            name: fullName,
            phone: u.phone || '9876543210',
          }));
        }
      } catch (err) {
        console.log("Error loading user data in submit screen", err);
      }
    }
    loadUserData();
  }, []);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow microphone access to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        CUSTOM_RECORDING_OPTIONS
      );
      recordingRef.current = newRecording;
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording audio.');
    }
  }

  async function stopRecording() {
    const rec = recordingRef.current;
    if (!rec) return;
    setIsRecording(false);
    recordingRef.current = null;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  }

  async function transcribeAudio(uri: string) {
    setTranscribing(true);
    setError('');
    try {
      const formData = new FormData();
      
      const filename = uri.split('/').pop() || 'audio.m4a';
      const match = /\.(\w+)$/.exec(filename);
      let type = match ? `audio/${match[1]}` : 'audio/x-m4a';
      if (type === 'audio/m4a') {
        type = 'audio/x-m4a';
      }

      formData.append('file', {
        uri: uri,
        name: filename,
        type: type,
      } as any);

      formData.append('model', 'saaras:v3');

      const langCodeMap = {
        en: 'en-IN',
        hi: 'hi-IN',
        pa: 'pa-IN',
        bn: 'bn-IN',
        ta: 'ta-IN',
      };
      const langCode = langCodeMap[voiceLang] || 'en-IN';
      formData.append('language_code', langCode);

      const apiKey = process.env.EXPO_PUBLIC_SARVAM_API_KEY;
      if (!apiKey) {
        throw new Error('Sarvam API key is missing.');
      }

      const response = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      if (data && data.transcript) {
        setForm(f => ({ ...f, text: data.transcript }));
        setAnalysis(null);
      } else {
        throw new Error('No transcript returned from Sarvam AI.');
      }
    } catch (err: any) {
      console.error('Speech transcription error:', err, uri);
      setError(`Failed to transcribe voice: ${err.message || err}`);
    } finally {
      setTranscribing(false);
    }
  }

  async function runAnalysis() {
    if (!form.text.trim() || form.text.length < 10) return;
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 900));
    setAnalysis(analyzeComplaint(form.text));
    setAnalyzing(false);
  }

  async function fetchCurrentLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission not granted for geotagging photo');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (loc && loc.coords) {
        const { latitude, longitude } = loc.coords;
        setLocationCoords({ latitude, longitude });

        // Calculate closest city geographically first (highly robust fallback)
        const centers = [
          { name: 'Noida', lat: 28.5355, lng: 77.3910 },
          { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
          { name: 'Ghaziabad', lat: 28.6692, lng: 77.4538 }
        ];

        let minDistance = Infinity;
        let detectedCity = 'Delhi';
        for (const center of centers) {
          const dist = Math.hypot(latitude - center.lat, longitude - center.lng);
          if (dist < minDistance) {
            minDistance = dist;
            detectedCity = center.name;
          }
        }

        // Run reverse geocoding to automatically set city and area!
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverse && reverse.length > 0) {
          const address = reverse[0];
          
          // Fallback check: double check if address has specific city keys
          const addressText = Object.values(address)
            .filter(val => typeof val === 'string')
            .join(' ')
            .toLowerCase();

          if (addressText.includes('delhi')) {
            detectedCity = 'Delhi';
          } else if (addressText.includes('ghaziabad')) {
            detectedCity = 'Ghaziabad';
          } else if (addressText.includes('noida') || addressText.includes('gautam buddh')) {
            detectedCity = 'Noida';
          }

          const cityLocations = LOCATIONS.filter(l => l.city === detectedCity);
          let matchedArea = null;

          // Attempt 1: Substring match of any area option in addressText
          for (const locOption of cityLocations) {
            const areaLower = locOption.area.toLowerCase();
            if (addressText.includes(areaLower)) {
              matchedArea = locOption;
              break;
            }
          }

          // Attempt 2: Extract sector number if city is Noida
          if (!matchedArea && detectedCity === 'Noida') {
            const sectorMatch = addressText.match(/sector\s*(\d+[a-z]?)/i) || 
                                addressText.match(/sec\s*(\d+[a-z]?)/i) ||
                                addressText.match(/\b(\d+)\b/);
            if (sectorMatch) {
              const sectorNum = sectorMatch[1];
              const sectorStr = `sector ${sectorNum}`;
              matchedArea = cityLocations.find(l => l.area.toLowerCase() === sectorStr || l.area.toLowerCase().startsWith(sectorStr));
            }
          }

          if (matchedArea) {
            setForm(f => ({
              ...f,
              city: matchedArea.city,
              area: matchedArea.area,
              ward: matchedArea.ward,
            }));
          } else {
            setForm(f => ({
              ...f,
              city: detectedCity,
              area: '',
              ward: '',
            }));
          }
        } else {
          // Geocode failed or empty, set by geographic closest center
          setForm(f => ({
            ...f,
            city: detectedCity,
            area: '',
            ward: '',
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching GPS location for photo geotag:', err);
    }
  }

  async function detectAndFillLocation() {
    setDetectingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location access to detect your city and area.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.Highest,
      });
      if (loc && loc.coords) {
        const { latitude, longitude } = loc.coords;
        setLocationCoords({ latitude, longitude });

        // Calculate closest city geographically first (highly robust fallback)
        const centers = [
          { name: 'Noida', lat: 28.5355, lng: 77.3910 },
          { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
          { name: 'Ghaziabad', lat: 28.6692, lng: 77.4538 }
        ];

        let minDistance = Infinity;
        let detectedCity = 'Delhi';
        for (const center of centers) {
          const dist = Math.hypot(latitude - center.lat, longitude - center.lng);
          if (dist < minDistance) {
            minDistance = dist;
            detectedCity = center.name;
          }
        }

        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        let matchedArea = null;

        if (reverse && reverse.length > 0) {
          const address = reverse[0];
          console.log('Detected geocoded address:', address);

          // Fallback check: double check if address has specific city keys
          const addressText = Object.values(address)
            .filter(val => typeof val === 'string')
            .join(' ')
            .toLowerCase();

          if (addressText.includes('delhi')) {
            detectedCity = 'Delhi';
          } else if (addressText.includes('ghaziabad')) {
            detectedCity = 'Ghaziabad';
          } else if (addressText.includes('noida') || addressText.includes('gautam buddh')) {
            detectedCity = 'Noida';
          }

          const cityLocations = LOCATIONS.filter(l => l.city === detectedCity);

          // Attempt 1: Substring match of any area option in addressText
          for (const locOption of cityLocations) {
            const areaLower = locOption.area.toLowerCase();
            if (addressText.includes(areaLower)) {
              matchedArea = locOption;
              break;
            }
          }

          // Attempt 2: Extract sector number if city is Noida
          if (!matchedArea && detectedCity === 'Noida') {
            const sectorMatch = addressText.match(/sector\s*(\d+[a-z]?)/i) || 
                                addressText.match(/sec\s*(\d+[a-z]?)/i) ||
                                addressText.match(/\b(\d+)\b/);
            if (sectorMatch) {
              const sectorNum = sectorMatch[1];
              const sectorStr = `sector ${sectorNum}`;
              matchedArea = cityLocations.find(l => l.area.toLowerCase() === sectorStr || l.area.toLowerCase().startsWith(sectorStr));
            }
          }
        }

        if (matchedArea) {
          setForm(f => ({
            ...f,
            city: matchedArea.city,
            area: matchedArea.area,
            ward: matchedArea.ward,
          }));
          Alert.alert(
            'Location Detected',
            `Set to:\nCity: ${matchedArea.city}\nArea: ${matchedArea.area}\nWard: ${matchedArea.ward}`
          );
        } else {
          setForm(f => ({
            ...f,
            city: detectedCity,
            area: '',
            ward: '',
          }));
          Alert.alert(
            'City Detected',
            `Detected you are near ${detectedCity}.\nPlease choose your area manually.`
          );
        }
      }
    } catch (err: any) {
      console.error('Error auto-detecting location:', err);
      Alert.alert('Detection Failed', 'Could not retrieve device GPS location.');
    } finally {
      setDetectingLocation(false);
    }
  }

  async function pickImage() {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your photos to upload an image.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      const asset = pickerResult.assets[0];

      // Google Photos / cloud URIs (content://) cannot be read directly.
      // Copy to local cache so compression and upload always work.
      let localUri = asset.uri;
      try {
        if (asset.uri.startsWith('content://') || asset.uri.startsWith('ph://')) {
          const filename = `picked_${Date.now()}.jpg`;
          const destPath = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.copyAsync({ from: asset.uri, to: destPath });
          localUri = destPath;
        }
      } catch (copyErr) {
        console.warn('Could not copy image to local cache, using original URI:', copyErr);
        // Fallback — use original URI, may still work on some devices
      }

      setImageUri(localUri);
      setCompressedImage(null);
      setLlmResult(null);
      setLocationCoords(null);
      setError('');

      // Fetch GPS coordinates in parallel
      fetchCurrentLocation();

      try {
        setAnalyzing(true);
        const compressed = await compressImage(
          localUri,
          asset.width,
          asset.height,
          asset.fileSize
        );
        setCompressedImage(compressed);
      } catch (err) {
        console.error('Image compression error:', err);
        setError('Failed to compress the image.');
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function takePhoto() {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'You need to allow access to your camera to take a photo.');
      return;
    }

    const pickerResult = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      const asset = pickerResult.assets[0];
      setImageUri(asset.uri);
      setCompressedImage(null);
      setLlmResult(null);
      setLocationCoords(null);
      setError('');

      // Fetch GPS coordinates in parallel
      fetchCurrentLocation();

      try {
        setAnalyzing(true);
        const compressed = await compressImage(
          asset.uri,
          asset.width,
          asset.height,
          asset.fileSize
        );
        setCompressedImage(compressed);
      } catch (err) {
        console.error('Image compression error:', err);
        setError('Failed to compress the image.');
      } finally {
        setAnalyzing(false);
      }
    }
  }

  async function handleSubmit() {
    if (!form.name || !form.text || !form.area || !form.ward) {
      setError(T.submit_error_fields);
      return;
    }
    if (!analysis) {
      setError(T.submit_error_analyze);
      return;
    }

    setError('');
    setLlmValidating(true);

    try {
      // 1. Validate Image (if present) + Text Context with Gemini 1.5 Flash
      const validation = await validateComplaintWithLLM(
        form.text,
        analysis.issue_type,
        compressedImage ? compressedImage.base64Data : null,
        compressedImage ? compressedImage.mimeType : 'image/jpeg'
      );

      setLlmResult(validation);
      setLlmValidating(false);

      if (!validation.valid) {
        setError(`AI Verification Failed: ${validation.reason}`);
        return;
      }

      // 2. LLM Approved -> Send Single POST request with complaint info and compressed image file via FormData
      setSubmitting(true);
      const baseServerUrl = process.env.EXPO_PUBLIC_COMPLAINT_SERVER_URL || 'https://jansetu-multiverse.onrender.com';
      // Always ensure the correct API endpoint path
      const serverUrl = baseServerUrl.replace(/\/+$/, '') + '/api/complaint';
      let serverPostOk = false;

      // Generate a local complaint number as fallback
      const localComplaintNumber = `JS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`;

      if (serverUrl) {
        try {
          const formData = new FormData();

          formData.append('name', form.name);
          formData.append('phone', form.phone);
          formData.append('text', form.text);
          formData.append('area', form.area);
          formData.append('ward', form.ward);
          formData.append('city', form.city);
          formData.append('issue_type', validation.issue_confirmed || analysis.issue_type);
          formData.append('urgency', analysis.urgency);
          formData.append('department', analysis.department);
          formData.append('summary', analysis.summary);
          formData.append('voice_transcript', form.text);
          formData.append('complaint_number', localComplaintNumber);

          if (locationCoords) {
            formData.append('latitude', locationCoords.latitude.toString());
            formData.append('longitude', locationCoords.longitude.toString());
          } else {
            formData.append('latitude', '');
            formData.append('longitude', '');
          }

          formData.append('llm_validation', JSON.stringify({
            valid: validation.valid,
            confidence: validation.confidence,
            reason: validation.confidence === 'LOW' ? 'Auto-approved (validation service unavailable)' : (validation.reason || ''),
            issue_confirmed: validation.issue_confirmed
          }));

          const serverRes = await fetch(serverUrl, {
            method: 'POST',
            body: formData,
          });

          if (serverRes.ok) {
            serverPostOk = true;
          } else {
            const errorBody = await serverRes.text().catch(() => '');
            console.error('Server POST failed:', serverRes.status, errorBody);
          }
        } catch (postErr: any) {
          console.error('Error posting complaint to server:', postErr);
        }
      }

      // 3. Create Neo4j complaint node (non-fatal)
      let complaintNumber = localComplaintNumber;
      try {
        complaintNumber = await createComplaint({
          citizenName: form.name,
          citizenPhone: form.phone || '',
          rawText: form.text,
          language: analysis.language,
          issueType: validation.issue_confirmed || analysis.issue_type,
          summary: analysis.summary,
          urgency: analysis.urgency,
          department: analysis.department,
          area: form.area,
          ward: form.ward,
          userId: undefined,
          voiceTranscript: form.text,
          llmValidated: validation.valid,
          llmConfidence: validation.confidence,
          latitude: locationCoords ? locationCoords.latitude : undefined,
          longitude: locationCoords ? locationCoords.longitude : undefined,
        });
      } catch (neo4jErr) {
        console.error('Neo4j createComplaint failed (non-fatal):', neo4jErr);
        // Use local complaint number as fallback
      }

      setSubmitted(complaintNumber);
    } catch (err) {
      console.error('Submit complaint error:', err);
      setError(T.submit_error_submit);
    } finally {
      setLlmValidating(false);
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView style={styles.scrollContainer}>
          <View style={{ padding: 24, alignItems: 'center', justifyContent: 'center', minHeight: '80%' }}>
            <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 32, width: '100%', maxWidth: 400, alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <CheckCircle size={40} color="#22c55e" />
              </View>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>{T.submit_success_title}</Text>
              <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>{T.submit_success_msg}</Text>

              <View style={{ backgroundColor: '#fff7ed', borderHorizontalWidth: 1, borderColor: '#ffedd5', borderRadius: 16, padding: 20, marginBottom: 24, width: '100%' }}>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 4 }}>{T.submit_your_number}</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#ea580c', textAlign: 'center', letterSpacing: 2 }}>{submitted}</Text>
                <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>{T.submit_save_number}</Text>
              </View>

              <View style={{ gap: 12, width: '100%' }}>
                <Pressable
                  onPress={() => router.push('/track')}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: '#f97316', borderRadius: 12 }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '600' }}>{T.submit_track_btn}</Text>
                  <ArrowRight size={16} color="white" />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSubmitted(null);
                    setForm(f => ({ ...f, text: '', area: '', ward: '' }));
                    setAnalysis(null);
                    setImageUri(null);
                    setCompressedImage(null);
                    setLlmResult(null);
                  }}
                  style={{ paddingVertical: 14, backgroundColor: '#f1f5f9', borderRadius: 12 }}
                >
                  <Text style={{ color: '#475569', fontWeight: '600', textAlign: 'center' }}>{T.submit_file_another}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        {/* Photo Upload Container */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Attach Photo (Optional)</Text>
          <Text style={styles.sectionSubtitle}>
            Optionally take a photo or select an image showing the issue.
          </Text>

          <View style={styles.dashedBox}>
            {imageUri ? (
              <View style={{ width: '100%' }}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.attachedImage}
                  resizeMode="cover"
                />
                
                <View style={{ marginVertical: 8, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7' }}>
                  <MapPin size={14} color="#16a34a" style={{ marginRight: 6 }} />
                  {locationCoords ? (
                    <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '600' }}>
                      GPS Geotagged: {locationCoords.latitude.toFixed(5)}, {locationCoords.longitude.toFixed(5)}
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#16a34a" style={{ marginRight: 6, transform: [{ scale: 0.7 }] }} />
                      <Text style={{ fontSize: 11, color: '#15803d', fontWeight: '500' }}>Acquiring GPS Coordinates...</Text>
                    </View>
                  )}
                </View>

                <Pressable onPress={() => { setImageUri(null); setCompressedImage(null); setLocationCoords(null); }} style={styles.removeImageBtn}>
                  <Text style={styles.removeImageText}>Remove Photo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.dashedBoxInner}>
                <ImageIcon size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={styles.dashedBoxText}>No image selected</Text>
              </View>
            )}
          </View>

          <View style={styles.photoBtnRow}>
            <Pressable onPress={takePhoto} style={styles.photoBtn}>
              <CameraIcon size={16} color="#475569" />
              <Text style={styles.photoBtnText}>Camera</Text>
            </Pressable>
            <Pressable onPress={pickImage} style={styles.photoBtn}>
              <ImageIcon size={16} color="#475569" />
              <Text style={styles.photoBtnText}>Gallery</Text>
            </Pressable>
          </View>

          {imageUri && !compressedImage && (
            <View style={styles.compressingRow}>
              <ActivityIndicator size="small" color="#ea580c" />
              <Text style={styles.compressingText}>Compressing image...</Text>
            </View>
          )}

          {compressedImage && (
            <View style={styles.compressedRow}>
              <CheckCircle size={14} color="#10b981" />
              <Text style={styles.compressedText}>
                Compressed: {formatBytes(compressedImage.originalSize)} → {formatBytes(compressedImage.compressedSize)}
              </Text>
            </View>
          )}
        </View>

        {/* Voice Input Container */}
        <View style={[styles.voiceCard, { zIndex: 20 }]}>
          <View style={styles.voiceCardHeader}>
            <Volume2 size={18} color="#4f46e5" />
            <Text style={styles.voiceTitle}>Select Language Input</Text>
          </View>

          <View style={styles.voiceCardControlsRow}>
            {/* Language Selector Button */}
            <Pressable
              onPress={() => setShowVoiceLangDropdown(!showVoiceLangDropdown)}
              style={styles.voiceDropdownBtn}
            >
              <Text style={styles.voiceDropdownBtnText}>
                {VOICE_LANGUAGES.find(l => l.code === voiceLang)?.native || 'English'}
              </Text>
              <ChevronDown size={14} color="#475569" style={{ marginLeft: 4 }} />
            </Pressable>

            <Pressable
              onPress={() => {
                if (!isRecording) {
                  startRecording();
                  setShowVoiceLangDropdown(false);
                } else {
                  stopRecording();
                }
              }}
              disabled={transcribing}
              style={[styles.speakBtn, isRecording && { backgroundColor: '#ef4444' }, transcribing && { backgroundColor: '#e2e8f0' }]}
            >
              {isRecording ? <MicOff size={14} color="white" /> : <Mic size={14} color="white" />}
              <Text style={styles.speakBtnText}>{isRecording ? 'Stop' : 'Speak'}</Text>
            </Pressable>
          </View>

          {showVoiceLangDropdown && (
            <View style={styles.voiceDropdownList}>
              {VOICE_LANGUAGES.map(lang => (
                <Pressable
                  key={lang.code}
                  onPress={() => {
                    setVoiceLang(lang.code as any);
                    setShowVoiceLangDropdown(false);
                  }}
                  style={styles.voiceDropdownItem}
                >
                  <Text style={[styles.voiceDropdownItemText, voiceLang === lang.code && { color: '#4f46e5', fontWeight: '700' }]}>
                    {lang.native} ({lang.label})
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {isRecording && (
            <View style={styles.recordingRow}>
              <ActivityIndicator size="small" color="#ef4444" />
              <Text style={styles.recordingText}>
                Listening in {VOICE_LANGUAGES.find(l => l.code === voiceLang)?.label}...
              </Text>
            </View>
          )}

          {transcribing && (
            <View style={styles.recordingRow}>
              <ActivityIndicator size="small" color="#4f46e5" />
              <Text style={[styles.recordingText, { color: '#4f46e5' }]}>
                Transcribing audio with Sarvam AI...
              </Text>
            </View>
          )}
        </View>

        {/* Complaint Text Container */}
        <View style={styles.card}>
          <Text style={styles.inputLabel}>Complaint Text *</Text>
          <TextInput
            value={form.text}
            onChangeText={text => { setForm(f => ({ ...f, text })); setAnalysis(null); }}
            placeholder="e.g. Hamare area mein street light kharab hai aur raat ko unsafe lagta hai... or: The road has a large pothole causing accidents..."
            multiline
            numberOfLines={4}
            style={styles.textArea}
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.charCounter}>{form.text.length} characters</Text>

          <Pressable
            onPress={runAnalysis}
            disabled={form.text.length < 10 || analyzing}
            style={[
              styles.analyzeBtn,
              (form.text.length < 10 || analyzing) ? styles.analyzeBtnDisabled : styles.analyzeBtnActive
            ]}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : (
              <Brain size={16} color={form.text.length < 10 ? '#9ca3af' : 'white'} />
            )}
            <Text style={[
              styles.analyzeBtnText,
              form.text.length < 10 ? styles.analyzeBtnTextDisabled : styles.analyzeBtnTextActive
            ]}>
              {analyzing ? 'Analyzing...' : 'Analyze with AI'}
            </Text>
          </Pressable>
        </View>

        {/* AI Analysis Result */}
        {analysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
              <Brain size={18} color="#4f46e5" />
              <Text style={styles.analysisTitle}>AI Analysis Complete</Text>
            </View>

            <View style={styles.analysisGrid}>
              <View style={styles.analysisCol}>
                <Text style={styles.analysisLabel}>Issue Type</Text>
                <Text style={styles.analysisVal}>{analysis.issue_type}</Text>
              </View>
              <View style={styles.analysisCol}>
                <Text style={styles.analysisLabel}>Department</Text>
                <Text style={styles.analysisVal}>{analysis.department.split(' ')[0]}</Text>
              </View>
            </View>

            <View style={styles.analysisGrid}>
              <View style={styles.analysisCol}>
                <Text style={styles.analysisLabel}>Urgency</Text>
                <Text style={styles.analysisVal}>{analysis.urgency}</Text>
              </View>
              <View style={styles.analysisCol}>
                <Text style={styles.analysisLabel}>Language</Text>
                <Text style={styles.analysisVal}>{analysis.language === 'hi' ? 'Hindi / हिंदी' : 'English'}</Text>
              </View>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Summary</Text>
              <Text style={styles.summaryVal}>{analysis.summary}</Text>
            </View>
          </View>
        )}

        {/* Location Details Container */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.orangeCircle}>
              <Text style={styles.orangeCircleText}>3</Text>
            </View>
            <Text style={styles.sectionHeading}>Location Details</Text>
          </View>

          <Pressable
            onPress={detectAndFillLocation}
            disabled={detectingLocation}
            style={styles.gpsDetectBtn}
          >
            {detectingLocation ? (
              <ActivityIndicator size="small" color="#ea580c" />
            ) : (
              <MapPin size={16} color="#ea580c" />
            )}
            <Text style={styles.gpsDetectBtnText}>
              {detectingLocation ? 'Detecting Location...' : 'Auto-Detect Location (GPS)'}
            </Text>
          </Pressable>

          <Text style={styles.inputLabel}>City *</Text>
          <View style={styles.cityBtnRow}>
            {['Delhi', 'Noida', 'Ghaziabad'].map(city => {
              const isSelected = form.city === city;
              return (
                <Pressable
                  key={city}
                  onPress={() => {
                    setForm(f => ({ ...f, city, area: '', ward: '' }));
                    setShowAreaModal(false);
                  }}
                  style={[
                    styles.cityBtn,
                    isSelected ? styles.cityBtnSelected : styles.cityBtnUnselected
                  ]}
                >
                  <Text style={[
                    styles.cityBtnText,
                    isSelected ? styles.cityBtnTextSelected : styles.cityBtnTextUnselected
                  ]}>
                    {city}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.inputLabel}>Area / Locality *</Text>
            <Pressable
              onPress={() => {
                setAreaSearchQuery('');
                setShowAreaModal(true);
              }}
              style={styles.dropdownSelectorBtn}
            >
              <Text style={[styles.dropdownSelectorText, !form.area && { color: '#9ca3af' }]}>
                {form.area || `Select area in ${form.city}`}
              </Text>
              <ChevronDown size={16} color="#64748b" />
            </Pressable>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.inputLabel}>Ward</Text>
            <TextInput
              value={form.ward}
              editable={false}
              placeholder="Auto-filled from area"
              style={[styles.textInput, styles.disabledInput]}
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>

        {/* LLM Status / Auditing Indicator */}
        {llmValidating && (
          <View style={styles.statusBox}>
            <ActivityIndicator size="small" color="#4f46e5" />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>AI Context Audit Running</Text>
              <Text style={styles.statusText}>Analyzing photo relevance & checking for spam...</Text>
            </View>
          </View>
        )}

        {/* LLM Result approved */}
        {llmResult && llmResult.valid && (
          <View style={[styles.statusBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
            <CheckCircle size={20} color="#10b981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: '#064e3b' }]}>AI Verification Passed</Text>
              <Text style={[styles.statusText, { color: '#047857' }]}>
                {llmResult.confidence === 'LOW' && llmResult.reason?.includes('unavailable')
                  ? 'Validation service temporarily unavailable. Form submitted without AI verification.'
                  : (llmResult.reason || 'Verified successfully.')}
              </Text>
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <AlertTriangle size={16} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting || llmValidating || !analysis}
          style={[
            styles.submitBtn,
            (submitting || llmValidating || !analysis) ? styles.submitBtnDisabled : styles.submitBtnActive
          ]}
        >
          {submitting || llmValidating ? (
            <ActivityIndicator size="small" color="#9ca3af" style={{ marginRight: 8 }} />
          ) : (
            <ArrowRight size={20} color={(!analysis) ? '#94a3b8' : 'white'} style={{ marginRight: 8 }} />
          )}
          <Text style={[
            styles.submitBtnText,
            (!analysis) ? styles.submitBtnTextDisabled : styles.submitBtnTextActive
          ]}>
            {llmValidating ? 'Verifying...' : submitting ? 'Submitting...' : 'Submit'}
          </Text>
        </Pressable>

        {!analysis && (
          <Text style={styles.analyzeHint}>Analyze your complaint with AI before submitting</Text>
        )}
      </ScrollView>

      {/* Area / Locality Selection Modal */}
      <Modal
        visible={showAreaModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAreaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Area / Locality</Text>
              <Pressable
                onPress={() => setShowAreaModal(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>Cancel</Text>
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.modalSearchContainer}>
              <TextInput
                value={areaSearchQuery}
                onChangeText={setAreaSearchQuery}
                placeholder="Search area..."
                placeholderTextColor="#94a3b8"
                style={styles.modalSearchInput}
                autoFocus={true}
              />
            </View>

            {/* Area List */}
            <ScrollView
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
            >
              {filteredLocations
                .filter(l => l.area.toLowerCase().includes(areaSearchQuery.toLowerCase()))
                .map(loc => (
                  <Pressable
                    key={loc.area}
                    onPress={() => {
                      setForm(f => ({ ...f, area: loc.area, ward: loc.ward }));
                      setShowAreaModal(false);
                    }}
                    style={[
                      styles.modalListItem,
                      form.area === loc.area && styles.modalListItemSelected
                    ]}
                  >
                    <Text style={[
                      styles.modalListItemText,
                      form.area === loc.area && styles.modalListItemTextSelected
                    ]}>
                      {loc.area}
                    </Text>
                    {form.area === loc.area && (
                      <CheckCircle size={16} color="#4f46e5" />
                    )}
                  </Pressable>
                ))
              }
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  dashedBox: {
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    marginBottom: 12,
  },
  dashedBoxInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedBoxText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  uploadedImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  attachedImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  removeImageBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  removeImageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  photoBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  gpsDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 14,
    marginTop: 8,
  },
  gpsDetectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
  },
  compressingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  compressingText: {
    fontSize: 12,
    color: '#64748b',
  },
  compressedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  compressedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  voiceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 16,
  },
  voiceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  voiceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4f46e5',
  },
  voiceCardControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  voiceDropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'space-between',
  },
  voiceDropdownBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  voiceDropdownList: {
    position: 'absolute',
    top: 90,
    left: 14,
    right: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 999,
  },
  voiceDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  voiceDropdownItemText: {
    fontSize: 12,
    color: '#334155',
  },
  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    minWidth: 90,
  },
  speakBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  recordingText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    height: 100,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 12,
  },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  analyzeBtnActive: {
    backgroundColor: '#4f46e5',
  },
  analyzeBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  analyzeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  analyzeBtnTextActive: {
    color: '#ffffff',
  },
  analyzeBtnTextDisabled: {
    color: '#94a3b8',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  orangeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orangeCircleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  cityBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityBtnSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  cityBtnUnselected: {
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  cityBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cityBtnTextSelected: {
    color: '#ea580c',
  },
  cityBtnTextUnselected: {
    color: '#64748b',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  disabledInput: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  dropdownBox: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 999,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#334155',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f3ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#312e81',
  },
  statusText: {
    fontSize: 11,
    color: '#4f46e5',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnActive: {
    backgroundColor: '#f97316',
  },
  submitBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtnTextActive: {
    color: '#ffffff',
  },
  submitBtnTextDisabled: {
    color: '#94a3b8',
  },
  analyzeHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  analysisCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    padding: 16,
    marginBottom: 16,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#312e81',
  },
  analysisGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  analysisCol: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
  },
  analysisLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  analysisVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  summaryBox: {
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    padding: 10,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#4f46e5',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  summaryVal: {
    fontSize: 12,
    color: '#312e81',
  },
  dropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  dropdownSelectorText: {
    flex: 1,
    fontSize: 13,
    color: '#1e293b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  modalCloseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCloseBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  modalSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalSearchInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  modalList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalListItemSelected: {
    borderBottomColor: '#e0e7ff',
  },
  modalListItemText: {
    fontSize: 14,
    color: '#334155',
  },
  modalListItemTextSelected: {
    color: '#4f46e5',
    fontWeight: '700',
  },
});
