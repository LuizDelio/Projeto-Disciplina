
export interface Mission {
  id: string;
  label: string;
  points: number;
  isCustom?: boolean;
}

export interface DailyLog {
  date: string; // ISO Date string YYYY-MM-DD
  missionId: string;
  status: 'completed' | 'failed';
  pointsChange: number;
}

export type AiTone = 'brutal' | 'mentor' | 'scientist';

export interface UserProfile {
  name: string;
  age: string;
  weight: string;
  height: string;
  tone: AiTone;
  facePhotoUrl?: string; // Foto do rosto em Base64
  faceDescription?: string; // Descrição gerada pela IA para reconhecimento
}

export interface Goal {
  id: string;
  label: string;
  completed: boolean;
  rewardPoints: number;
}

export interface ProgressEntry {
  id: string;
  date: string;
  imageUrl: string;
  analysis: string;
}

export interface Alarm {
  id: string;
  time: string; // HH:mm
  label: string;
  active: boolean;
}

export interface Exercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  tips: string;
}

export interface WorkoutDay {
  title: string; // Ex: Treino A - Peito
  exercises: Exercise[];
}

export interface ExerciseLog {
  date: string;
  exerciseName: string;
  weight: number; // Carga em KG
}

export interface DailyWorkoutFeedback {
  date: string;
  rpe: number; // 1-10 Rate of Perceived Exertion
  notes: string;
}

export interface WorkoutPlan {
  id: string;
  createdAt: string;
  overview: string; // Resumo da estratégia
  days: WorkoutDay[];
  userFeedback?: string; // Feedback geral
}

// Novos tipos para Chat e Journal
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  timestamp: number;
}

// Novos tipos para Dieta
export interface Recipe {
  name: string;
  calories: string;
  costEstimate: string; // Estimativa de custo
  time: string;
  ingredients: string[];
  instructions: string[];
  videoQuery: string; // Termo de busca para o YouTube
  benefits: string; // Por que essa receita ajuda no objetivo
}

export interface AppState {
  points: number;
  xp: number;
  strikes: number;
  missions: Mission[];
  logs: DailyLog[];
  hardcoreMode: boolean;
  lastResetDate: string | null;
  lastPunishmentDate?: string;
  profile: UserProfile;
  goals: Goal[];
  aiAnalysis?: string;
  progressLogs: ProgressEntry[];
  alarms: Alarm[];
  workoutPlan?: WorkoutPlan;
  exerciseLogs: ExerciseLog[]; 
  workoutFeedbacks: DailyWorkoutFeedback[];
  workoutChatHistory: ChatMessage[];
  workoutJournal: JournalEntry[];
  // Novo campo
  dietRecipes: Recipe[];
}

export interface Reward {
  id: string;
  label: string;
  cost: number;
  icon: string;
}
