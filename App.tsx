import React, { useState, useEffect, useRef } from 'react';
import { 
  Flame, Clock, Skull, User, Sword, Scroll, FlaskConical, BrainCircuit, Zap, Dumbbell, 
  Plus, CheckCircle2, Trash2, Target, Utensils, Timer, TrendingUp, ShoppingBag, 
  UserSquare2, XCircle, ChefHat, RefreshCw, Banknote, Youtube, MessageSquare, 
  Book, Bot, Send, Save, BicepsFlexed, Activity, ClipboardList, AlertOctagon, 
  CalendarDays, LineChart, AlarmClock, ToggleRight, ToggleLeft, ScanEye, Camera, 
  Upload, Play, Pause, RotateCcw, Wrench, Mic, Square, Volume2, X
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";
import StatsChart from './components/StatsChart';
import { 
  AppState, Mission, DailyLog, UserProfile, Goal, ProgressEntry, Alarm, 
  WorkoutPlan, ExerciseLog, DailyWorkoutFeedback, ChatMessage, JournalEntry, 
  Recipe, Reward, AiTone 
} from './types';
import { BASE_MISSIONS, REWARDS, REALITY_CHECKS } from './constants';

const XP_PER_LEVEL = 1000;

const Card: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-slate-900/50 border border-slate-800 rounded-xl ${className}`}>
    {children}
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl transition-all w-full md:w-auto ${
      active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    <Icon size={20} />
    <span className="font-bold text-sm hidden md:inline">{label}</span>
  </button>
);

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Audio Decoding Helpers
function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function playAudioData(base64Data: string) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const pcmData = base64ToUint8Array(base64Data);
    
    // 16-bit PCM conversion
    const dataInt16 = new Int16Array(pcmData.buffer);
    const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

const App: React.FC = () => {
  // Main State
  const [state, setState] = useState<AppState>({
    points: 0,
    xp: 0,
    strikes: 0,
    missions: BASE_MISSIONS,
    logs: [],
    hardcoreMode: false,
    lastResetDate: new Date().toISOString().split('T')[0],
    profile: {
      name: '',
      age: '',
      weight: '',
      height: '',
      tone: 'mentor'
    },
    goals: [],
    progressLogs: [],
    alarms: [],
    exerciseLogs: [],
    workoutFeedbacks: [],
    workoutChatHistory: [],
    workoutJournal: [],
    dietRecipes: []
  });

  // UI State
  const [activeTab, setActiveTab] = useState('missions');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGoalName, setNewGoalName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Voice Assistant State
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceResponse, setVoiceResponse] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Diet State
  const [dietGoal, setDietGoal] = useState('Perder Peso (Definição)');
  const [dietLikes, setDietLikes] = useState('');
  const [dietAvailable, setDietAvailable] = useState('');
  const [dietBudget, setDietBudget] = useState('');
  const [isGeneratingDiet, setIsGeneratingDiet] = useState(false);

  // Workout State
  const [workoutSubTab, setWorkoutSubTab] = useState('plan');
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [journalInput, setJournalInput] = useState('');
  const [journalAnalysisResult, setJournalAnalysisResult] = useState<string | null>(null);
  const [isAnalyzingJournal, setIsAnalyzingJournal] = useState(false);
  
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [workoutGoal, setWorkoutGoal] = useState('Hipertrofia (Ganho de Massa)');
  const [workoutLevel, setWorkoutLevel] = useState('Intermediário');
  const [workoutDays, setWorkoutDays] = useState('4');
  const [workoutTimeAvailable, setWorkoutTimeAvailable] = useState('60');
  const [workoutEquipment, setWorkoutEquipment] = useState('Academia Completa');
  const [workoutWeakPoints, setWorkoutWeakPoints] = useState('');
  const [workoutFavorites, setWorkoutFavorites] = useState('');
  const [workoutStylePreference, setWorkoutStylePreference] = useState('Padrão (Balanced)');
  const [workoutInjuries, setWorkoutInjuries] = useState('');
  
  const [dailyRPE, setDailyRPE] = useState(5);
  const [dailyNotes, setDailyNotes] = useState('');
  const [currentInputs, setCurrentInputs] = useState<Record<string, string>>({});
  const [workoutFeedback, setWorkoutFeedback] = useState('');

  // Tools State
  const [activeTool, setActiveTool] = useState('pomodoro');
  const [pomoTime, setPomoTime] = useState(25 * 60);
  const [pomoMode, setPomodoroMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [pomoIsActive, setPomoIsActive] = useState(false);
  
  const [newAlarmTime, setNewAlarmTime] = useState('');
  
  const [swTime, setSwTime] = useState(0);
  const [swIsActive, setSwIsActive] = useState(false);

  // Motivation State
  const [motivationSpeech, setMotivationSpeech] = useState('');
  const [isGeneratingMotivation, setIsGeneratingMotivation] = useState(false);

  // Progress State
  const [isAnalyzingBody, setIsAnalyzingBody] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  // Animation State
  const [scoreBump, setScoreBump] = useState(false);
  const [pointAnimation, setPointAnimation] = useState<{ label: string; value: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  // Computed
  const currentLevel = Math.floor(state.xp / XP_PER_LEVEL) + 1;
  const xpProgress = state.xp % XP_PER_LEVEL;
  const xpPercent = (xpProgress / XP_PER_LEVEL) * 100;
  
  // Logic for Streak (simplified)
  const calculateStreak = () => {
    // This is a placeholder logic. Real logic would analyze dates in state.logs
    return 0; 
  };
  const currentStreak = calculateStreak();

  const completedMissionIds = new Set(
    state.logs
      .filter(l => l.date === new Date().toISOString().split('T')[0] && l.status === 'completed')
      .map(l => l.missionId)
  );

  const failedMissionIds = new Set(
    state.logs
      .filter(l => l.date === new Date().toISOString().split('T')[0] && l.status === 'failed')
      .map(l => l.missionId)
  );

  // Effects
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      const diff = endOfDay.getTime() - now.getTime();
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (pomoIsActive && pomoTime > 0) {
      interval = setInterval(() => setPomoTime(t => t - 1), 1000);
    } else if (pomoTime === 0) {
      setPomoIsActive(false);
    }
    return () => clearInterval(interval);
  }, [pomoIsActive, pomoTime]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (swIsActive) {
      interval = setInterval(() => setSwTime(t => t + 10), 10);
    }
    return () => clearInterval(interval);
  }, [swIsActive]);

  // Handlers
  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setState(prev => ({ ...prev, profile: { ...prev.profile, [field]: value } }));
  };

  const handleToneChange = (tone: AiTone) => {
    setState(prev => ({ ...prev, profile: { ...prev.profile, tone } }));
  };

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this user profile and provide a harsh, disciplined strategic analysis: ${JSON.stringify(state.profile)}`,
      });
      setState(prev => ({ ...prev, aiAnalysis: response.text }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddGoal = () => {
    if (!newGoalName.trim()) return;
    const newGoal: Goal = {
      id: Date.now().toString(),
      label: newGoalName,
      completed: false,
      rewardPoints: 100 // Default
    };
    setState(prev => ({ ...prev, goals: [...prev.goals, newGoal] }));
    setNewGoalName('');
  };

  const handleCompleteGoal = (id: string) => {
    setState(prev => {
      const goal = prev.goals.find(g => g.id === id);
      if (!goal || goal.completed) return prev;
      return {
        ...prev,
        points: prev.points + goal.rewardPoints,
        xp: prev.xp + 100,
        goals: prev.goals.map(g => g.id === id ? { ...g, completed: true } : g)
      };
    });
    triggerPointAnimation(100, "META COMPLETADA");
  };

  const handleDeleteGoal = (id: string) => {
    setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
  };

  const handleFail = (mission: Mission) => {
    const log: DailyLog = {
      date: new Date().toISOString().split('T')[0],
      missionId: mission.id,
      status: 'failed',
      pointsChange: 0
    };
    setState(prev => ({ ...prev, logs: [...prev.logs, log], strikes: prev.strikes + 1 }));
  };

  const handleComplete = (mission: Mission) => {
    const log: DailyLog = {
      date: new Date().toISOString().split('T')[0],
      missionId: mission.id,
      status: 'completed',
      pointsChange: mission.points
    };
    setState(prev => ({ 
      ...prev, 
      logs: [...prev.logs, log], 
      points: prev.points + mission.points,
      xp: prev.xp + 10 
    }));
    triggerPointAnimation(mission.points, mission.label);
  };

  const handleDeleteMission = (id: string) => {
    setState(prev => ({ ...prev, missions: prev.missions.filter(m => m.id !== id) }));
  };

  const handleGenerateDiet = async () => {
    setIsGeneratingDiet(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Generate 3 cheap and healthy recipes based on: Goal=${dietGoal}, Likes=${dietLikes}, Available=${dietAvailable}, Budget=${dietBudget}. Return JSON with name, calories, costEstimate, time, ingredients (array), instructions (array), videoQuery, benefits.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      
      const recipes = JSON.parse(response.text || '[]');
      setState(prev => ({ ...prev, dietRecipes: recipes }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingDiet(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput, timestamp: Date.now() };
    setState(prev => ({ ...prev, workoutChatHistory: [...prev.workoutChatHistory, userMsg] }));
    setChatInput('');
    setIsChatting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const chat = ai.chats.create({ model: 'gemini-3-flash-preview' });
      // Feed history... (simplified here just sending last message for brevity/context limitation in stateless)
      const result = await chat.sendMessage({ message: userMsg.text });
      const botMsg: ChatMessage = { role: 'model', text: result.text, timestamp: Date.now() };
      setState(prev => ({ ...prev, workoutChatHistory: [...prev.workoutChatHistory, botMsg] }));
    } catch (e) {
      console.error(e);
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
    setState(prev => ({ ...prev, workoutJournal: [...prev.workoutJournal, entry] }));
    setJournalInput('');
  };

  const handleAnalyzeJournal = async () => {
    setIsAnalyzingJournal(true);
    try {
       const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
       const journalText = state.workoutJournal.slice(-3).map(j => j.text).join('\n');
       const response = await ai.models.generateContent({
         model: 'gemini-3-flash-preview',
         contents: `Analyze these workout journal entries and suggest improvements: ${journalText}`
       });
       setJournalAnalysisResult(response.text);
    } catch (e) { console.error(e); }
    finally { setIsAnalyzingJournal(false); }
  };

  const handleSmartPlanAdjustment = () => {
    // Placeholder for AI plan adjustment logic
    alert("Funcionalidade de ajuste inteligente em desenvolvimento.");
  };

  const handleGenerateWorkout = async () => {
    setIsGeneratingWorkout(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Create a workout plan. Goal: ${workoutGoal}, Level: ${workoutLevel}, Days: ${workoutDays}, Time: ${workoutTimeAvailable}, Equipment: ${workoutEquipment}. Return JSON matching the WorkoutPlan interface structure (overview, days array with exercises).`;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const planData = JSON.parse(response.text);
      const newPlan: WorkoutPlan = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...planData
      };
      setState(prev => ({ ...prev, workoutPlan: newPlan }));
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingWorkout(false);
    }
  };

  const resetWorkout = () => {
    setState(prev => ({ ...prev, workoutPlan: undefined }));
  };

  const handleDailyFeedback = () => {
    const feedback: DailyWorkoutFeedback = {
      date: new Date().toISOString().split('T')[0],
      rpe: dailyRPE,
      notes: dailyNotes
    };
    setState(prev => ({ ...prev, workoutFeedbacks: [...prev.workoutFeedbacks, feedback] }));
    setDailyNotes('');
    alert("Feedback salvo.");
  };

  const handleSaveLoad = (exerciseName: string) => {
    const weight = parseFloat(currentInputs[exerciseName]);
    if (isNaN(weight)) return;
    const log: ExerciseLog = {
      date: new Date().toISOString(),
      exerciseName,
      weight
    };
    setState(prev => ({ ...prev, exerciseLogs: [...prev.exerciseLogs, log] }));
  };

  const handleEvolveWorkout = async () => {
    setIsGeneratingWorkout(true);
    // Logic to regenerate workout based on logs
    setIsGeneratingWorkout(false);
  };

  const togglePomodoro = () => setPomoIsActive(!pomoIsActive);
  const resetPomodoro = () => {
    setPomoIsActive(false);
    setPomoTime(pomoMode === 'focus' ? 25 * 60 : pomoMode === 'short' ? 5 * 60 : 15 * 60);
  };

  const addAlarm = () => {
    if (!newAlarmTime) return;
    const alarm: Alarm = {
      id: Date.now().toString(),
      time: newAlarmTime,
      label: 'Alarm',
      active: true
    };
    setState(prev => ({ ...prev, alarms: [...prev.alarms, alarm] }));
    setNewAlarmTime('');
  };

  const toggleAlarm = (id: string) => {
    setState(prev => ({
      ...prev,
      alarms: prev.alarms.map(a => a.id === id ? { ...a, active: !a.active } : a)
    }));
  };

  const deleteAlarm = (id: string) => {
    setState(prev => ({ ...prev, alarms: prev.alarms.filter(a => a.id !== id) }));
  };

  const toggleStopwatch = () => setSwIsActive(!swIsActive);
  const resetStopwatch = () => {
    setSwIsActive(false);
    setSwTime(0);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder
  };
  
  const handleFaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder
  };

  const deleteProgressEntry = (id: string) => {
    setState(prev => ({ ...prev, progressLogs: prev.progressLogs.filter(p => p.id !== id) }));
  };

  const handleRedeem = (reward: Reward) => {
    if (state.points >= reward.cost) {
      setState(prev => ({ ...prev, points: prev.points - reward.cost }));
      triggerPointAnimation(-reward.cost, reward.label);
    }
  };

  // Motivation Handlers
  const handleGenerateMotivation = async (type: 'roast' | 'hype' | 'focus') => {
    setIsGeneratingMotivation(true);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let prompt = "";
        const context = `Nome: ${state.profile.name || 'Soldado'}, Nível: ${currentLevel}, Strikes: ${state.strikes}`;
        
        switch(type) {
            case 'roast':
                prompt = `CONTEXTO: ${context}. AJA COMO: Um sargento brutal e realista. O usuário está precisando de um choque de realidade. Dê um esporro curto e grosso sobre disciplina, fracasso e mediocridade. Português.`;
                break;
            case 'hype':
                prompt = `CONTEXTO: ${context}. AJA COMO: Um treinador de elite motivando para a guerra. O usuário vai treinar agora. Dê energia, fale sobre glória, dor e conquista. Português.`;
                break;
            case 'focus':
                prompt = `CONTEXTO: ${context}. AJA COMO: Um filósofo estoico (Marco Aurélio). O usuário está distraído. Fale sobre a brevidade da vida (Memento Mori) e o foco no essencial. Português.`;
                break;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });
        setMotivationSpeech(response.text);
    } catch (e) {
        console.error(e);
        alert("Erro ao conectar com o QG Mental.");
    } finally {
        setIsGeneratingMotivation(false);
    }
  };

  const toggleHardcoreMode = () => {
      setState(prev => ({...prev, hardcoreMode: !prev.hardcoreMode}));
  };

  // Voice Assistant Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setVoiceResponse('');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Erro ao acessar microfone.");
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessingVoice(true);

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
        await handleVoiceQuery(audioBlob);
        
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };
    }
  };

  const handleVoiceQuery = async (audioBlob: Blob) => {
    try {
      const base64Audio = await blobToBase64(audioBlob);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Prepare Context
      const contextData = {
        stats: {
          level: currentLevel,
          points: state.points,
          xp: state.xp,
          strikes: state.strikes,
          streak: currentStreak
        },
        profile: state.profile,
        activeTab: activeTab,
        missionsStatus: {
          completed: Array.from(completedMissionIds),
          failed: Array.from(failedMissionIds),
          totalMissions: state.missions.length
        },
        dietGoal: dietGoal,
        workoutGoal: workoutGoal,
        activeWorkout: state.workoutPlan ? state.workoutPlan.overview : "Nenhum",
      };

      const systemPrompt = `
        Você é o "Oráculo", a IA central do app "Protocolo de Disciplina".
        Você tem acesso total aos dados do usuário.
        DADOS ATUAIS: ${JSON.stringify(contextData)}
        
        Responda à pergunta do usuário (que está em áudio) de forma curta, direta e com a personalidade definida no perfil (${state.profile.tone}).
        Se o usuário perguntar onde encontrar algo, diga em qual aba está.
        Se perguntar sobre status, diga os números exatos.
        Mantenha a resposta em Português.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { inlineData: { mimeType: 'audio/webm', data: base64Audio } }
            ]
          }
        ]
      });

      const textResponse = response.text || "Não consegui entender o comando, soldado.";
      setVoiceResponse(textResponse);
      await speakText(textResponse);

    } catch (error) {
      console.error(error);
      setVoiceResponse("Erro de comunicação com o QG.");
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const speakText = async (text: string) => {
    setIsPlayingAudio(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' } // 'Charon' has a deep, velvety tone
            }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        await playAudioData(base64Audio);
      }
    } catch (e) {
      console.error("Error generating speech:", e);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const triggerPointAnimation = (value: number, label: string) => {
    setPointAnimation({ value, label });
    setScoreBump(true);
    setTimeout(() => {
      setScoreBump(false);
      setPointAnimation(null);
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStopwatch = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${centis.toString().padStart(2, '0')}`;
  };

  // Render Helpers (Pasted from user content)
  const renderHeader = () => (
    <header className="relative md:fixed md:top-0 md:left-0 md:right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 pb-4 pt-6 px-4 transition-all duration-300">
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

  const renderVoiceModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-md p-6 relative shadow-2xl shadow-emerald-900/20">
        <button 
          onClick={() => setShowVoiceModal(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-white"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h3 className="text-xl font-bold text-white flex items-center justify-center gap-2">
              <Bot className="text-emerald-500" /> ORÁCULO
            </h3>
            <p className="text-xs text-slate-400 mt-1">Comando de Voz Integrado</p>
          </div>

          <div className="relative">
            {isRecording && (
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
            )}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingVoice || isPlayingAudio}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-600 text-white scale-110 shadow-lg shadow-red-500/50' 
                  : isProcessingVoice || isPlayingAudio
                    ? 'bg-slate-700 text-slate-400 cursor-wait'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-lg shadow-emerald-500/30'
              }`}
            >
              {isProcessingVoice ? (
                <RefreshCw className="animate-spin" size={32} />
              ) : isPlayingAudio ? (
                <Volume2 className="animate-pulse" size={32} />
              ) : isRecording ? (
                <Square fill="currentColor" size={32} />
              ) : (
                <Mic size={32} />
              )}
            </button>
          </div>

          <div className="text-center min-h-[60px]">
            {isRecording && <p className="text-red-400 font-mono text-sm animate-pulse">GRAVANDO COMANDO...</p>}
            {isProcessingVoice && <p className="text-emerald-400 font-mono text-sm animate-pulse">PROCESSANDO DADOS TÁTICOS...</p>}
            {isPlayingAudio && <p className="text-emerald-400 font-mono text-sm animate-pulse">TRANSMITINDO ÁUDIO...</p>}
            
            {!isRecording && !isProcessingVoice && !isPlayingAudio && !voiceResponse && (
              <p className="text-slate-500 text-sm">Toque para falar. Pergunte sobre suas missões, dieta ou status.</p>
            )}
            {voiceResponse && (
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 text-left">
                <p className="text-slate-200 text-sm leading-relaxed">{voiceResponse}</p>
                <div className="flex justify-end mt-2">
                  <button onClick={() => speakText(voiceResponse)} disabled={isPlayingAudio} className="text-emerald-500 p-1 hover:text-emerald-400 disabled:opacity-50">
                    <Volume2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 ${state.hardcoreMode ? 'theme-hardcore' : ''} pb-24`}>
       {renderHeader()}
       
       <div className="max-w-5xl mx-auto p-4 md:pt-48 flex flex-col md:flex-row gap-6">
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

        {/* Floating Voice Button */}
        <button
          onClick={() => setShowVoiceModal(true)}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl shadow-emerald-500/30 transition-transform hover:scale-110 border-2 border-emerald-400/50"
          title="Abrir Oráculo"
        >
          <Mic size={24} />
        </button>

        {showVoiceModal && renderVoiceModal()}

        {/* Main Content - Added bottom padding for mobile nav */}
        <main className="flex-1 min-w-0 space-y-6 min-h-[50vh] pb-24 md:pb-0">
          {activeTab === 'missions' && (
             <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="w-full py-4 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 font-bold hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2 group"
                >
                  <Plus className="group-hover:scale-110 transition-transform" /> ADICIONAR MISSÃO
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
          
          {activeTab === 'motivation' && (
             <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <Card className="p-8 border-red-900/30 bg-red-950/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Flame size={120} className="text-red-500" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2">ARSENAL MENTAL</h2>
                        <p className="text-slate-400 mb-6">A mente falha antes do corpo. Fortaleça-a.</p>

                        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 mb-6">
                            <h3 className="text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-2">
                                <Skull size={14} /> Reality Check Diário
                            </h3>
                            <p className="text-xl font-bold text-slate-200 font-serif italic">
                                "{REALITY_CHECKS[Math.floor(Math.random() * REALITY_CHECKS.length)]}"
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                            <button 
                                onClick={() => handleGenerateMotivation('roast')}
                                disabled={isGeneratingMotivation}
                                className="p-4 bg-slate-900 border border-slate-800 hover:border-red-500 hover:bg-red-950/20 rounded-xl transition-all group text-left"
                            >
                                <Skull className="text-slate-500 group-hover:text-red-500 mb-2" />
                                <div className="font-bold text-slate-200">Choque de Realidade</div>
                                <div className="text-[10px] text-slate-500">Para quando você estiver com preguiça.</div>
                            </button>
                            <button 
                                onClick={() => handleGenerateMotivation('hype')}
                                disabled={isGeneratingMotivation}
                                className="p-4 bg-slate-900 border border-slate-800 hover:border-orange-500 hover:bg-orange-950/20 rounded-xl transition-all group text-left"
                            >
                                <Flame className="text-slate-500 group-hover:text-orange-500 mb-2" />
                                <div className="font-bold text-slate-200">Pré-Guerra</div>
                                <div className="text-[10px] text-slate-500">Energia pura antes do treino.</div>
                            </button>
                            <button 
                                onClick={() => handleGenerateMotivation('focus')}
                                disabled={isGeneratingMotivation}
                                className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500 hover:bg-blue-950/20 rounded-xl transition-all group text-left"
                            >
                                <BrainCircuit className="text-slate-500 group-hover:text-blue-500 mb-2" />
                                <div className="font-bold text-slate-200">Estoicismo</div>
                                <div className="text-[10px] text-slate-500">Recalibrar o foco e propósito.</div>
                            </button>
                        </div>

                        {motivationSpeech && (
                            <div className="bg-slate-950/80 p-6 rounded-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <Bot className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-500 uppercase">Transmissão do QG</span>
                                    </div>
                                    <button onClick={() => setMotivationSpeech('')} className="text-slate-600 hover:text-white"><XCircle size={16} /></button>
                                </div>
                                <p className="text-slate-300 whitespace-pre-line leading-relaxed font-medium">
                                    {motivationSpeech}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                <Card className="p-6 flex items-center justify-between border-slate-800 bg-slate-900/50">
                     <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-white">Modo Hardcore</h3>
                            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Risco Alto</span>
                        </div>
                        <p className="text-xs text-slate-500 max-w-md">
                            A interface fica vermelha. Falhas punem o dobro de XP. A voz da IA se torna agressiva. Apenas para quem aguenta a pressão.
                        </p>
                     </div>
                     <button 
                        onClick={toggleHardcoreMode}
                        className={`w-14 h-8 rounded-full transition-colors relative ${state.hardcoreMode ? 'bg-red-600' : 'bg-slate-700'}`}
                     >
                        <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform ${state.hardcoreMode ? 'translate-x-6' : 'translate-x-0'}`} />
                     </button>
                </Card>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;