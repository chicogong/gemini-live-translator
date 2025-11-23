import { Blob } from '@google/genai';

/**
 * Converts a base64 string to a Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array to a base64 string.
 */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes raw PCM data into an AudioBuffer.
 * Expects 16-bit little-endian PCM at the given sample rate.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert int16 range (-32768 to 32767) to float range (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Simple linear interpolation downsampler to convert any sample rate to 16000Hz.
 */
export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input;
  
  const ratio = inputRate / 16000;
  const newLength = Math.ceil(input.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
      const idx = i * ratio;
      const intIdx = Math.floor(idx);
      const frac = idx - intIdx;
      
      const val1 = input[intIdx] || 0;
      const val2 = input[intIdx + 1] || val1;
      
      result[i] = val1 * (1 - frac) + val2 * frac;
  }
  return result;
}

/**
 * Creates a Gemni-compatible Blob from raw Float32 microphone data.
 * Converts Float32 (-1.0 to 1.0) to Int16 PCM.
 * ENFORCES 16000Hz.
 */
export function createPcmBlob(data: Float32Array): Blob {
  // Assuming data is already downsampled to 16k by caller
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=16000`,
  };
}