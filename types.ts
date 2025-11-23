export enum Language {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  CHINESE = 'Chinese (Mandarin)',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  RUSSIAN = 'Russian',
  PORTUGUESE = 'Portuguese',
  ITALIAN = 'Italian',
  HINDI = 'Hindi'
}

export enum Scenario {
  CONVERSATION = 'Face-to-Face',
  LECTURE = 'Lecture / Class',
  MEETING = 'Meeting / Conference'
}

export interface TranscriptItem {
  id: string;
  source: 'user' | 'model';
  text: string;
  timestamp: number;
  isComplete: boolean;
}

export interface AudioVisualizerData {
  volume: number; // 0.0 to 1.0
}