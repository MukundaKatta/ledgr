import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function takePhoto() {
    if (!cameraRef.current) return;
    const result = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (result) {
      setPhoto(result.uri);
      setCameraMode(false);
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  }

  async function uploadReceipt() {
    if (!photo) return;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!membership) throw new Error('No organization');

      // Upload to Supabase Storage
      const fileName = `receipts/${membership.organization_id}/${Date.now()}.jpg`;
      const response = await fetch(photo);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      Alert.alert(
        'Receipt Uploaded',
        'Your receipt has been uploaded. You can attach it to a transaction from the web app.',
        [{ text: 'OK', onPress: () => setPhoto(null) }]
      );
    } catch (error) {
      Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setUploading(false);
    }
  }

  if (cameraMode) {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ color: '#111827', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
            Camera permission is needed to scan receipts
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Grant Permission</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
          <View style={{ flex: 1, justifyContent: 'flex-end', padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              <TouchableOpacity
                onPress={() => setCameraMode(false)}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={takePhoto}
                style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: '#fff', borderWidth: 4, borderColor: '#4f46e5',
                }}
              />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 }}>
          Scan Receipt
        </Text>
        <Text style={{ color: '#6b7280', marginBottom: 24 }}>
          Take a photo or choose from your gallery to save a receipt
        </Text>

        {photo ? (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <Image source={{ uri: photo }} style={{ flex: 1 }} resizeMode="contain" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setPhoto(null)}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 8,
                  borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center',
                }}
              >
                <Text style={{ color: '#6b7280', fontWeight: '600' }}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={uploadReceipt}
                disabled={uploading}
                style={{
                  flex: 1, backgroundColor: '#4f46e5', paddingVertical: 14,
                  borderRadius: 8, alignItems: 'center', opacity: uploading ? 0.7 : 1,
                }}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
            <TouchableOpacity
              onPress={() => setCameraMode(true)}
              style={{
                backgroundColor: '#4f46e5', paddingVertical: 48, borderRadius: 16,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 32, marginBottom: 8 }}>
                {/* Camera icon placeholder */}
                [Camera]
              </Text>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickImage}
              style={{
                borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed',
                paddingVertical: 32, borderRadius: 16, alignItems: 'center',
              }}
            >
              <Text style={{ color: '#6b7280', fontSize: 16, fontWeight: '600' }}>
                Choose from Gallery
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
