
export interface ActivityLog {
  id: string;
  date: string; // ISO Date
  type: 'login' | 'mission_complete' | 'training' | 'diet_generated' | 'martial_arts';
  details?: string;
  xpEarned: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  password?: string; // Simulating auth
  provider: 'email' | 'google';
  birthDate?: string; // For age verification
  level: number;
  xp: number;
  streak: number;
  lastLogin: string; // ISO Date
  coins: number;
  isHardcore: boolean;
  themeColor: string; // New field for UI customization
  inventory: string[];
  stats: {
    strength: number;
    discipline: number;
    intelligence: number;
  };
  history: ActivityLog[];
}

export interface Mission {
  id: string;
  title: string;
  xp: number;
  completed: boolean;
  type: 'daily' | 'one-time';
}

export interface LeaderboardEntry {
  name: string;
  level: number;
  streak: number;
  mode: 'Normal' | 'Hardcore';
}

export enum Tab {
  MISSIONS = 'missions',
  TRAINING = 'training',
  MARTIAL_ARTS = 'martial_arts',
  DIET = 'diet',
  TOOLS = 'tools',
  PROGRESS = 'progress',
  SHOP = 'shop',
  PROFILE = 'profile',
  MOTIVATION = 'motivation',
  LEADERBOARD = 'leaderboard',
  CHAT = 'chat'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TrainingPlan {
  split: string;
  days: {
    day: string;
    focus: string;
    exercises: { 
      name: string; 
      sets: string; 
      reps: string;
      substitution?: string; // Alternative exercise
      tip?: string; // Execution tip or injury warning
    }[];
  }[];
}

export interface MartialArtsPlan {
  style: string;
  focus: string;
  duration: string;
  warmup: string[];
  rounds: {
    number: number;
    name: string;
    duration: string;
    drills: string[];
    focusPoint: string;
  }[];
  cooldown: string[];
}

export interface DietPlan {
  calories: number;
  meals: {
    name: string;
    items: string[];
  }[];
}