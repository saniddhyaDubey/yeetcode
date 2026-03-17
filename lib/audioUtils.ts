// RMS threshold — audio below this level is considered silence
const SPEECH_THRESHOLD = 0.0375;

// Blobs smaller than this (bytes) are too short to contain speech
const MIN_AUDIO_BYTES = 1000;

/**
 * Analyses an audio blob using RMS (Root Mean Square) energy.
 * Returns true if the blob likely contains speech.
 */
export async function detectSpeech(audioBlob: Blob): Promise<boolean> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    if (arrayBuffer.byteLength < MIN_AUDIO_BYTES) return false;

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);

    let sum = 0;
    for (let i = 0; i < channelData.length; i++) {
      sum += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sum / channelData.length);

    return rms > SPEECH_THRESHOLD;
  } catch {
    // If decoding fails, assume speech so we don't silently drop audio
    return true;
  }
}

/**
 * Decodes a base64 string into a Blob of the given MIME type.
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Combines an array of audio Blobs and returns a base64-encoded string.
 */
export function blobsToBase64(blobs: Blob[]): Promise<string> {
  const combined = new Blob(blobs, { type: "audio/webm" });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(combined);
  });
}
