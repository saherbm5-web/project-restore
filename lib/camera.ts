'use client';

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

async function convertHeicToBase64(dataUrl: string, format: string): Promise<string> {
  if (format === 'image/heic' || format === 'image/heif') {
    try {
      const heic2any = (await import('heic2any')).default;
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.8 }) as Blob;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(converted);
      });
    } catch {
      return dataUrl;
    }
  }
  return dataUrl;
}

export async function captureAndUpload(
  field: string,
  identifier: string,
): Promise<{ url: string | null; preview: string | null }> {
  let base64Data: string;
  let mimeType: string;

  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
      quality: 80,
      allowEditing: false,
      correctOrientation: true,
      promptLabelPhoto: 'اختر من المعرض',
      promptLabelPicture: 'التقط صورة',
    });

    if (!photo.base64String) return { url: null, preview: null };

    mimeType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    base64Data = `data:${mimeType};base64,${photo.base64String}`;

    const converted = await convertHeicToBase64(base64Data, `image/${photo.format}`);
    if (converted !== base64Data) {
      base64Data = converted;
      mimeType = 'image/jpeg';
    }
  } else {
    const file = await pickFileFromWeb();
    if (!file) return { url: null, preview: null };

    mimeType = file.type || 'image/jpeg';
    base64Data = await fileToBase64(file);
    const converted = await convertHeicToBase64(base64Data, mimeType);
    if (converted !== base64Data) {
      base64Data = converted;
      mimeType = 'image/jpeg';
    }
  }

  const fileName = `${field}-${identifier || 'unknown'}-${Date.now()}.jpeg`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('driver-docs')
    .upload(fileName, decode(base64Data), {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error('UPLOAD ERROR:', uploadError);
    return { url: null, preview: null };
  }

  const { data: urlData } = supabase.storage.from('driver-docs').getPublicUrl(uploadData.path);
  return { url: urlData.publicUrl, preview: base64Data };
}

function decode(base64Data: string): Uint8Array {
  const base64 = base64Data.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pickFileFromWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,image/jpeg,image/png,image/jpg,image/webp,image/heic,image/heif';
    input.onchange = () => {
      if (input.files && input.files[0]) {
        resolve(input.files[0]);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}
