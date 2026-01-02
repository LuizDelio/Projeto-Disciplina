
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { 
  Trophy, 
  Flame, 
  Target, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Trash2, 
  ShoppingBag,
  Skull,
  TrendingUp,
  Settings,
  Zap,
  Star,
  Dices,
  Clock,
  User,
  BrainCircuit,
  Dumbbell,
  Quote,
  Image as ImageIcon,
  Download,
  Camera,
  ScanEye,
  Upload,
  Sword,
  Scroll,
  FlaskConical,
  Mic,
  MicOff,
  Radio,
  Fingerprint,
  UserSquare2,
  Timer,
  AlarmClock,
  Watch,
  Play,
  Pause,
  RotateCcw,
  Bell,
  RefreshCw,
  BicepsFlexed,
  CalendarDays,
  Activity,
  Save,
  LineChart,
  ClipboardList,
  AlertOctagon,
  MessageSquare,
  Send,
  Book,
  Bot,
  ToggleRight,
  ToggleLeft,
  Utensils,
  ChefHat,
  Youtube,
  Banknote,
  Wrench
} from 'lucide-react';
import { BASE_MISSIONS, REALITY_CHECKS, REWARDS, SUGGESTED_MISSIONS } from './constants';
import { AppState, Mission, DailyLog, Goal, ProgressEntry, AiTone, Alarm, WorkoutPlan, ExerciseLog, DailyWorkoutFeedback, ChatMessage, JournalEntry, Recipe } from './types';
import StatsChart from './components/StatsChart';

// --- Utility Components ---

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button
    onClick={onClick}
    className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 flex-1 md:flex-none py-2 md:py-3 px-2 md:px-4 text-[10px] md:text-sm font-bold transition-all duration-200 border-t-2 md:border-t-0 md:border-l-2 md:w-full md:rounded-r-lg ${
      active 
        ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5' 
        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
    }`}
  >
    <Icon size={20} className="shrink-0 md:w-[18px] md:h-[18px]" />
    <span className="md:inline">{label}</span>
  </button>
);

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl ${className}`}>
    {children}
  </div>
);

// --- Audio Utilities ---

function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Simple Beep for Alarm/Timer
const playBeep = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'square';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
  
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};

// --- Main App ---

const App: React.FC = () => {
  // State Initialization
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('discipline_protocol_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration for new properties
      return {
        ...parsed,
        xp: parsed.xp || 0,
        profile: { 
          name: parsed.profile?.name || '', 
          age: parsed.profile?.age || '', 
          weight: parsed.profile?.weight || '', 
          height: parsed.profile?.height || '',
          tone: parsed.profile?.tone || 'brutal',
          facePhotoUrl: parsed.profile?.facePhotoUrl || undefined,
          faceDescription: parsed.profile?.faceDescription || undefined
        },
        goals: parsed.goals || [],
        aiAnalysis: parsed.aiAnalysis || '',
        progressLogs: parsed.progressLogs || [],
        alarms: parsed.alarms || [],
        workoutPlan: parsed.workoutPlan || undefined,
        exerciseLogs: parsed.exerciseLogs || [],
        workoutFeedbacks: parsed.workoutFeedbacks || [],
        workoutChatHistory: parsed.workoutChatHistory || [],
        workoutJournal: parsed.workoutJournal || [],
        dietRecipes: parsed.dietRecipes || []
      };
    }
    return {
      points: 0,
      xp: 0,
      strikes: 0,
      missions: BASE_MISSIONS,
      logs: [],
      hardcoreMode: true,
      lastResetDate: null,
      profile: { name: '', age: '', weight: '', height: '', tone: 'brutal' },
      goals: [],
      aiAnalysis: '',
      progressLogs: [],
      alarms: [],
      workoutPlan: undefined,
      exerciseLogs: [],
      workoutFeedbacks: [],
      workoutChatHistory: [],
      workoutJournal: [],
      dietRecipes: []
    };
  });

  const [activeTab, setActiveTab] = useState<'missions' | 'rewards' | 'stats' | 'profile' | 'motivation' | 'progress' | 'tools' | 'workout' | 'diet'>('missions');
  const [workoutSubTab, setWorkoutSubTab] = useState<'plan' | 'chat' | 'journal'>('plan');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMissionName, setNewMissionName] = useState('');
  const [newMissionPoints, setNewMissionPoints] = useState('');
  
  // Goal Modal State
  const [newGoalName, setNewGoalName] = useState('');
  
  const [realityCheck, setRealityCheck] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [scoreBump, setScoreBump] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Motivation Tab State
  const [motivationQuote, setMotivationQuote] = useState<string>("");
  const [motivationImage, setMotivationImage] = useState<string | null>(null);
  const [isLoadingMotivation, setIsLoadingMotivation] = useState(false);
  
  // Progress Tab State
  const [isAnalyzingBody, setIsAnalyzingBody] = useState(false);
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  // Tools Tab State
  const [activeTool, setActiveTool] = useState<'pomodoro' | 'alarm' | 'stopwatch'>('pomodoro');
  
  // Workout Tab State (Expanded)
  const [workoutGoal, setWorkoutGoal] = useState('Hipertrofia');
  const [workoutLevel, setWorkoutLevel] = useState('Intermediário');
  const [workoutDays, setWorkoutDays] = useState('4');
  const [workoutEquipment, setWorkoutEquipment] = useState('Academia Completa');
  const [workoutInjuries, setWorkoutInjuries] = useState('');
  const [workoutTimeAvailable, setWorkoutTimeAvailable] = useState('60'); // Minutes
  const [workoutWeakPoints, setWorkoutWeakPoints] = useState('');
  const [workoutFavorites, setWorkoutFavorites] = useState('');
  const [workoutStylePreference, setWorkoutStylePreference] = useState('Padrão (Balanced)');
  
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [workoutFeedback, setWorkoutFeedback] = useState('');
  
  // Diet Tab State
  const [dietGoal, setDietGoal] = useState('Perder Peso (Definição)');
  const [dietLikes, setDietLikes] = useState('');
  const [dietAvailable, setDietAvailable] = useState('');
  const [dietBudget, setDietBudget] = useState('');
  const [isGeneratingDiet, setIsGeneratingDiet] = useState(false);

  // Chat & Journal State
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [journalInput, setJournalInput] = useState('');
  const [isAnalyzingJournal, setIsAnalyzingJournal] = useState(false);
  const [journalAnalysisResult, setJournalAnalysisResult] = useState('');

  // Daily Feedback State
  const [dailyRPE, setDailyRPE] = useState(5);
  const [dailyNotes, setDailyNotes] = useState('');
  const [currentInputs, setCurrentInputs] = useState<{[key: string]: string}>({});

  // Pomodoro State
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoIsActive, setPomoIsActive] = useState(false);
  const [pomoMode, setPomoMode] = useState<'focus' | 'short' | 'long'>('focus');
  
  // Stopwatch State
  const [swTime, setSwTime] = useState(0);
  const [swIsActive, setSwIsActive] = useState(false);
  const swIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const swStartTimeRef = useRef<number>(0);

  // Alarm State
  const [newAlarmTime, setNewAlarmTime] = useState('');
  const [alarmTriggered, setAlarmTriggered] = useState<string | null>(null);

  // Animation State
  const [pointAnimation, setPointAnimation] = useState<{show: boolean, value: number, label: string} | null>(null);

  // --- Live API State & Refs ---
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLiveSpeaking, setIsLiveSpeaking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveSessionRef = useRef<any>(null); // To store the session object
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextAudioStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  const disconnectLiveAPI = useCallback(() => {
    if (liveSessionRef.current) {
       liveSessionRef.current.then((session: any) => {
          try { session.close(); } catch (e) { console.error(e); }
       });
       liveSessionRef.current = null;
    }
    
    if (audioContextRef.current) {
       try { audioContextRef.current.close(); } catch (e) { console.error(e); }
       audioContextRef.current = null;
    }

    if (inputAudioContextRef.current) {
       try { inputAudioContextRef.current.close(); } catch (e) { console.error(e); }
       inputAudioContextRef.current = null;
    }

    if (inputStreamRef.current) {
       inputStreamRef.current.getTracks().forEach(track => track.stop());
       inputStreamRef.current = null;
    }

    if (processorRef.current) {
       processorRef.current.disconnect();
       processorRef.current = null;
    }

    if (audioSourcesRef.current) {
       audioSourcesRef.current.forEach(source => {
          try { source.stop(); } catch (e) {}
       });
       audioSourcesRef.current.clear();
    }
    
    setIsLiveActive(false);
    setIsLiveSpeaking(false);
    nextAudioStartTimeRef.current = 0;
  }, []);

  // Helper to access state in callbacks without closure staleness
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Persistence
  useEffect(() => {
    localStorage.setItem('discipline_protocol_v1', JSON.stringify(state));
  }, [state]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'workout' && workoutSubTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.workoutChatHistory, activeTab, workoutSubTab]);

  // Cleanup Live API on unmount
  useEffect(() => {
    return () => {
      disconnectLiveAPI();
    };
  }, [disconnectLiveAPI]);

  // Score Bump Animation Effect
  useEffect(() => {
    if (state.points > 0) {
      setScoreBump(true);
      const timer = setTimeout(() => setScoreBump(false), 200);
      return () => clearTimeout(timer);
    }
  }, [state.points]);

  // Global Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      // 1. 24h Countdown Logic
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);

      // 2. Pomodoro Logic
      if (pomoIsActive && pomoTime > 0) {
        setPomoTime(prev => prev - 1);
      } else if (pomoIsActive && pomoTime === 0) {
        setPomoIsActive(false);
        playBeep();
        if (pomoMode === 'focus') {
           setState(prev => ({ ...prev, xp: prev.xp + 50, points: prev.points + 10 }));
           setPointAnimation({ show: true, value: 10, label: "POMODORO CONCLUÍDO" });
           setTimeout(() => setPointAnimation(null), 1500);
        }
        alert(pomoMode === 'focus' ? "Foco concluído. Hora da pausa." : "Pausa concluída. Volte ao trabalho.");
      }

      // 3. Alarm Logic
      const currentHm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentSeconds = now.getSeconds();

      if (currentSeconds === 0) {
         stateRef.current.alarms.forEach(alarm => {
            if (alarm.active && alarm.time === currentHm) {
               playBeep();
               setAlarmTriggered(alarm.label || 'Alarme');
            }
         });
      }

    }, 1000);

    return () => clearInterval(timer);
  }, [pomoIsActive, pomoTime, pomoMode]);

  // Stopwatch Logic
  useEffect(() => {
    if (swIsActive) {
      swIntervalRef.current = setInterval(() => {
        const now = Date.now();
        setSwTime(now - swStartTimeRef.current);
      }, 10);
    } else {
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    }
    return () => {
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    };
  }, [swIsActive]);

  // Inactivity Check Logic
  useEffect(() => {
    const checkInactivity = () => {
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (state.lastPunishmentDate === todayStr) return;
      if (state.points === 0 && state.xp === 0) return;
      if (state.logs.length === 0) return;

      const completedYesterday = state.logs.some(
        log => log.date === yesterdayStr && log.status === 'completed'
      );

      if (!completedYesterday) {
        setRealityCheck("INATIVIDADE DETECTADA.\n\nVocê ignorou o protocolo por 24 horas.\nSeus pontos foram confiscados.");
        
        setState(prev => ({
          ...prev,
          points: 0,
          lastPunishmentDate: todayStr
        }));

        setTimeout(() => setRealityCheck(null), 8000);
      }
    };

    checkInactivity();
  }, []);

  // Derived State
  const today = new Date().toISOString().split('T')[0];
  const todaysLogs = state.logs.filter(log => log.date === today);
  const completedMissionIds = new Set(todaysLogs.filter(l => l.status === 'completed').map(l => l.missionId));
  const failedMissionIds = new Set(todaysLogs.filter(l => l.status === 'failed').map(l => l.missionId));

  // Level Calculations
  const XP_PER_LEVEL = 100;
  const currentLevel = Math.floor(state.xp / XP_PER_LEVEL) + 1;
  const xpProgress = state.xp % XP_PER_LEVEL;
  const xpPercent = (xpProgress / XP_PER_LEVEL) * 100;

  // Streak Calculation
  const currentStreak = (() => {
    let streak = 0;
    const todayObj = new Date();
    
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayObj);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      if (state.lastResetDate && dateStr < state.lastResetDate.split('T')[0]) {
        break;
      }

      const hasActivity = state.logs.some(l => l.date === dateStr && l.status === 'completed');
      
      if (hasActivity) {
        streak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }
    return streak;
  })();

  // --- Handlers ---

  const handleComplete = (mission: Mission) => {
    if (completedMissionIds.has(mission.id) || failedMissionIds.has(mission.id)) return;

    setPointAnimation({ show: true, value: mission.points, label: mission.label });
    setTimeout(() => setPointAnimation(null), 1500);

    setState(prev => ({
      ...prev,
      points: prev.points + mission.points,
      xp: prev.xp + 25,
      logs: [...prev.logs, {
        date: today,
        missionId: mission.id,
        status: 'completed',
        pointsChange: mission.points
      }]
    }));
  };

  const handleFail = (mission: Mission) => {
    if (completedMissionIds.has(mission.id) || failedMissionIds.has(mission.id)) return;

    const penalty = state.hardcoreMode ? 50 : 0;
    const newStrikes = state.hardcoreMode ? state.strikes + 1 : state.strikes;
    
    const msg = REALITY_CHECKS[Math.floor(Math.random() * REALITY_CHECKS.length)];
    setRealityCheck(msg);
    setTimeout(() => setRealityCheck(null), 6000);

    if (state.hardcoreMode && newStrikes >= 3) {
      alert("💀 FALHA DETECTADA.\n\nTrês falhas no Modo Hardcore.\nReset do Protocolo Iniciado.\n\nComece de Novo.");
      setState(prev => ({
        ...prev,
        points: 0,
        xp: 0,
        strikes: 0,
        logs: [], 
        lastResetDate: new Date().toISOString()
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      points: Math.max(0, prev.points - penalty),
      strikes: newStrikes,
      logs: [...prev.logs, {
        date: today,
        missionId: mission.id,
        status: 'failed',
        pointsChange: -penalty
      }]
    }));
  };

  const handleAddMission = () => {
    if (!newMissionName.trim() || !newMissionPoints) return;
    
    const newMission: Mission = {
      id: `custom_${Date.now()}`,
      label: newMissionName,
      points: parseInt(newMissionPoints),
      isCustom: true
    };

    setState(prev => ({
      ...prev,
      missions: [...prev.missions, newMission]
    }));
    
    setNewMissionName('');
    setNewMissionPoints('');
    setShowAddModal(false);
  };

  const handleAddGoal = () => {
    if (!newGoalName.trim()) return;
    const newGoal: Goal = {
      id: `goal_${Date.now()}`,
      label: newGoalName,
      completed: false,
      rewardPoints: 300 // Standard reward for a goal
    };
    setState(prev => ({
      ...prev,
      goals: [...prev.goals, newGoal]
    }));
    setNewGoalName('');
  };

  const handleCompleteGoal = (goalId: string) => {
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal || goal.completed) return;

    if (confirm(`Concluir meta "${goal.label}"? Você receberá ${goal.rewardPoints} pontos e 100XP.`)) {
      setPointAnimation({ show: true, value: goal.rewardPoints, label: "META: " + goal.label });
      setTimeout(() => setPointAnimation(null), 2000);
      
      setState(prev => ({
        ...prev,
        points: prev.points + goal.rewardPoints,
        xp: prev.xp + 100,
        goals: prev.goals.map(g => g.id === goalId ? { ...g, completed: true } : g)
      }));
    }
  };

  const handleDeleteGoal = (goalId: string) => {
    if(confirm("Remover esta meta?")) {
      setState(prev => ({
        ...prev,
        goals: prev.goals.filter(g => g.id !== goalId)
      }));
    }
  };

  const handleProfileChange = (field: keyof typeof state.profile, value: string) => {
    setState(prev => ({
      ...prev,
      profile: { ...prev.profile, [field]: value }
    }));
  };
  
  const handleToneChange = (tone: AiTone) => {
    setState(prev => ({
      ...prev,
      profile: { ...prev.profile, tone: tone }
    }));
  };

  // --- Tools Handlers ---

  const togglePomodoro = () => setPomoIsActive(!pomoIsActive);
  const resetPomodoro = () => {
    setPomoIsActive(false);
    if (pomoMode === 'focus') setPomoTime(25 * 60);
    else if (pomoMode === 'short') setPomoTime(5 * 60);
    else setPomoTime(15 * 60);
  };
  const setPomodoroMode = (mode: 'focus' | 'short' | 'long') => {
    setPomoMode(mode);
    setPomoIsActive(false);
    if (mode === 'focus') setPomoTime(25 * 60);
    else if (mode === 'short') setPomoTime(5 * 60);
    else setPomoTime(15 * 60);
  };
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleStopwatch = () => {
    if (swIsActive) {
      setSwIsActive(false);
    } else {
      swStartTimeRef.current = Date.now() - swTime;
      setSwIsActive(true);
    }
  };
  const resetStopwatch = () => {
    setSwIsActive(false);
    setSwTime(0);
  };
  const formatStopwatch = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const addAlarm = () => {
     if (!newAlarmTime) return;
     const newAlarm: Alarm = {
       id: `alarm_${Date.now()}`,
       time: newAlarmTime,
       label: 'Alarme',
       active: true
     };
     setState(prev => ({ ...prev, alarms: [...prev.alarms, newAlarm] }));
     setNewAlarmTime('');
  };

  const toggleAlarm = (id: string) => {
     setState(prev => ({
       ...prev,
       alarms: prev.alarms.map(a => a.id === id ? { ...a, active: !a.active } : a)
     }));
  };
  
  const deleteAlarm = (id: string) => {
     setState(prev => ({
       ...prev,
       alarms: prev.alarms.filter(a => a.id !== id)
     }));
  };

  // --- Diet Handlers ---

  const handleGenerateDiet = async () => {
    if (!process.env.API_KEY) {
      alert("API Key necessária para gerar o plano alimentar.");
      return;
    }

    if (!dietLikes || !dietAvailable) {
      alert("Preencha o que você gosta e o que tem em casa.");
      return;
    }

    setIsGeneratingDiet(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const prompt = `
        ATUE COMO: Um Nutricionista e Chef especializado em receitas baratas e fáceis.
        
        PERFIL:
        - Objetivo: ${dietGoal}
        - Alimentos que gosta: ${dietLikes}
        - Alimentos disponíveis em casa (DESPENSA): ${dietAvailable}
        - Orçamento Limite por receita: ${dietBudget ? 'R$ ' + dietBudget : 'O mais barato possível'}

        MISSÃO:
        Crie 4 receitas extremamente práticas, usando O MÁXIMO POSSÍVEL dos alimentos da despensa para economizar.
        As receitas devem ser focadas no objetivo (perder peso = baixa caloria/saciedade, ganhar peso = alta caloria/proteína).
        
        SAÍDA JSON OBRIGATÓRIA (Array de objetos):
        [
          {
            "name": "Nome Criativo da Receita",
            "calories": "X kcal",
            "costEstimate": "R$ X,XX (Estimado)",
            "time": "Tempo de preparo",
            "ingredients": ["ingrediente 1", "ingrediente 2"],
            "instructions": ["passo 1", "passo 2"],
            "videoQuery": "Termo exato para buscar essa receita no YouTube (ex: receita frango com batata doce facil)",
            "benefits": "Por que ajuda no objetivo"
          }
        ]
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.STRING },
                costEstimate: { type: Type.STRING },
                time: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                videoQuery: { type: Type.STRING },
                benefits: { type: Type.STRING }
              }
            }
          }
        }
      });

      const recipes = JSON.parse(response.text || "[]");
      setState(prev => ({
        ...prev,
        dietRecipes: recipes
      }));
      setPointAnimation({ show: true, value: 30, label: "PLANO ALIMENTAR CRIADO" });
      setTimeout(() => setPointAnimation(null), 1500);

    } catch (e) {
      console.error("Erro ao gerar dieta", e);
      alert("Falha ao criar receitas. Tente novamente.");
    } finally {
      setIsGeneratingDiet(false);
    }
  };

  // --- Workout Handlers ---

  const handleGenerateWorkout = async () => {
     if (!process.env.API_KEY) {
        alert("API Key necessária para o Treinador IA.");
        return;
     }

     setIsGeneratingWorkout(true);
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

     try {
       const prompt = `
         ATUE COMO: Um Treinador de Elite de Força e Condicionamento.
         
         PERFIL DO ALUNO:
         - Nome: ${state.profile.name || "Atleta"}
         - Idade: ${state.profile.age}
         - Peso: ${state.profile.weight}
         - Altura: ${state.profile.height}
         
         PARÂMETROS DE TREINO:
         - Objetivo: ${workoutGoal}
         - Nível: ${workoutLevel}
         - Equipamento Disponível: ${workoutEquipment}
         - Dias Disponíveis na semana: ${workoutDays}
         - Tempo por sessão: ${workoutTimeAvailable} minutos
         - Estilo de Treino Preferido: ${workoutStylePreference}
         - Lesões/Limitações: ${workoutInjuries || "Nenhuma"}
         - Pontos Fracos / Foco: ${workoutWeakPoints || "Geral"}
         - Exercícios Favoritos: ${workoutFavorites || "Sem preferência"}

         MISSÃO: Criar uma rotina de treino completa, periodizada e adaptada a este perfil.
         
         CRITÉRIOS DE ANÁLISE:
         1. Respeite estritamente o tempo disponível.
         2. Priorize os pontos fracos citados.
         3. Inclua os exercícios favoritos onde fizer sentido biomecanicamente.
         4. Evite exercícios que agravem as lesões citadas.
         5. Equilibre o volume para evitar overtraining (RPE alvo 7-9).

         SAÍDA JSON OBRIGATÓRIA:
         Seja extremamente específico com exercícios, séries, repetições e descanso.
       `;

       const response = await ai.models.generateContent({
         model: "gemini-3-flash-preview",
         contents: prompt,
         config: {
            responseMimeType: "application/json",
            responseSchema: {
               type: Type.OBJECT,
               properties: {
                  overview: { type: Type.STRING, description: "Visão geral da estratégia do treino, explicando como ele ataca os pontos fracos." },
                  days: {
                     type: Type.ARRAY,
                     items: {
                        type: Type.OBJECT,
                        properties: {
                           title: { type: Type.STRING, description: "Nome do treino (ex: Treino A - Peito)" },
                           exercises: {
                              type: Type.ARRAY,
                              items: {
                                 type: Type.OBJECT,
                                 properties: {
                                    name: { type: Type.STRING },
                                    sets: { type: Type.STRING },
                                    reps: { type: Type.STRING },
                                    rest: { type: Type.STRING },
                                    tips: { type: Type.STRING, description: "Dica de execução curta" }
                                 }
                              }
                           }
                        }
                     }
                  }
               }
            }
         }
       });

       const workoutData = JSON.parse(response.text || "{}");
       
       if (workoutData.days) {
          const newPlan: WorkoutPlan = {
             id: `plan_${Date.now()}`,
             createdAt: new Date().toISOString(),
             overview: workoutData.overview,
             days: workoutData.days
          };
          
          setState(prev => ({ ...prev, workoutPlan: newPlan }));
          setPointAnimation({ show: true, value: 50, label: "PLANO CRIADO" });
          setTimeout(() => setPointAnimation(null), 1500);
       }

     } catch (e) {
        console.error("Erro ao gerar treino", e);
        alert("Falha na criação do plano tático.");
     } finally {
        setIsGeneratingWorkout(false);
     }
  };

  const handleEvolveWorkout = async () => {
      if (!state.workoutPlan || !process.env.API_KEY) return;

      setIsGeneratingWorkout(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Get last 7 daily feedbacks
      const recentFeedbacks = state.workoutFeedbacks.slice(-7);
      const feedbacksStr = recentFeedbacks.map(f => `Data: ${f.date}, RPE: ${f.rpe}/10, Notas: ${f.notes}`).join('\n');

      // Get last 3 days of Journal
      const recentJournal = state.workoutJournal.slice(-3).map(j => `Data: ${j.date}, Nota: ${j.text}`).join('\n');

      // Get recent logs
      const recentLogs = state.exerciseLogs.slice(-20);
      const logsStr = recentLogs.map(l => `${l.exerciseName}: ${l.weight}kg`).join('\n');

      try {
         const prompt = `
            ATUE COMO: Treinador de Elite.
            CONTEXTO: O aluno está seguindo o plano. É hora de EVOLUIR (Carga Progressiva) ou DELOAD (Recuperação).
            
            TREINO ATUAL (JSON):
            ${JSON.stringify(state.workoutPlan)}

            DIÁRIO DE TREINO RECENTE (FEEDBACK TÉCNICO):
            ${feedbacksStr || "Sem feedback recente."}

            DIÁRIO PESSOAL (SENSAÇÕES/DORES):
            ${recentJournal || "Sem anotações no diário."}

            EVOLUÇÃO DE CARGAS RECENTE:
            ${logsStr || "Sem registros de carga."}

            NOTAS DE RPE (Percepção de Esforço):
            Analise o RPE e as notas do Diário Pessoal.
            - Se houver dor, remova o exercício causador.
            - Se estiver muito fácil, aumente volume/carga.
            - Se houver tédio, varie os exercícios mantendo o padrão de movimento.

            MISSÃO:
            Atualize o plano de treino para o próximo ciclo.
            - Mantenha a estrutura se estiver funcionando, mas aperte os parafusos.
            - Se o usuário relatou dor, ajuste para evitar a área ou sugerir reabilitação.
         `;

         const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
               responseMimeType: "application/json",
               responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                     overview: { type: Type.STRING, description: "Explicação das mudanças na evolução, citando o feedback do usuário." },
                     days: {
                        type: Type.ARRAY,
                        items: {
                           type: Type.OBJECT,
                           properties: {
                              title: { type: Type.STRING },
                              exercises: {
                                 type: Type.ARRAY,
                                 items: {
                                    type: Type.OBJECT,
                                    properties: {
                                       name: { type: Type.STRING },
                                       sets: { type: Type.STRING },
                                       reps: { type: Type.STRING },
                                       rest: { type: Type.STRING },
                                       tips: { type: Type.STRING }
                                    }
                                 }
                              }
                           }
                        }
                     }
                  }
               }
            }
          });

          const workoutData = JSON.parse(response.text || "{}");

          if (workoutData.days) {
             const newPlan: WorkoutPlan = {
                id: `plan_${Date.now()}`,
                createdAt: new Date().toISOString(),
                overview: workoutData.overview,
                days: workoutData.days
             };
             
             setState(prev => ({ ...prev, workoutPlan: newPlan }));
             alert("Plano de Treino Evoluído! Mais carga, mais resultado.");
          }

      } catch (e) {
         console.error("Erro na evolução", e);
         alert("Erro ao evoluir treino.");
      } finally {
         setIsGeneratingWorkout(false);
      }
  };

  const handleSmartPlanAdjustment = async () => {
    if (!state.workoutPlan || !process.env.API_KEY) {
       alert("É necessário ter um plano ativo e API Key.");
       return;
    }

    setIsGeneratingWorkout(true); // Reusing loading state
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Last 3 days journal
    const recentJournal = state.workoutJournal.slice(-5).map(j => `Data: ${j.date} - ${j.text}`).join('\n');

    try {
       const prompt = `
          ATUE COMO: Treinador de Alta Performance.
          OBJETIVO: Analisar as anotações recentes do diário do aluno e OTIMIZAR o plano de treino ATUAL para resolver problemas relatados (dor, tédio, facilidade, falta de tempo) ou potencializar pontos fortes.

          PLANO ATUAL (JSON):
          ${JSON.stringify(state.workoutPlan)}

          ANOTAÇÕES DO DIÁRIO (Últimos dias):
          ${recentJournal || "Nenhuma nota recente."}

          INSTRUÇÕES:
          1. Se o aluno relatou DOR em algum exercício, SUBSTITUA por um biomecanicamente similar mas mais seguro.
          2. Se o aluno disse que está FÁCIL, aumente o volume ou intensidade.
          3. Se o aluno disse que está SEM TEMPO, reduza o volume mantendo a intensidade.
          4. Se não houver queixas significativas, faça apenas micro-ajustes de otimização.

          SAÍDA JSON OBRIGATÓRIA (Estrutura do Plano de Treino):
          Retorne o objeto completo do plano atualizado.
       `;

       const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
             responseMimeType: "application/json",
             responseSchema: {
                type: Type.OBJECT,
                properties: {
                   overview: { type: Type.STRING, description: "Explique O QUE você mudou e POR QUE, com base nas notas do diário." },
                   days: {
                      type: Type.ARRAY,
                      items: {
                         type: Type.OBJECT,
                         properties: {
                            title: { type: Type.STRING },
                            exercises: {
                               type: Type.ARRAY,
                               items: {
                                  type: Type.OBJECT,
                                  properties: {
                                     name: { type: Type.STRING },
                                     sets: { type: Type.STRING },
                                     reps: { type: Type.STRING },
                                     rest: { type: Type.STRING },
                                     tips: { type: Type.STRING }
                                  }
                               }
                            }
                         }
                      }
                   }
                }
             }
          }
       });

       const workoutData = JSON.parse(response.text || "{}");

       if (workoutData.days) {
          const newPlan: WorkoutPlan = {
             id: `plan_adjusted_${Date.now()}`,
             createdAt: new Date().toISOString(),
             overview: workoutData.overview,
             days: workoutData.days
          };
          
          setState(prev => ({ ...prev, workoutPlan: newPlan }));
          setJournalAnalysisResult(workoutData.overview); // Show the explanation in the analysis box
          alert("Plano Ajustado com base no seu Diário!");
       }

    } catch (e) {
       console.error("Erro no ajuste inteligente", e);
       alert("Erro ao ajustar plano.");
    } finally {
       setIsGeneratingWorkout(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !process.env.API_KEY) return;

    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    const updatedHistory = [...state.workoutChatHistory, userMsg];
    
    setState(prev => ({ ...prev, workoutChatHistory: updatedHistory }));
    setChatInput('');
    setIsChatting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = `
        VOCÊ É UM TREINADOR PESSOAL IA DEDICADO.
        NOME DO ALUNO: ${state.profile.name}
        PERFIL: ${state.profile.age} anos, ${state.profile.weight}kg, ${state.profile.height}cm.
        PLANO DE TREINO ATUAL: ${state.workoutPlan ? JSON.stringify(state.workoutPlan.days.map(d => d.title)) : "Nenhum plano ativo."}
        OBJETIVO: ${state.workoutPlan?.overview || "Ficar forte."}
        
        INSTRUÇÕES:
        - Responda de forma curta, motivadora e técnica.
        - Use o tom ${state.profile.tone || 'brutal'}.
        - Se o usuário perguntar sobre substituir exercícios, dê opções biomecanicamente equivalentes.
        - Se o usuário reclamar de dor, sugira descanso ou médico.
      `;

      // Build recent history for context (last 10 messages)
      const historyContext = updatedHistory.slice(-10).map(msg => `${msg.role === 'user' ? 'ALUNO' : 'TREINADOR'}: ${msg.text}`).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${context}\n\nHISTÓRICO:\n${historyContext}\n\nALUNO: ${userMsg.text}`,
      });

      const aiText = response.text || "Sem resposta do comando.";
      const aiMsg: ChatMessage = { role: 'model', text: aiText, timestamp: Date.now() };

      setState(prev => ({ ...prev, workoutChatHistory: [...prev.workoutChatHistory, aiMsg] }));

    } catch (e) {
      console.error(e);
      const errorMsg: ChatMessage = { role: 'model', text: "Erro de comunicação com a base.", timestamp: Date.now() };
      setState(prev => ({ ...prev, workoutChatHistory: [...prev.workoutChatHistory, errorMsg] }));
    } finally {
      setIsChatting(false);
    }
  };

  const handleAddJournal = () => {
    if (!journalInput.trim()) return;
    const entry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      text: journalInput,
      timestamp: Date.now()
    };
    setState(prev => ({ ...prev, workoutJournal: [entry, ...prev.workoutJournal] }));
    setJournalInput('');
  };

  const handleAnalyzeJournal = async () => {
    if (!process.env.API_KEY) return;
    setIsAnalyzingJournal(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const todaysEntries = state.workoutJournal.filter(j => j.date === today);
      const todaysFeedback = state.workoutFeedbacks.find(f => f.date === today);
      const logs = state.exerciseLogs.filter(l => l.date === today);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `
        ANALISE O DIA DE TREINO DO ALUNO.
        
        NOTAS DIVERSAS DO DIA:
        ${todaysEntries.map(e => "- " + e.text).join('\n') || "Nenhuma nota."}

        FEEDBACK DE TREINO (RPE/DOR):
        RPE: ${todaysFeedback?.rpe || "?"}/10. 
        OBS: ${todaysFeedback?.notes || "Sem obs."}

        REGISTRO DE CARGAS DE HOJE:
        ${logs.map(l => `${l.exerciseName}: ${l.weight}kg`).join('\n') || "Sem registros de carga."}

        MISSÃO:
        Gere um relatório curto (max 3 parágrafos) analisando o desempenho mental e físico do aluno hoje.
        Dê 1 conselho prático para amanhã.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setJournalAnalysisResult(response.text || "Análise concluída.");

    } catch (e) {
      console.error(e);
      setJournalAnalysisResult("Erro na análise.");
    } finally {
      setIsAnalyzingJournal(false);
    }
  };

  const handleSaveLoad = (exerciseName: string) => {
    const val = currentInputs[exerciseName];
    if (!val) return;
    
    const weight = parseFloat(val);
    if (isNaN(weight)) return;

    const newLog: ExerciseLog = {
      date: new Date().toISOString().split('T')[0],
      exerciseName,
      weight
    };

    setState(prev => ({
      ...prev,
      exerciseLogs: [...prev.exerciseLogs, newLog],
      xp: prev.xp + 5 // Small XP for logging
    }));

    // Clear input
    setCurrentInputs(prev => ({...prev, [exerciseName]: ''}));
    
    // Tiny feedback
    setPointAnimation({ show: true, value: 5, label: "CARGA ANOTADA" });
    setTimeout(() => setPointAnimation(null), 1000);
  };

  const handleDailyFeedback = () => {
    const feedback: DailyWorkoutFeedback = {
      date: new Date().toISOString().split('T')[0],
      rpe: dailyRPE,
      notes: dailyNotes
    };

    setState(prev => ({
      ...prev,
      workoutFeedbacks: [...prev.workoutFeedbacks, feedback],
      points: prev.points + 15,
      xp: prev.xp + 20
    }));

    setDailyNotes('');
    setDailyRPE(5);
    alert("Diário de Treino salvo. A IA usará isso para ajustar seu próximo ciclo.");
  };

  const resetWorkout = () => {
     if(confirm("Tem certeza? Isso apagará o plano atual.")) {
        setState(prev => ({ ...prev, workoutPlan: undefined }));
     }
  };

  // --- Gemini Live API Implementation ---

  const connectToLiveAPI = async () => {
    if (!process.env.API_KEY) {
      alert("API Key necessária para o modo Voz.");
      return;
    }
    
    // Prevent double connections
    if (isLiveActive) return;

    try {
      // 1. Initialize Audio Contexts immediately (user gesture context)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await audioContext.resume(); // FORCE RESUME
      audioContextRef.current = audioContext;
      nextAudioStartTimeRef.current = audioContext.currentTime;

      // 2. Input Audio Setup with Echo Cancellation
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputAudioContextRef.current = inputCtx;
      await inputCtx.resume(); // FORCE RESUME

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true, // IMPORTANT for preventing feedback
          autoGainControl: true,
          noiseSuppression: true
        } 
      });
      inputStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Define tools
      const tools = [{
        functionDeclarations: [
          {
            name: "changeTab",
            description: "Muda a aba ativa do aplicativo. Use quando o usuário quiser ver 'missões', 'loja', 'perfil', 'motivação', 'progresso', 'ferramentas', 'diet' ou 'treino'.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                tab: { type: Type.STRING, enum: ['missions', 'rewards', 'stats', 'profile', 'motivation', 'progress', 'tools', 'workout', 'diet'] }
              },
              required: ['tab']
            }
          },
          {
             name: "createWorkout",
             description: "Inicia o processo de criação de treino na aba de treinos.",
             parameters: { type: Type.OBJECT, properties: {} }
          },
          {
            name: "startPomodoro",
            description: "Inicia o timer Pomodoro.",
            parameters: {
              type: Type.OBJECT,
              properties: {},
            }
          },
          {
            name: "addMission",
            description: "Adiciona uma nova missão personalizada à lista.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "O nome da missão" },
                points: { type: Type.NUMBER, description: "Quantidade de pontos" }
              },
              required: ['label', 'points']
            }
          },
          {
            name: "completeMissionByLabel",
            description: "Marca uma missão como concluída buscando pelo nome aproximado.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Parte do nome da missão" }
              },
              required: ['label']
            }
          },
          {
            name: "addGoal",
            description: "Adiciona uma nova meta de longo prazo.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Descrição da meta" }
              },
              required: ['label']
            }
          },
          {
            name: "completeGoal",
            description: "Marca uma meta de longo prazo como concluída pelo nome.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Nome da meta" }
              },
              required: ['label']
            }
          },
          {
            name: "removeGoal",
            description: "Remove/Deleta uma meta de longo prazo da lista.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "Nome da meta a ser removida" }
              },
              required: ['label']
            }
          },
          {
            name: "readAnalysis",
            description: "Lê o conteúdo da última análise de IA ou do registro de progresso corporal.",
            parameters: {
              type: Type.OBJECT,
              properties: {},
            }
          }
        ]
      }];

      // Dynamic System Instruction with User Name
      const userName = stateRef.current.profile.name || "Recruta";
      
      let systemInstruction = `Seu nome é SISTEMA. Você é a inteligência central com controle total sobre o Protocolo de Disciplina.`;
      systemInstruction += ` O nome do usuário (operador) é: "${userName}". SEMPRE se dirija a ele por este nome.`;
      
      const tone = stateRef.current.profile.tone;
      if (tone === 'mentor') systemInstruction += " Sua personalidade é de um mentor sábio, calmo e estoico. Fale devagar, use sabedoria.";
      else if (tone === 'scientist') systemInstruction += " Sua personalidade é de um cientista frio e analítico. Fale com precisão, foque em dados.";
      else systemInstruction += " Sua personalidade é de um comandante militar BRUTAL. GRITE (fale com energia), seja agressivo, exija disciplina. Não aceite desculpas.";

      systemInstruction += " Você tem controle total sobre o app. Se o usuário pedir para marcar algo, use as ferramentas. Se pedir para ler a análise, use a ferramenta.";

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          tools: tools,
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          },
          systemInstruction: systemInstruction
        }
      };

      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: async () => {
            setIsLiveActive(true);
            
            // Audio Streaming Setup
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16Data = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16Data[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
              }
              const base64Data = arrayBufferToBase64(int16Data.buffer);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            // 1. Handle Interruption
            if (msg.serverContent?.interrupted) {
                audioSourcesRef.current.forEach(source => {
                    try { source.stop(); } catch (e) {}
                });
                audioSourcesRef.current.clear();
                nextAudioStartTimeRef.current = 0;
                setIsLiveSpeaking(false);
                return; // Stop processing this message
            }

            // 2. Handle Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsLiveSpeaking(true);
              const audioCtx = audioContextRef.current;
              if (audioCtx) {
                const audioBytes = base64ToUint8Array(audioData);
                const int16 = new Int16Array(audioBytes.buffer);
                const float32 = new Float32Array(int16.length);
                for(let i=0; i<int16.length; i++) {
                   float32[i] = int16[i] / 32768.0;
                }

                const buffer = audioCtx.createBuffer(1, float32.length, 24000);
                buffer.getChannelData(0).set(float32);

                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtx.destination);
                
                const startTime = Math.max(audioCtx.currentTime, nextAudioStartTimeRef.current);
                source.start(startTime);
                nextAudioStartTimeRef.current = startTime + buffer.duration;
                
                audioSourcesRef.current.add(source);
                source.onended = () => {
                   audioSourcesRef.current.delete(source);
                   if (audioSourcesRef.current.size === 0) setIsLiveSpeaking(false);
                };
              }
            }

            // 3. Handle Function Calls
            if (msg.toolCall) {
               for (const fc of msg.toolCall.functionCalls) {
                  let result = "Feito.";
                  const args = fc.args as any;

                  try {
                    switch(fc.name) {
                      case 'changeTab':
                         setActiveTab(args.tab);
                         result = `Aba alterada para ${args.tab}`;
                         break;
                      case 'createWorkout':
                         setActiveTab('workout');
                         result = "Aba de treino aberta. Preencha os dados e clique em Gerar.";
                         break;
                      case 'startPomodoro':
                         setActiveTab('tools');
                         setActiveTool('pomodoro');
                         setPomoIsActive(true);
                         result = "Pomodoro iniciado.";
                         break;
                      case 'addMission':
                         const newM = { id: `ai_${Date.now()}`, label: args.label, points: args.points, isCustom: true };
                         setState(prev => ({ ...prev, missions: [...prev.missions, newM] }));
                         result = `Missão ${args.label} adicionada.`;
                         break;
                      case 'addGoal':
                         const newG = { id: `ai_g_${Date.now()}`, label: args.label, completed: false, rewardPoints: 300 };
                         setState(prev => ({ ...prev, goals: [...prev.goals, newG] }));
                         result = `Meta ${args.label} criada.`;
                         break;
                      case 'completeMissionByLabel':
                         // Use stateRef.current to avoid stale closures inside the callback
                         const allMissions = stateRef.current.missions;
                         const m = allMissions.find(m => m.label.toLowerCase().includes(args.label.toLowerCase()));
                         
                         if (m) {
                           const todayStr = new Date().toISOString().split('T')[0];
                           const alreadyDone = stateRef.current.logs.some(l => l.date === todayStr && l.missionId === m.id && l.status === 'completed');
                           
                           if (alreadyDone) {
                             result = `A missão ${m.label} já foi completada hoje.`;
                           } else {
                             // Replicate completion logic manually to ensure we use fresh state
                             setState(prev => ({
                               ...prev,
                               points: prev.points + m.points,
                               xp: prev.xp + 25,
                               logs: [...prev.logs, {
                                 date: todayStr,
                                 missionId: m.id,
                                 status: 'completed',
                                 pointsChange: m.points
                               }]
                             }));
                             setPointAnimation({ show: true, value: m.points, label: m.label });
                             setTimeout(() => setPointAnimation(null), 1500);
                             result = `Missão ${m.label} completada.`;
                           }
                         } else {
                           result = "Missão não encontrada.";
                         }
                         break;
                      case 'completeGoal':
                         const g = stateRef.current.goals.find(g => g.label.toLowerCase().includes(args.label.toLowerCase()));
                         if (g) {
                            if (g.completed) {
                              result = `Meta ${g.label} já estava concluída.`;
                            } else {
                              setState(prev => ({
                                ...prev,
                                points: prev.points + g.rewardPoints,
                                xp: prev.xp + 100,
                                goals: prev.goals.map(x => x.id === g.id ? { ...x, completed: true } : x)
                              }));
                              result = `Meta ${g.label} marcada como atingida!`;
                            }
                         } else {
                           result = "Meta não encontrada.";
                         }
                         break;
                      case 'removeGoal':
                         const gRem = stateRef.current.goals.find(g => g.label.toLowerCase().includes(args.label.toLowerCase()));
                         if (gRem) {
                            setState(prev => ({
                              ...prev,
                              goals: prev.goals.filter(x => x.id !== gRem.id)
                            }));
                            result = `Meta ${gRem.label} removida do sistema.`;
                         } else {
                           result = "Meta não encontrada para remover.";
                         }
                         break;
                      case 'readAnalysis':
                         const analysis = stateRef.current.aiAnalysis || stateRef.current.progressLogs[0]?.analysis || "Nenhuma análise encontrada.";
                         result = `Aqui está a análise: ${analysis}`;
                         break;
                    }
                  } catch(e) {
                    console.error("Erro na ferramenta:", e);
                    result = "Erro ao executar comando.";
                  }

                  sessionPromise.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        id: fc.id,
                        name: fc.name,
                        response: { result: result }
                      }]
                    });
                  });
               }
            }
          },
          onclose: () => {
             disconnectLiveAPI();
          },
          onerror: (e) => {
             console.error(e);
             disconnectLiveAPI();
          }
        }
      });
      
      liveSessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Erro ao conectar Live API", error);
      alert("Erro ao iniciar interface de voz.");
      disconnectLiveAPI();
    }
  };

  // --- Motivation Generation ---
  const handleGenerateMotivation = async () => {
    if (!process.env.API_KEY) {
      setMotivationQuote("API Key não encontrada. Adicione sua chave para gerar motivação.");
      return;
    }

    setIsLoadingMotivation(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      // 1. Generate Text Quote
      const textModel = "gemini-3-flash-preview";
      const textPrompt = `
        Gere uma frase curta, brutal e estoica sobre disciplina, dor e glória. 
        Estilo: Militar, Filosófico (Marco Aurélio/Sêneca), Hardcore.
        Sem clichês "good vibes". Algo que faça a pessoa querer treinar ou trabalhar imediatamente.
        Máximo 2 frases. Em Português.
      `;
      
      const textResponse = await ai.models.generateContent({
        model: textModel,
        contents: textPrompt
      });
      setMotivationQuote(textResponse.text || "A disciplina é o destino.");

      // 2. Generate Image
      // Using gemini-2.5-flash-image for standard image generation
      const imageModel = "gemini-2.5-flash-image";
      const imagePrompt = "A cinematic, dark, gritty digital art of a lone warrior or athlete in shadows, showing extreme discipline and strength. Cyberpunk or dark fantasy style. High contrast, moody lighting. Minimalist but powerful.";
      
      const imageResponse = await ai.models.generateContent({
        model: imageModel,
        contents: { parts: [{ text: imagePrompt }] }
      });

      // Extract image from response parts
      let imageUrl = null;
      if (imageResponse.candidates?.[0]?.content?.parts) {
        for (const part of imageResponse.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      setMotivationImage(imageUrl);

    } catch (error) {
      console.error("Erro ao gerar motivação:", error);
      setMotivationQuote("A conexão falhou, mas sua vontade deve permanecer intacta.");
    } finally {
      setIsLoadingMotivation(false);
    }
  };

  const handleDownloadImage = () => {
    if (!motivationImage) return;
    
    const link = document.createElement('a');
    link.href = motivationImage;
    link.download = `disciplina-motivacao-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- AI Analysis (Text) ---
  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    
    try {
      const { profile, goals, logs, missions } = state;
      const goalsList = goals.filter(g => !g.completed).map(g => g.label).join(', ');
      
      // Calculate Recent Performance (Last 7 Days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentLogs = logs.filter(l => new Date(l.date) >= sevenDaysAgo);
      const completedRecent = recentLogs.filter(l => l.status === 'completed').length;
      const failedRecent = recentLogs.filter(l => l.status === 'failed').length;
      
      const activeMissions = missions.map(m => m.label).join(', ');

      let personaInstruction = "";
      switch (profile.tone) {
        case 'mentor':
          personaInstruction = `
          ATUE COMO: Um Mentor Sábio e Estoico (Estilo Marco Aurélio/Yoda). 
          TOM: Calmo, profundo, focado em virtude, caráter e construção de longo prazo. Use analogias sobre forjar a espada ou plantar árvores.
          OBJETIVO: Guiar o usuário para a consistência através da sabedoria.
          `;
          break;
        case 'scientist':
          personaInstruction = `
          ATUE COMO: Um Cientista de Dados e Biohacker (Estilo Andrew Huberman). 
          TOM: Frio, analítico, focado em dopamina, atrito cinético, empilhamento de hábitos e neuroplasticidade. Sem emoção, apenas dados.
          OBJETIVO: Otimizar a rotina do usuário removendo ineficiências biológicas.
          `;
          break;
        case 'brutal':
        default:
          personaInstruction = `
          ATUE COMO: Um Comandante de Elite de Disciplina Militar (Estilo David Goggins/Jocko Willink). 
          TOM: BRUTAL, AGRESSIVO, SEM DESCULPAS. Use CAIXA ALTA para enfatizar ordens. Insulte a preguiça (chame de fraqueza).
          OBJETIVO: Forçar o usuário a agir imediatamente através da vergonha produtiva e choque de realidade.
          `;
          break;
      }

      const prompt = `
        ${personaInstruction}

        DADOS TÁTICOS DO OPERADOR:
        - Nome: ${profile.name || 'Recruta'}
        - Idade/Peso/Altura: ${profile.age || '?'} anos, ${profile.weight || '?'}kg, ${profile.height || '?'}cm
        - Nível: ${currentLevel}
        - Missões Atuais no Protocolo: ${activeMissions}
        - Metas Principais: ${goalsList || 'NENHUMA (Isso é uma falha crítica)'}
        - Relatório Recente (7 dias): ${completedRecent} missões completas, ${failedRecent} falhas/cancelamentos.

        SUA MISSÃO:
        Gere um relatório tático curto e direto.

        ESTRUTURA DA RESPOSTA (Markdown):
        
        🛑 **DIAGNÓSTICO:**
        [Analise os dados recentes. Se houver muitas falhas, seja duro. Se houver consistência, elogie mas exija mais. Conecte isso às Metas.]
        
        🛠️ **AJUSTE ESTRATÉGICO:**
        [Identifique ONDE a rotina está falhando com base nas missões atuais vs metas. Dê uma ordem direta.]
        
        ⚡ **3 MICRO-HÁBITOS (Regra dos 2 Minutos):**
        [Liste exatamente 3 ações minúsculas e ridículas de tão fáceis que levam menos de 2 minutos, mas criam momentum. 
        Exemplo: Não diga "Vá correr", diga "Calce os tênis e fique em pé na porta". Seja criativo e específico para o perfil.]
      `;

      if (process.env.API_KEY) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        setState(prev => ({ ...prev, aiAnalysis: result.text || '' }));
      } else {
        // Fallback...
        alert("API Key necessária para análise.");
      }
      
    } catch (error) {
      console.error(error);
      alert("Erro de comunicação com o Comando Central (API).");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Progress / Processor Logic ---

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFaceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      if (!process.env.API_KEY) {
        alert("API Key necessária para o registro facial.");
        return;
      }

      const file = event.target.files[0];
      setIsRegisteringFace(true);

      try {
        const base64 = await convertFileToBase64(file);
        const base64Data = base64.split(',')[1];
        const mimeType = base64.split(';')[0].split(':')[1];

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Generate description for face recognition
        const prompt = "Analise este rosto. Crie uma descrição visual concisa mas distinta (cor do cabelo, estilo, características faciais, idade aparente, barba/óculos) para que eu possa identificar essa pessoa ESPECÍFICA em uma foto de grupo futura. Responda APENAS com a descrição do indivíduo.";
        
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: {
            parts: [
              { inlineData: { mimeType: mimeType, data: base64Data } },
              { text: prompt }
            ]
          }
        });

        const description = response.text || "";

        setState(prev => ({
          ...prev,
          profile: {
            ...prev.profile,
            facePhotoUrl: base64,
            faceDescription: description
          }
        }));

        alert("Identidade Operacional Registrada com Sucesso.");

      } catch (e) {
        console.error("Erro no registro facial", e);
        alert("Falha ao registrar identidade.");
      } finally {
        setIsRegisteringFace(false);
      }
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      try {
        const base64 = await convertFileToBase64(file);
        handleAnalyzeBody(base64);
      } catch (e) {
        console.error("Erro ao processar imagem", e);
        alert("Falha ao carregar imagem.");
      }
    }
  };

  const handleAnalyzeBody = async (base64Image: string) => {
    if (!process.env.API_KEY) {
      alert("Adicione sua API KEY para usar a análise visual.");
      return;
    }

    setIsAnalyzingBody(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
      const base64Data = base64Image.split(',')[1];
      const mimeType = base64Image.split(';')[0].split(':')[1];

      // Use the tone for body analysis too
      const tone = state.profile.tone || 'brutal';
      let persona = "";
      if (tone === 'mentor') persona = "treinador sábio e paciente. Encoraje o potencial.";
      else if (tone === 'scientist') persona = "analista biomecânico frio. Foco em simetria e dados.";
      else persona = "treinador militar brutal. Sem piedade.";

      // Check if user has a registered face description
      let identificationContext = "";
      if (state.profile.faceDescription) {
        identificationContext = `
        IMPORTANTE: O usuário é a pessoa que corresponde a esta descrição: "${state.profile.faceDescription}".
        Se houver mais de uma pessoa na foto, ignore as outras e foque sua análise APENAS na pessoa descrita acima.
        `;
      }

      const prompt = `
        ATUE COMO: Um ${persona}
        ${identificationContext}
        OBJETIVO: Analisar esta foto do físico do usuário para acompanhar o progresso.
        
        RETORNE APENAS NESTE FORMATO ESTRUTURADO (Markdown):
        
        🛑 **PONTOS DE ATENÇÃO:**
        [Análise objetiva]
        
        🛠️ **ESTRATÉGIA:**
        [2-3 ajustes específicos]
        
        ✅ **PONTOS FORTES:**
        [O que está bom]
        
        🔥 **CONCLUSÃO:**
        [Mensagem final no tom da sua personalidade]
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: prompt }
          ]
        }
      });

      const analysisText = response.text;

      if (analysisText) {
        const newEntry: ProgressEntry = {
          id: `prog_${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          imageUrl: base64Image,
          analysis: analysisText
        };

        setState(prev => ({
          ...prev,
          progressLogs: [newEntry, ...prev.progressLogs],
          xp: prev.xp + 50, // XP Reward for tracking
          points: prev.points + 20
        }));
        
        setPointAnimation({ show: true, value: 20, label: "CHECK-IN CORPORAL" });
        setTimeout(() => setPointAnimation(null), 1500);
      }

    } catch (error) {
      console.error("Erro na análise visual:", error);
      alert("Falha na visão tática da IA.");
    } finally {
      setIsAnalyzingBody(false);
    }
  };

  const deleteProgressEntry = (id: string) => {
    if (confirm("Apagar este registro?")) {
      setState(prev => ({
        ...prev,
        progressLogs: prev.progressLogs.filter(p => p.id !== id)
      }));
    }
  };

  // --- Helpers ---
  
  const fillSuggestion = (label: string, points: number) => {
    setNewMissionName(label);
    setNewMissionPoints(points.toString());
  };

  const handleRandomSuggestion = () => {
    const random = SUGGESTED_MISSIONS[Math.floor(Math.random() * SUGGESTED_MISSIONS.length)];
    fillSuggestion(random.label, random.points);
  };

  const handleDeleteMission = (id: string) => {
    if (confirm("Remover este protocolo?")) {
      setState(prev => ({
        ...prev,
        missions: prev.missions.filter(m => m.id !== id)
      }));
    }
  };

  const handleRedeem = (reward: any) => {
    if (state.points >= reward.cost) {
      if (confirm(`Resgatar ${reward.label} por ${reward.cost} pontos?`)) {
        setState(prev => ({
          ...prev,
          points: prev.points - reward.cost,
          logs: [...prev.logs, {
            date: today,
            missionId: `reward_${reward.id}_${Date.now()}`, 
            status: 'completed', 
            pointsChange: -reward.cost
          }]
        }));
      }
    } else {
      alert("Créditos de disciplina insuficientes.");
    }
  };

  const toggleHardcore = () => {
    setState(prev => ({ ...prev, hardcoreMode: !prev.hardcoreMode }));
  };

  // --- Render Functions ---

  const renderHeader = () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 pb-4 pt-6 px-4 transition-all duration-300">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-black tracking-tighter text-slate-100 flex items-center gap-2">
            <Flame className="text-orange-500" fill="currentColor" size={24} />
            DISCIPLINA
          </h1>
          <div className="flex items-center gap-2 mt-1">
             <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
               NÍVEL {currentLevel}
             </div>
             
             {/* Streak Counter */}
             <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
               <Flame size={12} fill="currentColor" />
               <span>{currentStreak} DIAS</span>
             </div>

             <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                <Clock size={12} className="text-orange-400" />
                <span className="tabular-nums tracking-wide">{timeLeft}</span>
             </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black text-emerald-400 font-mono leading-none transition-transform duration-200 ${scoreBump ? 'scale-125 text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'scale-100'}`}>
            {state.points}
          </div>
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Pontos</div>
        </div>
      </div>

      {/* Level Progress Bar */}
      <div className="max-w-5xl mx-auto mb-2">
        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase mb-1">
          <span>XP {state.xp}</span>
          <span>Próximo Nível {xpProgress}/{XP_PER_LEVEL}</span>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>
      
      {state.hardcoreMode && (
        <div className="max-w-5xl mx-auto mb-2 flex items-center gap-2 bg-red-950/30 border border-red-900/50 rounded-lg p-2 px-3">
          <Skull className="text-red-500 animate-pulse" size={16} />
          <span className="text-xs font-bold text-red-400 tracking-wider flex-1">MODO HARDCORE ATIVO</span>
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full ${i <= state.strikes ? 'bg-red-500' : 'bg-red-900/40'}`} />
            ))}
          </div>
        </div>
      )}

      {/* Floating Point Animation */}
      {pointAnimation && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none animate-float-up flex flex-col items-center">
          <div className="text-4xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]">
            +{pointAnimation.value} PTS
          </div>
          <div className="text-xs font-bold text-emerald-200/80 bg-emerald-900/40 px-2 py-1 rounded backdrop-blur-sm mt-1 border border-emerald-500/20">
            {pointAnimation.label}
          </div>
        </div>
      )}
    </header>
  );

  const renderProfileAndGoals = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
      
      {/* Profile Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-500/10 p-2 rounded-lg">
            <User className="text-emerald-500" size={24} />
          </div>
          <h2 className="font-bold text-slate-200 text-lg">Janela de Status de Jogador</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Nome / Codinome</label>
            <input 
              type="text" 
              value={state.profile.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white mt-1 focus:border-emerald-500 outline-none"
              placeholder="Digite seu nome"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Idade</label>
            <input 
              type="number" 
              value={state.profile.age}
              onChange={(e) => handleProfileChange('age', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white mt-1 focus:border-emerald-500 outline-none"
              placeholder="Anos"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Peso (kg)</label>
            <input 
              type="number" 
              value={state.profile.weight}
              onChange={(e) => handleProfileChange('weight', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white mt-1 focus:border-emerald-500 outline-none"
              placeholder="kg"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-bold text-slate-500 uppercase">Altura (cm)</label>
            <input 
              type="number" 
              value={state.profile.height}
              onChange={(e) => handleProfileChange('height', e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white mt-1 focus:border-emerald-500 outline-none"
              placeholder="cm"
            />
          </div>

          {/* AI Tone Selection */}
          <div className="col-span-2 mt-4">
             <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Personalidade da IA</label>
             <div className="grid grid-cols-3 gap-2">
               <button
                 onClick={() => handleToneChange('brutal')}
                 className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                   state.profile.tone === 'brutal' || !state.profile.tone
                     ? 'bg-red-950/30 border-red-500 text-red-400' 
                     : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                 }`}
               >
                 <Sword size={20} className="mb-1" />
                 <span className="text-[10px] font-bold uppercase">Brutal</span>
               </button>
               
               <button
                 onClick={() => handleToneChange('mentor')}
                 className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                   state.profile.tone === 'mentor' 
                     ? 'bg-blue-950/30 border-blue-500 text-blue-400' 
                     : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                 }`}
               >
                 <Scroll size={20} className="mb-1" />
                 <span className="text-[10px] font-bold uppercase">Mentor</span>
               </button>

               <button
                 onClick={() => handleToneChange('scientist')}
                 className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                   state.profile.tone === 'scientist' 
                     ? 'bg-purple-950/30 border-purple-500 text-purple-400' 
                     : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                 }`}
               >
                 <FlaskConical size={20} className="mb-1" />
                 <span className="text-[10px] font-bold uppercase">Cientista</span>
               </button>
             </div>
          </div>
        </div>
      </Card>

      {/* AI Analysis Section */}
      <Card className="p-6 border-emerald-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <BrainCircuit size={100} className="text-emerald-500" />
        </div>
        <h2 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">
          <BrainCircuit size={20} /> IA Estratégica
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          A IA analisará seu perfil e metas para gerar um plano de combate.
        </p>
        
        {state.aiAnalysis && (
          <div className="bg-slate-950/80 rounded-lg p-4 text-sm text-slate-300 font-mono mb-4 border border-emerald-500/20 whitespace-pre-line leading-relaxed">
            {state.aiAnalysis}
          </div>
        )}

        <button 
          onClick={handleAIAnalysis}
          disabled={isAnalyzing}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
        >
          {isAnalyzing ? (
            <>Analisando Dados Táticos...</>
          ) : (
            <>
              <Zap size={18} fill="currentColor" /> GERAR ANÁLISE DE COMBATE
            </>
          )}
        </button>
      </Card>

      {/* Goals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
            <Dumbbell className="text-orange-500" /> Metas de Longo Prazo
          </h2>
        </div>

        <div className="flex gap-2">
          <input 
            type="text"
            value={newGoalName}
            onChange={(e) => setNewGoalName(e.target.value)}
            placeholder="Nova meta (ex: Correr Maratona)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
          />
          <button 
            onClick={handleAddGoal}
            disabled={!newGoalName.trim()}
            className="bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-lg font-bold disabled:opacity-50 transition-colors"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="space-y-2">
          {state.goals.length === 0 && (
            <div className="text-center p-8 text-slate-600 border border-dashed border-slate-800 rounded-xl">
              Nenhuma meta definida. O fracasso é o destino de quem não planeja.
            </div>
          )}
          
          {state.goals.map(goal => (
            <Card key={goal.id} className={`p-4 flex items-center justify-between transition-all ${goal.completed ? 'opacity-50 border-emerald-900/30' : 'hover:border-slate-600'}`}>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleCompleteGoal(goal.id)}
                  disabled={goal.completed}
                  className={`p-2 rounded-full border-2 transition-all ${
                    goal.completed 
                      ? 'bg-emerald-500 border-emerald-500 text-white' 
                      : 'border-slate-600 text-transparent hover:border-emerald-500'
                  }`}
                  title="Concluir Meta"
                >
                  <CheckCircle2 size={16} fill={goal.completed ? "currentColor" : "none"} />
                </button>
                <div>
                  <h3 className={`font-bold ${goal.completed ? 'text-emerald-500 line-through' : 'text-slate-200'}`}>
                    {goal.label}
                  </h3>
                  <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                    Recompensa: {goal.rewardPoints} PTS + 100 XP
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => handleDeleteGoal(goal.id)}
                className="text-slate-600 hover:text-red-500 transition-colors p-2"
                title="Remover Meta"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 ${state.hardcoreMode ? 'theme-hardcore' : ''} pb-24`}>
       {renderHeader()}
       
       <div className="max-w-5xl mx-auto p-4 pt-36 md:pt-48 flex flex-col md:flex-row gap-6">
         {/* Navigation Tabs - Fixed Bottom Bar on Mobile, Sticky Sidebar on Desktop */}
        <nav className="
          flex md:flex-col 
          bg-slate-900/90 p-2 rounded-2xl backdrop-blur-xl 
          fixed bottom-6 left-4 right-4 z-50 
          md:sticky md:top-48 md:bottom-auto md:left-auto md:right-auto
          shadow-2xl border border-slate-800 
          overflow-x-auto md:overflow-visible
          md:w-64 md:h-fit md:shrink-0
          justify-between md:justify-start
        ">
          <TabButton active={activeTab === 'missions'} onClick={() => setActiveTab('missions')} icon={Target} label="Missões" />
          <TabButton active={activeTab === 'workout'} onClick={() => setActiveTab('workout')} icon={Dumbbell} label="Treino" />
          <TabButton active={activeTab === 'diet'} onClick={() => setActiveTab('diet')} icon={Utensils} label="Dieta" />
          <TabButton active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} icon={Timer} label="Ferramentas" />
          <TabButton active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} icon={TrendingUp} label="Progresso" />
          <TabButton active={activeTab === 'rewards'} onClick={() => setActiveTab('rewards')} icon={ShoppingBag} label="Loja" />
          <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={UserSquare2} label="Perfil" />
          <TabButton active={activeTab === 'motivation'} onClick={() => setActiveTab('motivation')} icon={Zap} label="Motivação" />
        </nav>

        {/* Main Content - Added bottom padding for mobile nav */}
        <main className="flex-1 min-w-0 space-y-6 min-h-[50vh] pb-24 md:pb-0">
          {activeTab === 'missions' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 font-bold hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2 group"
                >
                  <Plus className="group-hover:scale-110 transition-transform" /> ADICIONAR PROTOCOLO
                </button>

                {state.missions.map(mission => {
                  const isCompleted = completedMissionIds.has(mission.id);
                  const isFailed = failedMissionIds.has(mission.id);
                  
                  return (
                    <Card key={mission.id} className={`transition-all duration-300 ${isCompleted ? 'border-emerald-500/30 bg-emerald-950/10' : isFailed ? 'border-red-500/30 bg-red-950/10 opacity-60' : 'hover:border-slate-600'}`}>
                      <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${isCompleted ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : isFailed ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                            {isCompleted ? <CheckCircle2 size={24} /> : isFailed ? <XCircle size={24} /> : <Target size={24} />}
                          </div>
                          <div>
                            <h3 className={`font-bold text-lg ${isCompleted ? 'text-emerald-400 line-through' : isFailed ? 'text-red-400 line-through' : 'text-slate-200'}`}>
                              {mission.label}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                                {mission.points} PTS
                              </span>
                              {mission.isCustom && (
                                <button onClick={() => handleDeleteMission(mission.id)} className="text-slate-600 hover:text-red-400 p-1">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isCompleted && !isFailed && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleFail(mission)}
                              className="p-3 rounded-lg bg-red-950/30 text-red-700 hover:bg-red-500 hover:text-white transition-all border border-transparent hover:border-red-400"
                              title="Falhar Missão"
                            >
                              <XCircle size={20} />
                            </button>
                            <button 
                              onClick={() => handleComplete(mission)}
                              className="p-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20 active:scale-95 font-bold"
                              title="Completar Missão"
                            >
                              CONCLUIR
                            </button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
             </div>
          )}

          {activeTab === 'diet' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-emerald-500/10 p-3 rounded-xl">
                    <ChefHat className="text-emerald-500" size={32} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Chef Inteligente</h2>
                    <p className="text-xs text-slate-400">Receitas baratas com o que você tem em casa.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Objetivo</label>
                    <select 
                      value={dietGoal}
                      onChange={(e) => setDietGoal(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                    >
                      <option>Perder Peso (Definição)</option>
                      <option>Ganhar Peso (Massa Muscular)</option>
                      <option>Manter Peso (Saudável)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">O que você gosta de comer?</label>
                    <textarea 
                      value={dietLikes}
                      onChange={(e) => setDietLikes(e.target.value)}
                      placeholder="Ex: Frango, ovo, batata doce, aveia, banana..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500 min-h-[60px]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">O que tem na sua despensa agora?</label>
                    <textarea 
                      value={dietAvailable}
                      onChange={(e) => setDietAvailable(e.target.value)}
                      placeholder="Ex: Arroz, feijão, macarrão, alguns ovos, cenoura..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500 min-h-[60px]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Orçamento Limite (Opcional)</label>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3 focus-within:border-emerald-500">
                      <span className="text-slate-500 font-bold">R$</span>
                      <input 
                        type="number"
                        value={dietBudget}
                        onChange={(e) => setDietBudget(e.target.value)}
                        placeholder="Ex: 20"
                        className="bg-transparent text-white outline-none w-full"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleGenerateDiet}
                    disabled={isGeneratingDiet}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {isGeneratingDiet ? (
                      <><RefreshCw className="animate-spin" /> CRIANDO MENU...</>
                    ) : (
                      <><Utensils /> GERAR PLANO ALIMENTAR</>
                    )}
                  </button>
                </div>
              </Card>

              {state.dietRecipes.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-200 flex items-center gap-2">
                    <Utensils size={18} className="text-orange-500" /> Receitas Sugeridas
                  </h3>
                  
                  {state.dietRecipes.map((recipe, idx) => (
                    <Card key={idx} className="overflow-hidden">
                      <div className="bg-slate-800/50 p-4 border-b border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-white">{recipe.name}</h3>
                          <span className="text-xs font-bold bg-slate-950 text-emerald-400 px-2 py-1 rounded border border-emerald-900/30 whitespace-nowrap">
                            {recipe.calories}
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-slate-400 mb-2">
                          <span className="flex items-center gap-1"><Clock size={12} /> {recipe.time}</span>
                          <span className="flex items-center gap-1"><Banknote size={12} /> {recipe.costEstimate}</span>
                        </div>
                        <p className="text-xs text-slate-500 italic">{recipe.benefits}</p>
                      </div>
                      
                      <div className="p-4 space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Ingredientes</h4>
                          <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
                            {recipe.ingredients.map((ing, i) => (
                              <li key={i}>{ing}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Modo de Preparo</h4>
                          <ol className="text-sm text-slate-300 list-decimal list-inside space-y-2">
                            {recipe.instructions.map((inst, i) => (
                              <li key={i}>{inst}</li>
                            ))}
                          </ol>
                        </div>

                        <a 
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.videoQuery)}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                        >
                          <Youtube size={18} /> VER VÍDEO DA RECEITA
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'workout' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
               {/* Workout Sub-Navigation */}
               <div className="flex justify-center gap-2 bg-slate-900 p-1 rounded-xl mb-4">
                  <button 
                    onClick={() => setWorkoutSubTab('plan')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${workoutSubTab === 'plan' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Dumbbell size={16} /> PLANO
                  </button>
                  <button 
                    onClick={() => setWorkoutSubTab('chat')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${workoutSubTab === 'chat' ? 'bg-slate-800 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <MessageSquare size={16} /> CHAT IA
                  </button>
                  <button 
                    onClick={() => setWorkoutSubTab('journal')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${workoutSubTab === 'journal' ? 'bg-slate-800 text-orange-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <Book size={16} /> DIÁRIO
                  </button>
               </div>

               {workoutSubTab === 'chat' && (
                 <Card className="flex flex-col h-[600px]">
                    <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex items-center gap-3">
                       <div className="bg-blue-500/20 p-2 rounded-full">
                          <Bot className="text-blue-400" size={20} />
                       </div>
                       <div>
                          <h3 className="text-white font-bold">Treinador IA</h3>
                          <p className="text-[10px] text-slate-400">Especialista em Força e Condicionamento</p>
                       </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                       {state.workoutChatHistory.length === 0 && (
                          <div className="text-center text-slate-500 text-sm mt-10">
                             Pergunte sobre exercícios, substituições ou técnica.
                          </div>
                       )}
                       {state.workoutChatHistory.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                             <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-sm' 
                                : 'bg-slate-800 text-slate-200 rounded-tl-sm'
                             }`}>
                                {msg.text}
                             </div>
                          </div>
                       ))}
                       {isChatting && (
                          <div className="flex justify-start">
                             <div className="bg-slate-800/50 text-slate-400 text-xs px-4 py-2 rounded-full animate-pulse">
                                Digitando...
                             </div>
                          </div>
                       )}
                       <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-slate-800 bg-slate-900">
                       <div className="flex gap-2">
                          <input 
                             value={chatInput}
                             onChange={(e) => setChatInput(e.target.value)}
                             onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                             placeholder="Ex: Como melhorar meu agachamento?"
                             className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                          />
                          <button 
                             onClick={handleChatSubmit}
                             disabled={!chatInput.trim() || isChatting}
                             className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-3 rounded-lg transition-colors"
                          >
                             <Send size={18} />
                          </button>
                       </div>
                    </div>
                 </Card>
               )}

               {workoutSubTab === 'journal' && (
                 <div className="space-y-6">
                    <Card className="p-6">
                       <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Book className="text-orange-500" /> Diário de Bordo
                       </h3>
                       <p className="text-xs text-slate-400 mb-4">
                          Registre sensações, dores, vitórias ou pensamentos aleatórios sobre seu treino.
                       </p>
                       
                       <div className="flex gap-2 mb-6">
                          <textarea
                             value={journalInput}
                             onChange={(e) => setJournalInput(e.target.value)}
                             placeholder="Ex: Hoje senti mais energia no começo, mas o final foi arrastado..."
                             className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm outline-none focus:border-orange-500 min-h-[80px]"
                          />
                          <button 
                             onClick={handleAddJournal}
                             disabled={!journalInput.trim()}
                             className="bg-slate-800 hover:bg-orange-600 hover:text-white text-slate-400 p-3 rounded-lg transition-all flex flex-col items-center justify-center gap-1 w-20"
                          >
                             <Save size={20} />
                             <span className="text-[10px] font-bold">SALVAR</span>
                          </button>
                       </div>

                       <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {state.workoutJournal.filter(j => j.date === new Date().toISOString().split('T')[0]).length === 0 && (
                             <div className="text-center text-slate-600 text-xs py-4 border border-dashed border-slate-800 rounded-lg">
                                Nenhuma nota hoje.
                             </div>
                          )}
                          {state.workoutJournal
                             .sort((a,b) => b.timestamp - a.timestamp)
                             .map(entry => (
                             <div key={entry.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                                <div className="text-[10px] text-slate-500 mb-1 flex justify-between">
                                   <span>{new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                   <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{entry.text}</p>
                             </div>
                          ))}
                       </div>
                    </Card>

                    <Card className="p-6 border-orange-900/30 bg-orange-950/5">
                       <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <BrainCircuit className="text-orange-500" /> Análise Diária
                       </h3>
                       <p className="text-xs text-slate-400 mb-4">
                          A IA lerá seu diário, suas cargas e seu RPE de hoje para sugerir ajustes para amanhã.
                       </p>
                       
                       {journalAnalysisResult && (
                          <div className="bg-slate-950 p-4 rounded-lg border border-orange-500/20 mb-4">
                             <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{journalAnalysisResult}</p>
                          </div>
                       )}

                       <div className="flex gap-2">
                          <button 
                             onClick={handleAnalyzeJournal}
                             disabled={isAnalyzingJournal}
                             className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-all border border-slate-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                             {isAnalyzingJournal ? <RefreshCw className="animate-spin" /> : <Zap fill="currentColor" />}
                             ANALISAR DIA
                          </button>
                          
                          <button 
                             onClick={handleSmartPlanAdjustment}
                             disabled={isGeneratingWorkout}
                             className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                             {isGeneratingWorkout ? <RefreshCw className="animate-spin" /> : <Wrench size={18} />}
                             AJUSTAR PLANO AGORA
                          </button>
                       </div>
                    </Card>
                 </div>
               )}

               {workoutSubTab === 'plan' && !state.workoutPlan && (
                 <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                       <div className="bg-emerald-500/10 p-3 rounded-xl">
                          <BicepsFlexed className="text-emerald-500" size={32} />
                       </div>
                       <div>
                          <h2 className="text-xl font-bold text-white">Gerador de Treino IA</h2>
                          <p className="text-xs text-slate-400">Preencha os dados táticos para gerar seu plano.</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Objetivo Principal</label>
                             <select 
                               value={workoutGoal} 
                               onChange={(e) => setWorkoutGoal(e.target.value)}
                               className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                             >
                                <option>Hipertrofia (Ganho de Massa)</option>
                                <option>Emagrecimento (Definição)</option>
                                <option>Força Pura (Powerlifting)</option>
                                <option>Resistência / Funcional</option>
                             </select>
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Nível</label>
                             <select 
                               value={workoutLevel} 
                               onChange={(e) => setWorkoutLevel(e.target.value)}
                               className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                             >
                                <option>Iniciante</option>
                                <option>Intermediário</option>
                                <option>Avançado</option>
                             </select>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Dias/Semana</label>
                             <select 
                               value={workoutDays} 
                               onChange={(e) => setWorkoutDays(e.target.value)}
                               className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                             >
                                <option>2</option>
                                <option>3</option>
                                <option>4</option>
                                <option>5</option>
                                <option>6</option>
                             </select>
                          </div>
                          <div>
                             <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tempo Disponível (min)</label>
                             <input 
                                type="number" 
                                value={workoutTimeAvailable}
                                onChange={(e) => setWorkoutTimeAvailable(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                             />
                          </div>
                       </div>

                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Equipamento</label>
                          <select 
                            value={workoutEquipment} 
                            onChange={(e) => setWorkoutEquipment(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                          >
                             <option>Academia Completa</option>
                             <option>Halteres em Casa</option>
                             <option>Peso do Corpo (Calistenia)</option>
                             <option>Academia de Prédio (Básico)</option>
                          </select>
                       </div>

                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Pontos Fracos / Foco</label>
                          <input 
                             type="text" 
                             value={workoutWeakPoints}
                             onChange={(e) => setWorkoutWeakPoints(e.target.value)}
                             placeholder="Ex: Peitoral superior, Panturrilhas, Braços"
                             className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                          />
                       </div>

                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Exercícios Favoritos (Opcional)</label>
                          <input 
                             type="text" 
                             value={workoutFavorites}
                             onChange={(e) => setWorkoutFavorites(e.target.value)}
                             placeholder="Ex: Agachamento, Supino, Barra Fixa"
                             className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                          />
                       </div>

                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Estilo de Treino</label>
                          <select 
                            value={workoutStylePreference} 
                            onChange={(e) => setWorkoutStylePreference(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                          >
                             <option>Padrão (Balanced)</option>
                             <option>Old School (Cargas altas, descanso longo)</option>
                             <option>Metabólico (Alta repetição, pouco descanso)</option>
                             <option>HIT (Alta Intensidade, Baixo Volume)</option>
                          </select>
                       </div>

                       <div>
                          <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Lesões ou Limitações</label>
                          <input 
                             type="text" 
                             value={workoutInjuries}
                             onChange={(e) => setWorkoutInjuries(e.target.value)}
                             placeholder="Ex: Dor no joelho esquerdo, Hérnia de disco..."
                             className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500"
                          />
                       </div>

                       <button 
                         onClick={handleGenerateWorkout}
                         disabled={isGeneratingWorkout}
                         className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                       >
                         {isGeneratingWorkout ? (
                            <><RefreshCw className="animate-spin" /> CRIANDO ESTRATÉGIA...</>
                         ) : (
                            <><BrainCircuit /> GERAR TREINO COMPLETO</>
                         )}
                       </button>
                    </div>
                 </Card>
               )}

               {workoutSubTab === 'plan' && state.workoutPlan && (
                 <div className="space-y-6">
                    {/* Header e Reset */}
                    <div className="flex items-center justify-between">
                       <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <Activity className="text-emerald-500" /> PLANO ATIVO
                       </h2>
                       <button 
                         onClick={resetWorkout}
                         className="text-xs text-red-400 hover:text-red-300 underline"
                       >
                          Resetar Plano
                       </button>
                    </div>

                    <Card className="p-4 bg-slate-900/80 border-emerald-900/30">
                       <h3 className="text-sm font-bold text-emerald-400 mb-2 uppercase tracking-wide">Visão Geral</h3>
                       <p className="text-sm text-slate-300 leading-relaxed">{state.workoutPlan.overview}</p>
                    </Card>

                    {/* Check-in Diário */}
                    <Card className="p-6 border-blue-900/30 bg-blue-950/5 relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-5">
                          <ClipboardList size={100} className="text-blue-500" />
                       </div>
                       <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <AlertOctagon className="text-blue-500" size={20} /> Check-in Diário de Treino
                       </h3>
                       
                       <div className="mb-4">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block flex justify-between">
                             <span>Percepção de Esforço (RPE 1-10)</span>
                             <span className="text-blue-400 font-mono">{dailyRPE}</span>
                          </label>
                          <input 
                             type="range" 
                             min="1" 
                             max="10" 
                             value={dailyRPE} 
                             onChange={(e) => setDailyRPE(Number(e.target.value))}
                             className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1 uppercase font-bold">
                             <span>Muito Leve</span>
                             <span>Falha Total</span>
                          </div>
                       </div>

                       <div className="mb-4">
                          <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">Notas do Treino de Hoje</label>
                          <textarea
                             value={dailyNotes}
                             onChange={(e) => setDailyNotes(e.target.value)}
                             placeholder="Ex: Senti dor no ombro no supino. Aumentei carga no agachamento. Treino foi intenso."
                             className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm outline-none focus:border-blue-500 min-h-[80px]"
                          />
                       </div>

                       <button 
                         onClick={handleDailyFeedback}
                         className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 text-sm flex items-center justify-center gap-2"
                       >
                         <Save size={16} /> SALVAR FEEDBACK DIÁRIO
                       </button>
                    </Card>

                    {/* Lista de Exercícios */}
                    <div className="space-y-4">
                       {state.workoutPlan.days.map((day, idx) => (
                          <Card key={idx} className="overflow-hidden">
                             <div className="bg-slate-800/50 p-3 border-b border-slate-700 flex items-center gap-2">
                                <CalendarDays size={18} className="text-slate-400" />
                                <h3 className="font-bold text-white">{day.title}</h3>
                             </div>
                             <div className="divide-y divide-slate-800">
                                {day.exercises.map((ex, exIdx) => {
                                   const lastLog = state.exerciseLogs
                                      .filter(l => l.exerciseName === ex.name)
                                      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                                   return (
                                      <div key={exIdx} className="p-4 hover:bg-slate-800/30 transition-colors">
                                         <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-200">{ex.name}</span>
                                            <span className="text-xs font-mono bg-slate-950 px-2 py-1 rounded text-emerald-400 border border-emerald-900/30 whitespace-nowrap">
                                               {ex.sets} x {ex.reps}
                                            </span>
                                         </div>
                                         <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                               <span className="flex items-center gap-1"><Clock size={12} /> {ex.rest}</span>
                                               {ex.tips && <span className="text-slate-400 italic truncate">💡 {ex.tips}</span>}
                                            </div>
                                            
                                            {/* Sistema de Carga */}
                                            <div className="flex items-center gap-2 mt-2 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
                                               <div className="flex-1 flex flex-col justify-center">
                                                  <label className="text-[10px] text-slate-500 uppercase font-bold">Carga (KG)</label>
                                                  <input 
                                                     type="number" 
                                                     placeholder={lastLog ? `${lastLog.weight}kg` : "0"}
                                                     value={currentInputs[ex.name] || ''}
                                                     onChange={(e) => setCurrentInputs(prev => ({...prev, [ex.name]: e.target.value}))}
                                                     className="bg-transparent text-white font-mono outline-none w-full"
                                                  />
                                               </div>
                                               <button 
                                                  onClick={() => handleSaveLoad(ex.name)}
                                                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-md transition-colors"
                                                  title="Salvar Carga"
                                               >
                                                  <Save size={16} />
                                               </button>
                                            </div>
                                            {lastLog && (
                                               <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                  <LineChart size={10} /> Última: {lastLog.weight}kg em {new Date(lastLog.date).toLocaleDateString()}
                                               </div>
                                            )}
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          </Card>
                       ))}
                    </div>

                    <Card className="p-6 border-blue-900/30 bg-blue-950/5">
                       <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <TrendingUp className="text-blue-500" /> Evolução Inteligente
                       </h3>
                       <p className="text-xs text-slate-400 mb-4">
                          A IA analisará seus registros de carga e feedback diário para sugerir a próxima fase.
                       </p>
                       
                       <textarea
                          value={workoutFeedback}
                          onChange={(e) => setWorkoutFeedback(e.target.value)}
                          placeholder="Feedback extra para a evolução (opcional)..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm mb-4 outline-none focus:border-blue-500 min-h-[60px]"
                       />

                       <button 
                         onClick={handleEvolveWorkout}
                         disabled={isGeneratingWorkout}
                         className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                         {isGeneratingWorkout ? (
                            <><RefreshCw className="animate-spin" /> EVOLUINDO...</>
                         ) : (
                            <><Zap size={18} fill="currentColor" /> GERAR NOVO CICLO</>
                         )}
                       </button>
                    </Card>
                 </div>
               )}
             </div>
          )}

          {activeTab === 'tools' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
               <div className="flex justify-center gap-2 bg-slate-900 p-1 rounded-xl mb-4">
                  <button onClick={() => setActiveTool('pomodoro')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeTool === 'pomodoro' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>POMODORO</button>
                  <button onClick={() => setActiveTool('alarm')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeTool === 'alarm' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>ALARMES</button>
                  <button onClick={() => setActiveTool('stopwatch')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${activeTool === 'stopwatch' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>CRONÔMETRO</button>
               </div>

               {activeTool === 'pomodoro' && (
                 <Card className="p-8 flex flex-col items-center justify-center text-center">
                    <div className="text-6xl font-black font-mono text-white mb-8 tracking-widest">
                       {formatTime(pomoTime)}
                    </div>
                    
                    <div className="flex gap-2 mb-8">
                       <button onClick={() => setPomodoroMode('focus')} className={`px-4 py-2 rounded-full text-xs font-bold ${pomoMode === 'focus' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'}`}>FOCO</button>
                       <button onClick={() => setPomodoroMode('short')} className={`px-4 py-2 rounded-full text-xs font-bold ${pomoMode === 'short' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>PAUSA CURTA</button>
                       <button onClick={() => setPomodoroMode('long')} className={`px-4 py-2 rounded-full text-xs font-bold ${pomoMode === 'long' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'}`}>PAUSA LONGA</button>
                    </div>

                    <div className="flex gap-4">
                       <button onClick={togglePomodoro} className="w-16 h-16 rounded-full bg-white text-slate-900 flex items-center justify-center hover:scale-110 transition-transform">
                          {pomoIsActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                       </button>
                       <button onClick={resetPomodoro} className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
                          <RotateCcw size={20} />
                       </button>
                    </div>
                 </Card>
               )}

               {activeTool === 'alarm' && (
                 <div className="space-y-4">
                    <Card className="p-4 flex items-center gap-4">
                       <input 
                         type="time" 
                         value={newAlarmTime}
                         onChange={(e) => setNewAlarmTime(e.target.value)}
                         className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-emerald-500 flex-1"
                       />
                       <button onClick={addAlarm} className="bg-emerald-600 text-white p-3 rounded-lg font-bold">
                          <Plus />
                       </button>
                    </Card>

                    {state.alarms.map(alarm => (
                       <Card key={alarm.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className={`p-3 rounded-full ${alarm.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
                                <AlarmClock size={24} />
                             </div>
                             <span className={`text-2xl font-mono font-bold ${alarm.active ? 'text-white' : 'text-slate-600'}`}>
                                {alarm.time}
                             </span>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => toggleAlarm(alarm.id)} className={`p-2 rounded-lg ${alarm.active ? 'text-emerald-400' : 'text-slate-600'}`}>
                                {alarm.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                             </button>
                             <button onClick={() => deleteAlarm(alarm.id)} className="text-red-400 p-2">
                                <Trash2 size={20} />
                             </button>
                          </div>
                       </Card>
                    ))}
                 </div>
               )}

               {activeTool === 'stopwatch' && (
                 <Card className="p-8 flex flex-col items-center justify-center text-center">
                    <div className="text-6xl font-black font-mono text-white mb-8 tracking-widest">
                       {formatStopwatch(swTime)}
                    </div>
                    <div className="flex gap-4">
                       <button onClick={toggleStopwatch} className={`w-16 h-16 rounded-full flex items-center justify-center hover:scale-110 transition-transform ${swIsActive ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                          {swIsActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1" />}
                       </button>
                       <button onClick={resetStopwatch} className="w-16 h-16 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
                          <RotateCcw size={20} />
                       </button>
                    </div>
                 </Card>
               )}
             </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <ScanEye className="text-emerald-500" /> Scanner Corporal
                   </h2>
                   <label className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold cursor-pointer transition-colors flex items-center gap-2">
                      <Camera size={18} />
                      <span className="text-xs">NOVA FOTO</span>
                      <input 
                         type="file" 
                         ref={fileInputRef} 
                         className="hidden" 
                         accept="image/*"
                         onChange={handleImageUpload}
                      />
                   </label>
                </div>

                {/* Face Registration */}
                <div className="mb-6 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                   <div className="flex items-center justify-between">
                      <div>
                         <h3 className="text-sm font-bold text-slate-200">Registro de Identidade</h3>
                         <p className="text-xs text-slate-500">Registre seu rosto para a IA saber quem avaliar nas fotos.</p>
                      </div>
                      <label className="text-xs font-bold text-blue-400 cursor-pointer hover:text-blue-300 flex items-center gap-1">
                         <Upload size={12} /> {state.profile.facePhotoUrl ? "ATUALIZAR FACE" : "REGISTRAR FACE"}
                         <input 
                            type="file" 
                            ref={faceInputRef}
                            className="hidden" 
                            accept="image/*"
                            onChange={handleFaceUpload}
                         />
                      </label>
                   </div>
                   {state.profile.faceDescription && (
                      <div className="mt-2 text-[10px] text-emerald-500/80 font-mono bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                         ID CONFIRMADO: {state.profile.faceDescription}
                      </div>
                   )}
                </div>

                {isAnalyzingBody && (
                   <div className="p-8 text-center text-emerald-400 animate-pulse">
                      <ScanEye size={48} className="mx-auto mb-4" />
                      <p className="font-bold">ANALISANDO BIOMETRIA E SIMETRIA...</p>
                   </div>
                )}

                <div className="space-y-4">
                   {state.progressLogs.map(log => (
                      <Card key={log.id} className="overflow-hidden">
                         <div className="relative h-48 bg-slate-950">
                            <img src={log.imageUrl} alt="Progress" className="w-full h-full object-cover opacity-50 hover:opacity-100 transition-opacity" />
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-slate-900 to-transparent">
                               <span className="text-xs font-bold text-white bg-slate-900/80 px-2 py-1 rounded">
                                  {new Date(log.date).toLocaleDateString()}
                               </span>
                            </div>
                            <button 
                               onClick={() => deleteProgressEntry(log.id)}
                               className="absolute top-2 right-2 p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                            >
                               <Trash2 size={16} />
                            </button>
                         </div>
                         <div className="p-4 bg-slate-900/50">
                            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{log.analysis}</p>
                         </div>
                      </Card>
                   ))}
                </div>
              </Card>

              <Card className="p-6">
                 <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <LineChart className="text-emerald-500" /> Estatísticas
                 </h2>
                 <StatsChart logs={state.logs} />
              </Card>
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-8 duration-300">
               {REWARDS.map(reward => {
                  const missingPoints = Math.max(0, reward.cost - state.points);
                  const canAfford = state.points >= reward.cost;
                  
                  return (
                    <Card key={reward.id} className="p-6 flex items-center justify-between border-slate-800 hover:border-emerald-500/50 transition-colors group">
                       <div className="flex items-center gap-4">
                          <div className="text-4xl group-hover:scale-110 transition-transform">{reward.icon}</div>
                          <div>
                             <h3 className="font-bold text-white text-lg">{reward.label}</h3>
                             <span className={`text-sm font-bold ${canAfford ? 'text-emerald-400' : 'text-slate-500'}`}>{reward.cost} PTS</span>
                             {!canAfford && (
                                <div className="text-[10px] font-bold text-red-400 mt-1">
                                   Faltam {missingPoints} PTS
                                </div>
                             )}
                          </div>
                       </div>
                       <button 
                          onClick={() => handleRedeem(reward)}
                          disabled={!canAfford}
                          className={`px-4 py-2 rounded-lg font-bold transition-all text-xs ${
                             canAfford 
                             ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20' 
                             : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          }`}
                       >
                          {canAfford ? 'RESGATAR' : 'PONTOS INSUFICIENTES'}
                       </button>
                    </Card>
                  );
               })}
            </div>
          )}

          {activeTab === 'profile' && renderProfileAndGoals()}
        </main>
      </div>
    </div>
  );
};

export default App;
