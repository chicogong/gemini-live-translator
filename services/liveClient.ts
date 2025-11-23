import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeBase64, decodeAudioData } from '../utils';
import { Language, Scenario } from '../types';

interface LiveClientConfig {
  apiKey: string;
  sourceLanguage: Language;
  targetLanguage: Language;
  scenario: Scenario;
  onTranscriptUpdate: (text: string, isUser: boolean, isComplete: boolean) => void;
  onAudioVisualizer: (volume: number) => void;
  onClose: () => void;
  onError: (error: Error) => void;
}

export class GeminiLiveClient {
  private config: LiveClientConfig;
  private client: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  // Audio Playback
  private nextStartTime = 0;
  private scheduledSources = new Set<AudioBufferSourceNode>();

  constructor(config: LiveClientConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  public async connect() {
    try {
      // 1. Setup Audio Input with explicit Echo Cancellation
      // This is critical to prevent the model from hearing itself and "saying it twice"
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
      });
      
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // 2. Setup Gemini Live Session
      const systemInstruction = this.getSystemInstruction();
      
      this.session = await this.client.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            inputAudioTranscription: {}, // Enable user speech to text
            outputAudioTranscription: {}, // Enable model speech to text (subtitles)
        },
        callbacks: {
            onopen: this.handleOnOpen.bind(this),
            onmessage: this.handleOnMessage.bind(this),
            onclose: this.handleOnClose.bind(this),
            onerror: this.handleOnError.bind(this)
        }
      });

    } catch (error: any) {
      this.config.onError(error);
    }
  }

  public disconnect() {
    if (this.session) {
      try {
        this.session.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
    }
    
    // Cleanup Audio Nodes
    this.processor?.disconnect();
    this.inputSource?.disconnect();
    this.audioContext?.close();
    
    // Stop Microphone Stream
    this.stream?.getTracks().forEach(track => track.stop());

    this.scheduledSources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    this.scheduledSources.clear();

    this.config.onClose();
  }

  private getSystemInstruction(): string {
    const { sourceLanguage, targetLanguage, scenario } = this.config;
    const base = `You are a professional simultaneous interpreter. Translate strictly between ${sourceLanguage} and ${targetLanguage}. Do not answer the user's questions, only translate them.`;

    switch(scenario) {
        case Scenario.LECTURE:
            return `${base} The context is a classroom lecture. Focus on clarity, academic tone, and precise terminology. Ensure students can follow the concepts efficiently.`;
        case Scenario.MEETING:
            return `${base} The context is a professional business meeting. Use formal business terminology. Be concise, professional, and maintain the speaker's nuance.`;
        case Scenario.CONVERSATION:
        default:
            return `${base} The context is a face-to-face conversation. Keep the tone natural, friendly, and conversational. Capture the emotion and speed of the conversation.`;
    }
  }

  private handleOnOpen() {
    if (!this.audioContext || !this.stream) return;

    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const source = inputCtx.createMediaStreamSource(this.stream);
    
    // 4096 buffer size = ~256ms latency at 16kHz
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.config.onAudioVisualizer(rms * 5); 

        // Create blob and send
        const pcmBlob = createPcmBlob(inputData);
        // Use session promise to prevent race conditions if connect isn't fully ready
        if (this.session) {
             this.session.sendRealtimeInput({ media: pcmBlob });
        }
    };

    source.connect(processor);
    processor.connect(inputCtx.destination);

    this.inputSource = source;
    this.processor = processor;
  }

  private async handleOnMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    
    // 1. Handle Interruption
    // CRITICAL: Check this first. If model is interrupted, we must clear buffers to prevent double-speech or old text appearing.
    if (content?.interrupted) {
        this.currentOutputTranscription = '';
        this.currentInputTranscription = '';
        this.scheduledSources.forEach(s => {
            try { s.stop(); } catch(e) {}
        });
        this.scheduledSources.clear();
        this.nextStartTime = 0;
        return; // Exit immediately
    }

    // 2. Handle Text Transcriptions
    // User Input Transcription
    if (content?.inputTranscription) {
        this.currentInputTranscription += content.inputTranscription.text;
        this.config.onTranscriptUpdate(this.currentInputTranscription, true, false);
    }

    // Model Output Transcription
    if (content?.outputTranscription) {
        this.currentOutputTranscription += content.outputTranscription.text;
        this.config.onTranscriptUpdate(this.currentOutputTranscription, false, false);
    }

    // 3. Handle Turn Completion (Finalize Text)
    if (content?.turnComplete) {
        // Send one final update with isComplete = true
        if (this.currentInputTranscription.trim()) {
            this.config.onTranscriptUpdate(this.currentInputTranscription, true, true);
            this.currentInputTranscription = ''; // Reset for next turn
        }
        if (this.currentOutputTranscription.trim()) {
            this.config.onTranscriptUpdate(this.currentOutputTranscription, false, true);
            this.currentOutputTranscription = ''; // Reset for next turn
        }
    }

    // 4. Handle Audio Output
    const audioData = content?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.audioContext) {
        try {
            const bytes = decodeBase64(audioData);
            const buffer = await decodeAudioData(bytes, this.audioContext, 24000);
            
            // Calculate Audio Volume for visualizer (approximate from buffer)
            const channelData = buffer.getChannelData(0);
            let sum = 0;
            // Sample a few points for efficiency
            for(let i=0; i<channelData.length; i+=100) sum += channelData[i]*channelData[i];
            const rms = Math.sqrt(sum / (channelData.length/100));
            this.config.onAudioVisualizer(rms * 5);

            const source = this.audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioContext.destination);

            // Schedule playback
            const now = this.audioContext.currentTime;
            // Ensure we don't schedule in the past
            const startTime = Math.max(now, this.nextStartTime);
            source.start(startTime);
            
            this.nextStartTime = startTime + buffer.duration;
            
            this.scheduledSources.add(source);
            source.onended = () => this.scheduledSources.delete(source);

        } catch (e) {
            console.error("Audio decode error", e);
        }
    }
  }

  private handleOnClose(event: CloseEvent) {
    console.log("Session closed", event);
    this.disconnect();
  }

  private handleOnError(event: ErrorEvent) {
    console.error("Session error", event);
    this.config.onError(new Error("Connection error occurred."));
    this.disconnect();
  }
}