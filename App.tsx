import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, TopBar } from './components/Layout';
import { Tools } from './components/Tools';
import { db } from './services/db';
import { UserProfile, Tab, Mission, TrainingPlan, DietPlan, LeaderboardEntry, MartialArtsPlan } from './types';
import { geminiService } from './services/geminiService';
import { CheckCircle2, Circle, Send, BrainCircuit, Lock, Salad, Trophy, User as UserIcon, Target, Dumbbell, LogOut, Flame, Mail, Chrome, Share2, Trash2, Plus, X, RefreshCw, AlertCircle, Bot, Palette, Settings, Wallet, Utensils, Volume2, StopCircle, Mic, ShoppingCart, Zap, Shield, Sparkles, Swords, PlayCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Audio Helper Functions ---

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- Constants & Config ---

const THEMES: Record<string, { bg: string, text: string, name: string, hex: string, price: number }> = {
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500', name: 'Emerald (Padrão)', hex: '#10b981', price: 0 },
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-500',    name: 'Operação Blue',    hex: '#3b82f6', price: 100 },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-500',  name: 'Cyber Violet',  hex: '#8b5cf6', price: 150 },
  rose:    { bg: 'bg-rose-500',    text: 'text-rose-500',    name: 'Hardcore Rose',    hex: '#f43f5e', price: 0 }, // Free for hardcore
  amber:   { bg: 'bg-amber-500',   text: 'text-amber-500',   name: 'Solar Amber',   hex: '#f59e0b', price: 120 },
  cyan:    { bg: 'bg-cyan-500',    text: 'text-cyan-500',    name: 'Neon Cyan',    hex: '#06b6d4', price: 120 },
};

interface ShopItemDef {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  type: 'theme' | 'consumable';
  value?: string;
}

const SHOP_ITEMS: ShopItemDef[] = [
  { id: 'theme_blue', name: 'Interface Blue', description: 'Personalização visual azul tático.', price: 100, icon: Palette, type: 'theme', value: 'blue' },
  { id: 'theme_violet', name: 'Interface Violet', description: 'Personalização visual cyberpunk.', price: 150, icon: Palette, type: 'theme', value: 'violet' },
  { id: 'theme_amber', name: 'Interface Amber', description: 'Personalização visual de alerta.', price: 120, icon: Palette, type: 'theme', value: 'amber' },
  { id: 'theme_cyan', name: 'Interface Cyan', description: 'Personalização visual futurista.', price: 120, icon: Palette, type: 'theme', value: 'cyan' },
  { id: 'streak_freeze', name: 'Escudo de Streak', description: 'Protege sua sequência por 1 dia perdido.', price: 300, icon: Shield, type: 'consumable' },
  { id: 'xp_boost', name: 'XP Booster 2x', description: 'Dobro de XP por 24 horas.', price: 500, icon: Zap, type: 'consumable' },
];

// --- Components ---

const ToastNotification: React.FC<{ message: string, accentColor: string }> = ({ message, accentColor }) => (
  <div className={`fixed bottom-8 right-8 ${accentColor} text-black font-bold px-6 py-4 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.3)] z-50 animate-[slideIn_0.3s_ease-out] flex items-center gap-3`}>
    <div className="bg-black/10 p-2 rounded-full">
      <Flame size={20} />
    </div>
    <span className="text-lg">{message}</span>
  </div>
);

// Simple Markdown Parser for Rich Text rendering without heavy libraries
const MarkdownRenderer: React.FC<{ content: string; accentColor: string }> = ({ content, accentColor }) => {
  const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className={`${accentColor.replace('bg-', 'text-')} font-bold`}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = content.split('\n');

  return (
    <div className="space-y-2 text-sm md:text-base leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2"></div>;
        
        // Handle Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
             <div key={i} className="flex gap-2 ml-1">
                <span className={`${accentColor.replace('bg-', 'text-')} font-bold`}>•</span>
                <p className="flex-1">{parseBold(trimmed.replace(/^[-*]\s/, ''))}</p>
             </div>
          );
        }

        // Handle Numbered Lists (basic 1. detection)
        if (/^\d+\./.test(trimmed)) {
           return (
             <div key={i} className="flex gap-2 ml-1">
                <span className={`${accentColor.replace('bg-', 'text-')} font-mono font-bold`}>{trimmed.split('.')[0]}.</span>
                <p className="flex-1">{parseBold(trimmed.replace(/^\d+\.\s*/, ''))}</p>
             </div>
           )
        }

        return <p key={i}>{parseBold(line)}</p>;
      })}
    </div>
  );
};

const LevelUpModal: React.FC<{ level: number, onClose: () => void, accentColor: string }> = ({ level, onClose, accentColor }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-[fadeIn_0.3s_ease-out]" onClick={onClose}>
    <div className={`bg-slate-900 border-2 ${accentColor.replace('bg-', 'border-')} p-10 rounded-3xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden max-w-sm w-full`} onClick={e => e.stopPropagation()}>
       <div className={`absolute top-0 left-0 w-full h-2 ${accentColor}`}></div>
       <div className={`mx-auto w-24 h-24 rounded-full ${accentColor} flex items-center justify-center mb-6 shadow-xl`}>
         <Trophy size={48} className="text-black" />
       </div>
       <h2 className="text-4xl font-black text-white italic mb-2 tracking-tighter">LEVEL UP!</h2>
       <p className="text-slate-400 mb-6 font-mono">NOVO NÍVEL ALCANÇADO</p>
       <div className={`text-8xl font-black ${accentColor.replace('bg-', 'text-')} mb-8`}>{level}</div>
       <button onClick={onClose} className={`w-full ${accentColor} text-black font-bold py-4 rounded-xl hover:brightness-110 transition-all`}>
         CONTINUAR
       </button>
    </div>
  </div>
);

const GeneralChatView: React.FC<{ user: UserProfile, accentColor: string }> = ({ user, accentColor }) => {
  const [messages, setMessages] = useState<{role: string, text: string, id: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioState, setAudioState] = useState<{isPlaying: boolean, currentMsgId: string | null}>({ isPlaying: false, currentMsgId: null });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleSendAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Erro ao acessar microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    setLoading(true);
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, { role: 'user', text: "🎤 Áudio Enviado", id: userMsgId }]);

    try {
      const base64Audio = await blobToBase64(audioBlob);
      // Determine mimetype (MediaRecorder usually gives webm, but let's be generic or explicit)
      const responseText = await geminiService.chatWithCoach({ audioData: base64Audio, mimeType: 'audio/webm' }, user);
      
      const responseId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { role: 'model', text: responseText, id: responseId }]);
      
      // Auto play response for audio interactions
      handlePlayAudio(responseText, responseId);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "Erro ao processar áudio.", id: Date.now().toString() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', text: input, id: Date.now().toString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const responseText = await geminiService.chatWithCoach(input, user);
    
    setMessages(prev => [...prev, { role: 'model', text: responseText, id: (Date.now() + 1).toString() }]);
    setLoading(false);
  };

  const handlePlayAudio = async (text: string, msgId: string) => {
    // If playing this message, stop it
    if (audioState.isPlaying && audioState.currentMsgId === msgId) {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      setAudioState({ isPlaying: false, currentMsgId: null });
      return;
    }

    // If playing another message, stop it first
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }

    setAudioState({ isPlaying: true, currentMsgId: msgId });

    try {
      const base64Audio = await geminiService.generateSpeech(text, user.isHardcore);
      
      if (!base64Audio) {
         setAudioState({ isPlaying: false, currentMsgId: null });
         return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      }

      const audioCtx = audioContextRef.current;
      
      // Decode PCM
      const rawBytes = decodeBase64(base64Audio);
      const audioBuffer = await decodeAudioData(rawBytes, audioCtx, 24000, 1);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setAudioState({ isPlaying: false, currentMsgId: null });
      };

      source.start();
      audioSourceRef.current = source;

    } catch (e) {
      console.error("Audio Playback Error:", e);
      setAudioState({ isPlaying: false, currentMsgId: null });
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
        
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <div className={`p-6 rounded-full bg-slate-950 border border-slate-800 mb-6 shadow-xl`}>
               <Bot size={64} className={accentColor.replace('bg-', 'text-')} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">QUARTEL GENERAL (QG)</h2>
            <p className="max-w-md mb-6">
              {user.isHardcore 
                ? "Fale, recruta. Sem enrolação. O comando está ouvindo." 
                : "Olá. Estou analisando seu perfil. Como posso ajudar na sua jornada hoje?"}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
               <span className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">"Como está meu progresso?"</span>
               <span className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">"O que tem na loja?"</span>
               <span className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">"Me dê uma dica de dieta"</span>
               <span className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">"Analise minha última missão"</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
             <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-slate-700 ${msg.role === 'user' ? 'bg-slate-800' : 'bg-slate-950'}`}>
                    {msg.role === 'user' ? <UserIcon size={20} className="text-slate-400" /> : <Bot size={20} className={accentColor.replace('bg-', 'text-')} />}
                </div>

                <div className={`max-w-[85%] group`}>
                    <div className={`p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-slate-950 border border-slate-800 text-slate-300 rounded-tl-none'}`}>
                        <MarkdownRenderer content={msg.text} accentColor={accentColor} />
                    </div>
                    {msg.role === 'model' && (
                      <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => handlePlayAudio(msg.text, msg.id)}
                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors ${audioState.currentMsgId === msg.id && audioState.isPlaying ? 'text-emerald-400' : 'text-slate-500'}`}
                         >
                            {audioState.currentMsgId === msg.id && audioState.isPlaying ? <StopCircle size={14} /> : <Volume2 size={14} />}
                            {audioState.currentMsgId === msg.id && audioState.isPlaying ? "PARAR VOZ" : "OUVIR"}
                         </button>
                      </div>
                    )}
                </div>
             </div>
          ))}
          {loading && (
             <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                  <Bot size={20} className={accentColor.replace('bg-', 'text-')} />
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce delay-150"></div>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-slate-950 border-t border-slate-900 flex gap-2 items-center">
           <button 
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={loading}
              className={`p-3 rounded-lg transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
              title="Segure para falar"
           >
             <Mic size={20} />
           </button>
           
           <input 
             value={input}
             onChange={e => setInput(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
             placeholder={isRecording ? "Gravando..." : "Digite ou segure o microfone..."}
             disabled={isRecording}
             className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 placeholder:text-slate-600 transition-colors"
           />
           <button 
             onClick={handleSendMessage}
             disabled={loading || isRecording}
             className={`${accentColor} p-3 rounded-lg text-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
           >
             <Send size={20} />
           </button>
        </div>
      </div>
    </div>
  );
};

const AuthScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');

  const handleAuth = (isGoogle = false) => {
    setError('');
    try {
      if (isGoogle) {
        // Simulate Google Auth
        try {
          db.login('google_user@disciplina.ai', undefined, true);
        } catch {
          // If mock google user doesn't exist, register them
          db.register('google_user@disciplina.ai', 'Google User', undefined, undefined, 'google');
        }
        onLogin();
        return;
      }

      if (isRegister) {
        if (!email || !name || !password || !birthDate) throw new Error("Preencha todos os campos.");
        
        // Simple age check
        const age = new Date().getFullYear() - new Date(birthDate).getFullYear();
        if (age < 13) throw new Error("Idade mínima de 13 anos requerida.");

        db.register(email, name, password, birthDate, 'email');
        onLogin();
      } else {
        if (!email || !password) throw new Error("Preencha todos os campos.");
        db.login(email, password);
        onLogin();
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#050511] flex items-center justify-center p-4">
      <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 w-full max-w-md backdrop-blur-xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
        
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-500 p-3 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <BrainCircuit size={32} className="text-black" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white text-center mb-2">DISCIPLINA</h1>
        <p className="text-slate-400 text-center mb-8">{isRegister ? "Comece sua jornada." : "Retorne ao foco."}</p>
        
        {error && <div className="bg-red-900/20 border border-red-900 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}

        <div className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="text-xs font-bold text-slate-500 ml-1">CODINOME</label>
                <input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none transition-colors"
                  placeholder="Ex: Ronin"
                />
              </div>
              <div>
                 <label className="text-xs font-bold text-slate-500 ml-1">DATA DE NASCIMENTO</label>
                 <input 
                   type="date"
                   value={birthDate}
                   onChange={e => setBirthDate(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none transition-colors"
                 />
              </div>
            </>
          )}
          
          <div>
            <label className="text-xs font-bold text-slate-500 ml-1">EMAIL</label>
            <input 
              value={email}
              type="email"
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none transition-colors"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 ml-1">SENHA</label>
            <input 
              value={password}
              type="password"
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-emerald-500 outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            onClick={() => handleAuth(false)}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02]"
          >
            {isRegister ? 'INICIAR PROTOCOLO' : 'ACESSAR SISTEMA'}
          </button>

          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-slate-800 flex-1"></div>
            <span className="text-xs text-slate-600">OU</span>
            <div className="h-px bg-slate-800 flex-1"></div>
          </div>

          <button 
            onClick={() => handleAuth(true)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-3 border border-slate-700"
          >
            <Chrome size={20} /> Entrar com Google
          </button>

          <div className="text-center mt-6">
            <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-slate-400 hover:text-white transition-colors">
              {isRegister ? "Já tem uma conta? Entrar" : "Não tem conta? Criar Protocolo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MissionsViewProps {
  user: UserProfile;
  onUpdateUser: (u: Partial<UserProfile>) => void;
  onShowToast: (msg: string) => void;
  accentColor: string;
}

const MissionsView: React.FC<MissionsViewProps> = ({ user, onUpdateUser, onShowToast, accentColor }) => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [newMissionXp, setNewMissionXp] = useState(50);

  useEffect(() => {
    setMissions(db.getMissions(user.id));
  }, [user.id]);

  const toggleMission = (id: string) => {
    const updated = missions.map(m => {
      if (m.id === id && !m.completed) {
        const xpEarned = m.xp;
        const coinsEarned = Math.floor(m.xp / 5); // 1 Coin for every 5 XP
        onUpdateUser({ 
            xp: user.xp + xpEarned,
            coins: (user.coins || 0) + coinsEarned 
        });
        db.logActivity('mission_complete', xpEarned, `Mission: ${m.title}`);
        onShowToast(`+${xpEarned} XP • +${coinsEarned} Coins`);
        return { ...m, completed: true };
      }
      return m;
    });
    setMissions(updated);
    db.saveMissions(user.id, updated);
  };

  const handleShare = async (mission: Mission) => {
    const text = `Acabei de completar a missão "${mission.title}" no Disciplina AI! Ganhei ${mission.xp} XP. O conforto é o inimigo. 🚀`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Conquista Desbloqueada - Disciplina AI',
          text: text,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(text);
      onShowToast("Copiado para o clipboard!");
    }
  };

  const handleAddMission = () => {
    if (!newMissionTitle.trim()) return;
    
    const newMission: Mission = {
        id: Date.now().toString(),
        title: newMissionTitle,
        xp: newMissionXp,
        completed: false,
        type: 'one-time'
    };

    const updated = [...missions, newMission];
    setMissions(updated);
    db.saveMissions(user.id, updated);
    setIsAdding(false);
    setNewMissionTitle('');
    setNewMissionXp(50);
  };

  const handleRemoveMission = (id: string) => {
    const updated = missions.filter(m => m.id !== id);
    setMissions(updated);
    db.saveMissions(user.id, updated);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
       <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-bold text-white">Missões do Dia</h2>
         {!isAdding && (
            <button 
                onClick={() => setIsAdding(true)}
                className="text-xs border border-slate-700 px-3 py-1 rounded text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
                <Plus size={14} /> ADICIONAR MISSÃO
            </button>
         )}
       </div>

       {isAdding && (
         <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl mb-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex gap-4 mb-4">
                <input 
                    autoFocus
                    value={newMissionTitle}
                    onChange={e => setNewMissionTitle(e.target.value)}
                    placeholder="Título da missão..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 outline-none transition-colors"
                    onKeyDown={e => e.key === 'Enter' && handleAddMission()}
                />
                <select 
                    value={newMissionXp}
                    onChange={e => setNewMissionXp(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none w-28"
                >
                    <option value={20}>20 XP</option>
                    <option value={50}>50 XP</option>
                    <option value={100}>100 XP</option>
                </select>
            </div>
            <div className="flex justify-end gap-2">
                <button 
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-sm font-bold"
                >
                    CANCELAR
                </button>
                <button 
                    onClick={handleAddMission}
                    className={`px-4 py-2 rounded-lg text-black font-bold ${accentColor} hover:brightness-110 transition-all text-sm`}
                >
                    SALVAR
                </button>
            </div>
         </div>
       )}

       {missions.map(m => (
         <div key={m.id} className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between group hover:border-slate-700 transition-all">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${m.completed ? 'bg-emerald-900/20 text-emerald-500' : 'bg-slate-800 text-slate-600'}`}>
                <Target size={24} />
              </div>
              <div>
                <h3 className={`font-bold text-lg ${m.completed ? 'text-slate-500 line-through' : 'text-white'}`}>{m.title}</h3>
                <span className="text-xs font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-400">{m.xp} XP</span>
              </div>
            </div>
            
            <div className="flex gap-2 items-center">
              <button 
                  onClick={() => handleRemoveMission(m.id)}
                  className="p-3 rounded-lg text-slate-600 hover:text-red-500 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                  title="Remover Missão"
              >
                  <Trash2 size={20} />
              </button>

              {m.completed && (
                <button 
                  onClick={() => handleShare(m)}
                  className="p-3 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all border border-slate-700"
                  title="Compartilhar Conquista"
                >
                  <Share2 size={20} />
                </button>
              )}
              <button 
                onClick={() => toggleMission(m.id)}
                disabled={m.completed}
                className={`px-6 py-2 rounded-lg font-bold transition-all ${
                  m.completed 
                  ? 'bg-emerald-900/20 text-emerald-500 border border-emerald-900 cursor-default' 
                  : `${accentColor} hover:brightness-110 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]`
                }`}
              >
                {m.completed ? 'CONCLUÍDO' : 'CONCLUIR'}
              </button>
            </div>
         </div>
       ))}
    </div>
  );
};

const ShopView: React.FC<{ user: UserProfile, onUpdateUser: (u: Partial<UserProfile>) => void, accentColor: string, onShowToast: (msg: string) => void }> = ({ user, onUpdateUser, accentColor, onShowToast }) => {
  const handleBuy = (item: ShopItemDef) => {
    if ((user.coins || 0) < item.price) {
      onShowToast("Saldo insuficiente!");
      return;
    }

    // Check ownership for themes, safe check inventory
    const inventory = user.inventory || [];
    if (item.type === 'theme' && inventory.includes(`theme_${item.value}`)) {
      onShowToast("Você já possui este item!");
      return;
    }

    const newCoins = (user.coins || 0) - item.price;
    const newItemId = item.type === 'theme' ? `theme_${item.value}` : item.id;
    const newInventory = [...inventory, newItemId];

    onUpdateUser({ coins: newCoins, inventory: newInventory });
    onShowToast(`Compra realizada: ${item.name}`);
  };

  const isOwned = (item: ShopItemDef) => {
    const inventory = user.inventory || [];
    if (item.type === 'theme') return inventory.includes(`theme_${item.value}`) || item.value === 'emerald' || (user.isHardcore && item.value === 'rose');
    return false; // Consumables can be bought multiple times (logic simplification for now)
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
       <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="p-4 bg-yellow-900/20 rounded-xl text-yellow-500 border border-yellow-900/50">
               <ShoppingCart size={32} />
             </div>
             <div>
               <h2 className="text-3xl font-bold text-white tracking-tight">Arsenal & Suprimentos</h2>
               <p className="text-slate-400">Invista suas conquistas em melhorias.</p>
             </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Saldo Atual</span>
             <div className="text-4xl font-mono text-yellow-500 font-bold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-yellow-600 bg-yellow-500/20"></div>
                {user.coins || 0}
             </div>
          </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-4">
          {SHOP_ITEMS.map(item => {
             const owned = isOwned(item);
             return (
               <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col relative group overflow-hidden transition-all hover:border-slate-600">
                  <div className={`absolute top-0 left-0 w-full h-1 transition-all group-hover:bg-yellow-500/50 ${owned ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                     <div className={`p-3 rounded-lg ${owned ? 'bg-emerald-900/20 text-emerald-500' : 'bg-slate-900 text-slate-400'}`}>
                        <item.icon size={24} />
                     </div>
                     {owned ? (
                        <span className="bg-emerald-900/20 text-emerald-500 text-xs font-bold px-2 py-1 rounded border border-emerald-900/30">ADQUIRIDO</span>
                     ) : (
                        <span className="bg-yellow-900/20 text-yellow-500 text-xs font-bold px-2 py-1 rounded border border-yellow-900/30 flex items-center gap-1">
                           <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                           {item.price}
                        </span>
                     )}
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{item.name}</h3>
                  <p className="text-slate-400 text-sm mb-6 flex-1 leading-relaxed">{item.description}</p>

                  <button 
                    onClick={() => handleBuy(item)}
                    disabled={owned || (user.coins || 0) < item.price}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                      ${owned 
                        ? 'bg-slate-900 text-slate-500 cursor-default' 
                        : (user.coins || 0) >= item.price 
                          ? `${accentColor} text-black hover:brightness-110 shadow-lg` 
                          : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                      }
                    `}
                  >
                    {owned ? (
                       <> <CheckCircle2 size={16} /> NO INVENTÁRIO </>
                    ) : (
                       <> <Wallet size={16} /> COMPRAR </>
                    )}
                  </button>
               </div>
             );
          })}
       </div>
    </div>
  );
};

const MartialArtsView: React.FC<{ accentColor: string, user: UserProfile, onShowToast: (msg: string) => void }> = ({ accentColor, user, onShowToast }) => {
  const [style, setStyle] = useState('Boxe');
  const [level, setLevel] = useState('Iniciante');
  const [duration, setDuration] = useState('30');
  const [equipment, setEquipment] = useState('Sombra (Sem equipamento)');
  const [focus, setFocus] = useState('Técnica Pura');
  const [plan, setPlan] = useState<MartialArtsPlan | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [chatMode, setChatMode] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleGenerate = async () => {
    setLoading(true);
    const result = await geminiService.generateMartialArtsPlan(style, level, duration, equipment, focus);
    if (result) {
      setPlan(result);
      db.logActivity('martial_arts', 25, `Treino de ${style} Gerado`);
      onShowToast("+25 XP");
    } else {
      onShowToast("Erro ao gerar treino.");
    }
    setLoading(false);
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMsg as any]);
    setChatInput('');
    setLoading(true);

    // Context specific for Martial Arts Sensei
    const contextInput = `[CONTEXTO: Mestre de Artes Marciais no Dojo. Estilo do usuário: ${style}] ${chatInput}`;
    const response = await geminiService.chatWithCoach(contextInput, user);
    
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <div className="flex bg-slate-900 p-1 rounded-lg self-center border border-slate-800 mb-6">
        <button onClick={() => setChatMode(false)} className={`px-6 py-2 rounded-md font-bold transition-all ${!chatMode ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>TREINO DOJO</button>
        <button onClick={() => setChatMode(true)} className={`px-6 py-2 rounded-md font-bold transition-all ${chatMode ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>FALAR COM SENSEI</button>
      </div>

      {!chatMode ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 w-full animate-in fade-in slide-in-from-bottom-4">
           {!plan ? (
             <div className="space-y-6">
               <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-lg ${accentColor} text-black`}>
                    <Swords size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Gerador de Combate</h2>
                    <p className="text-slate-400 text-sm">Configure seu treino tático de luta.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="text-xs text-slate-500 font-bold block mb-2">ESTILO DE LUTA</label>
                     <select value={style} onChange={e => setStyle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                        <option>Boxe</option>
                        <option>Muay Thai</option>
                        <option>Kickboxing</option>
                        <option>Karate</option>
                        <option>MMA (Striking)</option>
                        <option>Jiu Jitsu (Solo Drills)</option>
                        <option>Taekwondo</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs text-slate-500 font-bold block mb-2">NÍVEL</label>
                     <select value={level} onChange={e => setLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                        <option>Iniciante (Faixa Branca)</option>
                        <option>Intermediário</option>
                        <option>Avançado</option>
                        <option>Competidor</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs text-slate-500 font-bold block mb-2">DURAÇÃO (MIN)</label>
                     <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                        <option value="15">15 Min (Express)</option>
                        <option value="30">30 Min</option>
                        <option value="45">45 Min</option>
                        <option value="60">60 Min</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-xs text-slate-500 font-bold block mb-2">EQUIPAMENTO</label>
                     <select value={equipment} onChange={e => setEquipment(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                        <option>Sombra (Sem equipamento)</option>
                        <option>Saco de Pancada</option>
                        <option>Manopla (Com parceiro)</option>
                        <option>Boneco de Treino</option>
                     </select>
                  </div>
                  <div className="md:col-span-2">
                     <label className="text-xs text-slate-500 font-bold block mb-2">FOCO DO TREINO</label>
                     <select value={focus} onChange={e => setFocus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                        <option>Técnica Pura (Forma)</option>
                        <option>Cardio/Conditioning (Alta Intensidade)</option>
                        <option>Combinações de Força</option>
                        <option>Reflexos e Defesa</option>
                     </select>
                  </div>
               </div>

               <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`w-full ${accentColor} text-black font-bold py-4 rounded-xl mt-4 hover:brightness-110 transition-all shadow-lg flex justify-center items-center gap-2`}
                >
                  {loading ? (
                    <>
                       <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                       SENSEI ESTÁ PLANEJANDO...
                    </>
                  ) : (
                    <>
                       <Swords size={20} />
                       INICIAR PROTOCOLO DE COMBATE
                    </>
                  )}
                </button>
             </div>
           ) : (
             <div className="space-y-6">
                <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                   <div>
                      <h2 className="text-3xl font-bold text-white uppercase italic">{plan.style}</h2>
                      <div className="flex gap-2 mt-2">
                         <span className="text-xs bg-slate-950 text-slate-400 px-2 py-1 rounded border border-slate-800">{plan.duration}</span>
                         <span className="text-xs bg-slate-950 text-slate-400 px-2 py-1 rounded border border-slate-800">{plan.focus}</span>
                      </div>
                   </div>
                   <button onClick={() => setPlan(null)} className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 hover:text-white transition-all">NOVO TREINO</button>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                   <h3 className="font-bold text-emerald-500 mb-2 flex items-center gap-2"><Zap size={16} /> AQUECIMENTO</h3>
                   <ul className="list-disc list-inside text-slate-400 space-y-1 text-sm">
                      {plan.warmup.map((w, i) => <li key={i}>{w}</li>)}
                   </ul>
                </div>

                <div className="space-y-3">
                   {plan.rounds.map((round, i) => (
                      <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition-colors group">
                         <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-3">
                               <span className={`text-xl font-black ${accentColor.replace('bg-', 'text-')}`}>R{round.number}</span>
                               <span className="font-bold text-white">{round.name}</span>
                            </div>
                            <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-slate-500 group-hover:text-white transition-colors">{round.duration}</span>
                         </div>
                         <div className="mb-2 text-xs text-slate-500 uppercase tracking-wider font-bold">Foco: {round.focusPoint}</div>
                         <div className="space-y-2 pl-4 border-l-2 border-slate-800">
                            {round.drills.map((drill, j) => (
                               <p key={j} className="text-slate-300 text-sm flex items-start gap-2">
                                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-500"></span>
                                  {drill}
                               </p>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                   <h3 className="font-bold text-blue-500 mb-2 flex items-center gap-2"><RefreshCw size={16} /> RESFRIAMENTO</h3>
                   <ul className="list-disc list-inside text-slate-400 space-y-1 text-sm">
                      {plan.cooldown.map((c, i) => <li key={i}>{c}</li>)}
                   </ul>
                </div>
             </div>
           )}
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
           <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {chatHistory.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                    <Swords size={48} className="mb-4" />
                    <p>Pergunte ao Sensei sobre técnicas, estratégias ou filosofia de luta.</p>
                 </div>
              )}
              {chatHistory.map((msg, i) => (
                 <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-slate-700 ${msg.role === 'user' ? 'bg-slate-800' : 'bg-slate-950'}`}>
                       {msg.role === 'user' ? <UserIcon size={16} /> : <Swords size={16} className={accentColor.replace('bg-', 'text-')} />}
                    </div>
                    <div className={`max-w-[85%] p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300'}`}>
                       <MarkdownRenderer content={msg.text} accentColor={accentColor} />
                    </div>
                 </div>
              ))}
              <div ref={chatEndRef} />
           </div>
           <div className="p-4 bg-slate-950 border-t border-slate-900 flex gap-2">
              <input 
                 value={chatInput}
                 onChange={e => setChatInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleChat()}
                 placeholder="Ex: Como melhorar meu cruzado de esquerda?"
                 className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600"
              />
              <button onClick={handleChat} disabled={loading} className={`${accentColor} p-3 rounded-lg text-black hover:brightness-110 disabled:opacity-50`}>
                 <Send size={20} />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

const TrainingView: React.FC<{ accentColor: string, user: UserProfile, onShowToast: (msg: string) => void }> = ({ accentColor, user, onShowToast }) => {
  const [mode, setMode] = useState<'plan' | 'chat'>('plan');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Enhanced Form states
  const [goal, setGoal] = useState('Hipertrofia (Ganho de Massa)');
  const [level, setLevel] = useState('Intermediário');
  const [days, setDays] = useState('4');
  const [duration, setDuration] = useState('60');
  const [equipment, setEquipment] = useState('Academia Completa');
  const [focusArea, setFocusArea] = useState('');
  const [injuries, setInjuries] = useState('');

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, loading, mode]);

  const handleGenerate = async () => {
    setLoading(true);
    const result = await geminiService.generateTrainingPlan(
      goal, 
      level, 
      days, 
      duration, 
      equipment, 
      focusArea, 
      injuries
    );
    setPlan(result);
    setLoading(false);
    db.logActivity('training', 20, 'Generated Training Plan');
    onShowToast("+20 XP");
  };

  const handleChat = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', text: input };
    setChatHistory(prev => [...prev, userMsg as any]);
    setInput('');
    setLoading(true);
    // Pass user context
    const response = await geminiService.chatWithCoach(input, user);
    setChatHistory(prev => [...prev, { role: 'model', text: response }]);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex bg-slate-900 p-1 rounded-lg self-center border border-slate-800 mb-6">
        <button onClick={() => setMode('plan')} className={`px-6 py-2 rounded-md font-bold transition-all ${mode === 'plan' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>PLANO</button>
        <button onClick={() => setMode('chat')} className={`px-6 py-2 rounded-md font-bold transition-all ${mode === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>CHAT IA</button>
      </div>

      {mode === 'plan' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 max-w-4xl mx-auto w-full">
          {!plan ? (
             <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-lg ${accentColor} text-black`}>
                    <Dumbbell size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Gerador de Treino IA</h2>
                    <p className="text-slate-400 text-sm">Preencha os dados táticos para gerar seu plano.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2">OBJETIVO PRINCIPAL</label>
                    <select value={goal} onChange={e=>setGoal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                      <option>Hipertrofia (Ganho de Massa)</option>
                      <option>Força Bruta</option>
                      <option>Perda de Peso / Definição</option>
                      <option>Resistência / Cardio</option>
                      <option>Calistenia</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2">NÍVEL</label>
                    <select value={level} onChange={e=>setLevel(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                      <option>Iniciante</option>
                      <option>Intermediário</option>
                      <option>Avançado</option>
                      <option>Spartan (Elite)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2">DIAS/SEMANA</label>
                    <select value={days} onChange={e=>setDays(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                      <option>2</option>
                      <option>3</option>
                      <option>4</option>
                      <option>5</option>
                      <option>6</option>
                    </select>
                  </div>

                   <div>
                    <label className="text-xs text-slate-500 font-bold block mb-2">TEMPO DISPONÍVEL (MIN)</label>
                    <select value={duration} onChange={e=>setDuration(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                      <option value="30">30 Minutos</option>
                      <option value="45">45 Minutos</option>
                      <option value="60">60 Minutos</option>
                      <option value="90">90 Minutos</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                     <label className="text-xs text-slate-500 font-bold block mb-2">EQUIPAMENTO</label>
                     <select value={equipment} onChange={e=>setEquipment(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors">
                       <option>Academia Completa</option>
                       <option>Halteres (Home Gym)</option>
                       <option>Apenas Peso do Corpo (Calistenia)</option>
                       <option>Barra e Anilhas</option>
                     </select>
                  </div>

                  <div className="md:col-span-2">
                     <label className="text-xs text-slate-500 font-bold block mb-2">PONTOS FRACOS / FOCO (OPCIONAL)</label>
                     <input 
                        value={focusArea}
                        onChange={e => setFocusArea(e.target.value)}
                        placeholder="Ex: Peitoral superior, Panturrilhas, Braços"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors"
                     />
                  </div>

                  <div className="md:col-span-2">
                     <label className="text-xs text-slate-500 font-bold block mb-2">LESÕES OU LIMITAÇÕES</label>
                     <input 
                        value={injuries}
                        onChange={e => setInjuries(e.target.value)}
                        placeholder="Ex: Dor no joelho esquerdo, Hérnia de disco..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600 transition-colors"
                     />
                  </div>
                </div>

                <button 
                  onClick={handleGenerate}
                  disabled={loading}
                  className={`w-full ${accentColor} text-black font-bold py-4 rounded-xl mt-4 hover:brightness-110 transition-all shadow-lg flex justify-center items-center gap-2`}
                >
                  {loading ? (
                    <>
                       <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                       ANALISANDO DADOS BIOMÉTRICOS...
                    </>
                  ) : (
                    <>
                       <BrainCircuit size={20} />
                       GERAR TREINO COMPLETO
                    </>
                  )}
                </button>
             </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white uppercase">{plan.split}</h3>
                  <p className="text-slate-400 text-xs mt-1">GERADO POR IA • {goal} • {level}</p>
                </div>
                <button onClick={() => setPlan(null)} className="text-xs bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700 hover:text-white transition-all">NOVO PLANO</button>
              </div>
              <div className="grid gap-4">
                {plan.days.map((d, i) => (
                  <div key={i} className="bg-slate-950 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                       <span className={`font-bold text-lg ${accentColor.replace('bg-', 'text-')}`}>{d.day}</span>
                       <span className="text-slate-400 text-sm bg-slate-900 px-2 py-1 rounded">{d.focus}</span>
                    </div>
                    <div className="space-y-4">
                      {d.exercises.map((ex, j) => (
                        <div key={j} className="group">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-200 font-medium group-hover:text-white transition-colors">{ex.name}</span>
                            <span className="text-slate-500 font-mono font-bold bg-slate-900 px-2 py-1 rounded">{ex.sets} x {ex.reps}</span>
                          </div>
                          
                          {(ex.substitution || ex.tip) && (
                            <div className="mt-2 pl-3 border-l-2 border-slate-800 space-y-1">
                              {ex.substitution && (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <RefreshCw size={12} className={accentColor.replace('bg-', 'text-')} />
                                  <span>Alt: <span className="text-slate-400">{ex.substitution}</span></span>
                                </div>
                              )}
                              {ex.tip && (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <AlertCircle size={12} className="text-yellow-500/70" />
                                  <span className="italic text-slate-400/80">{ex.tip}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'chat' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl flex-1 max-w-4xl mx-auto w-full flex flex-col overflow-hidden">
           <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {chatHistory.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600">
                   <div className={`p-6 rounded-full bg-slate-900 border border-slate-800 mb-4`}>
                      <BrainCircuit size={48} className={`opacity-50 ${accentColor.replace('bg-', 'text-')}`} />
                   </div>
                   <p className="font-bold text-slate-500">TREINADOR IA ONLINE</p>
                   <p className="text-sm text-slate-600">Pergunte sobre execução, dieta ou periodização.</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-slate-700 ${msg.role === 'user' ? 'bg-slate-800' : 'bg-slate-950'}`}>
                    {msg.role === 'user' ? <UserIcon size={20} className="text-slate-400" /> : <Bot size={20} className={accentColor.replace('bg-', 'text-')} />}
                  </div>

                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-slate-950 border border-slate-800 text-slate-300 rounded-tl-none'}`}>
                    <MarkdownRenderer content={msg.text} accentColor={accentColor} />
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-4">
                   <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0">
                      <Bot size={20} className={accentColor.replace('bg-', 'text-')} />
                   </div>
                   <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-slate-600 rounded-full animate-bounce delay-150"></div>
                   </div>
                </div>
              )}
              <div ref={chatBottomRef} />
           </div>
           <div className="p-4 bg-slate-950 border-t border-slate-900 flex gap-2">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
                placeholder="Ex: Como melhorar meu agachamento?"
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 text-white outline-none focus:border-slate-600"
              />
              <button onClick={handleChat} disabled={loading} className={`${accentColor} p-3 rounded-lg text-black hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed`}>
                <Send size={20} />
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

const DietView: React.FC<{ accentColor: string, onShowToast: (msg: string) => void }> = ({ accentColor, onShowToast }) => {
  const [likes, setLikes] = useState('');
  const [pantry, setPantry] = useState('');
  const [goal, setGoal] = useState('Perder Peso (Definição)');
  const [budget, setBudget] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const result = await geminiService.generateDietPlan(goal, likes, pantry, budget, additionalInfo);
    setPlan(result);
    setLoading(false);
    db.logActivity('diet_generated', 15);
    onShowToast("+15 XP");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-900/20 text-emerald-500 rounded-lg">
            <Salad size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Chef Inteligente</h2>
            <p className="text-slate-400">Receitas baratas com o que você tem em casa.</p>
          </div>
        </div>

        {!plan ? (
          <div className="space-y-6">
             <div>
               <label className="text-xs text-slate-500 font-bold block mb-2 uppercase">Objetivo</label>
               <select 
                 value={goal}
                 onChange={e => setGoal(e.target.value)}
                 className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white outline-none focus:border-emerald-500 transition-colors"
               >
                 <option>Perder Peso (Definição)</option>
                 <option>Ganhar Massa (Bulking)</option>
                 <option>Reeducação Alimentar</option>
                 <option>Energia e Performance</option>
               </select>
             </div>

             <div>
                <label className="text-xs text-slate-500 font-bold block mb-2 uppercase">Informações Adicionais / Metas Específicas</label>
                <textarea 
                  value={additionalInfo}
                  onChange={e => setAdditionalInfo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white outline-none min-h-[80px] focus:border-emerald-500 transition-colors"
                  placeholder="Ex: Quero perder 20kg de gordura, ganhar 5kg de massa magra, sou alérgico a camarão..."
                />
             </div>

             <div>
               <label className="text-xs text-slate-500 font-bold block mb-2 uppercase">O que você gosta de comer?</label>
               <textarea 
                  value={likes}
                  onChange={e => setLikes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white outline-none min-h-[100px] focus:border-emerald-500 transition-colors"
                  placeholder="Ex: Frango, ovo, batata doce, aveia, banana..."
               />
             </div>
             
             <div>
               <label className="text-xs text-slate-500 font-bold block mb-2 uppercase">O que tem na sua despensa agora?</label>
               <textarea 
                  value={pantry}
                  onChange={e => setPantry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 text-white outline-none min-h-[100px] focus:border-emerald-500 transition-colors"
                  placeholder="Ex: Arroz, feijão, macarrão, alguns ovos, cenoura..."
               />
             </div>

             <div>
               <label className="text-xs text-slate-500 font-bold block mb-2 uppercase">Orçamento Limite (Opcional)</label>
               <div className="relative">
                 <span className="absolute left-4 top-4 text-slate-500 font-bold">R$</span>
                 <input 
                    value={budget}
                    type="number"
                    onChange={e => setBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-4 pl-12 text-white outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Ex: 20"
                 />
               </div>
             </div>

             <button 
               onClick={handleGenerate}
               disabled={loading}
               className={`w-full ${accentColor} text-black font-bold py-4 rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2`}
             >
               {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    CALCULANDO MACROS...
                  </>
               ) : (
                  <>
                    <Utensils size={20} /> GERAR PLANO ALIMENTAR
                  </>
               )}
             </button>
          </div>
        ) : (
          <div>
             <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-xl font-bold text-white">Plano Sugerido</h3>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-slate-800 text-emerald-400 px-2 py-1 rounded border border-slate-700">~{plan.calories} kcal</span>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">{goal}</span>
                   </div>
                </div>
                <button onClick={() => setPlan(null)} className="text-xs text-slate-400 hover:text-white transition-colors">REFAZER</button>
             </div>
             <div className="grid gap-4">
               {plan.meals.map((meal, i) => (
                 <div key={i} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center hover:border-slate-700 transition-colors">
                    <div className="mb-2 md:mb-0">
                      <h4 className="font-bold text-emerald-400 mb-1">{meal.name}</h4>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      {meal.items.map((item, j) => (
                        <span key={j} className="text-xs bg-slate-900 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-800">{item}</span>
                      ))}
                    </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatsView: React.FC<{ user: UserProfile, accentColor: string }> = ({ user, accentColor }) => {
  const data = [
    { name: 'Seg', val: 40 },
    { name: 'Ter', val: 60 },
    { name: 'Qua', val: 30 },
    { name: 'Qui', val: 80 },
    { name: 'Sex', val: 90 },
    { name: 'Sab', val: 50 },
    { name: 'Dom', val: 70 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <UserIcon size={20} /> Scanner Corporal
        </h3>
        <div className="aspect-square bg-slate-950 rounded-xl relative overflow-hidden border border-slate-800 flex items-center justify-center group cursor-pointer">
           <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center opacity-20 grayscale group-hover:opacity-40 transition-opacity"></div>
           <div className={`w-full h-1 ${accentColor} absolute top-0 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_20px_rgba(16,185,129,0.5)]`}></div>
           <button className={`relative z-10 ${accentColor} text-black font-bold px-6 py-2 rounded-lg`}>NOVA FOTO</button>
        </div>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col">
         <h3 className="text-xl font-bold text-white mb-6">Consistência</h3>
         <div className="flex-1 w-full h-64">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={data}>
               <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
               <Tooltip 
                 contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                 itemStyle={{ color: '#fff' }}
                 cursor={{fill: 'rgba(255,255,255,0.05)'}}
               />
               <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                 {data.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.val > 70 ? (accentColor.includes('emerald') ? '#10b981' : '#ef4444') : '#334155'} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
         </div>
      </div>
    </div>
  );
};

const LeaderboardView: React.FC = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setLeaders(db.getLeaderboard());
  }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Trophy className="text-yellow-500" /> Classificação Global</h2>
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-bold">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Agente</th>
              <th className="p-4">Nível</th>
              <th className="p-4">Streak</th>
              <th className="p-4">Modo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {leaders.map((l, i) => (
              <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                <td className="p-4 font-mono text-slate-500">#{i + 1}</td>
                <td className="p-4 font-bold text-white">{l.name}</td>
                <td className="p-4 text-emerald-400 font-bold">LVL {l.level}</td>
                <td className="p-4 text-orange-500 font-mono">{l.streak} dias</td>
                <td className="p-4">
                  <span className={`text-[10px] px-2 py-1 rounded border ${l.mode === 'Hardcore' ? 'border-red-900 bg-red-900/20 text-red-500' : 'border-blue-900 bg-blue-900/20 text-blue-500'}`}>
                    {l.mode.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MotivationView: React.FC<{ isHardcore: boolean, toggleHardcore: () => void }> = ({ isHardcore, toggleHardcore }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className={`p-8 rounded-2xl border transition-all duration-500 ${isHardcore ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-900 border-slate-800'}`}>
         <h2 className={`text-3xl font-bold mb-4 ${isHardcore ? 'text-red-500' : 'text-white'}`}>
           {isHardcore ? "MODO HARDCORE ATIVO" : "MODO NORMAL"}
         </h2>
         <p className="text-slate-400 mb-8">
           {isHardcore 
             ? "Falhas punem o dobro de XP. A voz da IA é agressiva. Apenas para quem aguenta a pressão. O design reflete o estado de guerra."
             : "Equilíbrio entre vida e progresso. A IA é uma mentora. Falhas são oportunidades de aprendizado."
           }
         </p>
         
         <div className="flex items-center gap-4">
           <span className="text-sm font-bold text-slate-500">NORMAL</span>
           <button 
             onClick={toggleHardcore}
             className={`w-16 h-8 rounded-full p-1 transition-colors ${isHardcore ? 'bg-red-600' : 'bg-slate-700'}`}
           >
             <div className={`w-6 h-6 rounded-full bg-white shadow-lg transform transition-transform ${isHardcore ? 'translate-x-8' : 'translate-x-0'}`}></div>
           </button>
           <span className="text-sm font-bold text-red-500">HARDCORE</span>
         </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center">
         <h3 className="text-xs font-bold text-slate-500 mb-4">REALITY CHECK DIÁRIO</h3>
         <p className="text-2xl font-serif italic text-white">
           "A mediocridade é uma escolha que você está fazendo agora."
         </p>
      </div>
    </div>
  );
};

const ProfileView: React.FC<{ user: UserProfile, onUpdateUser: (u: Partial<UserProfile>) => void, accentColor: string }> = ({ user, onUpdateUser, accentColor }) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setHasChanges(name !== user.name || email !== user.email);
  }, [name, email, user]);

  const handleSave = () => {
    onUpdateUser({ name, email });
    setHasChanges(false);
  };

  const isThemeUnlocked = (key: string) => {
    if (key === 'emerald') return true;
    if (key === 'rose' && user.isHardcore) return true;
    const inventory = user.inventory || [];
    return inventory.includes(`theme_${key}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-6 mb-8">
          <div className={`w-20 h-20 rounded-full ${accentColor} flex items-center justify-center text-black font-bold text-3xl shadow-xl`}>
             {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{user.name}</h2>
            <p className="text-slate-400">{user.email}</p>
            <div className={`inline-block px-3 py-1 rounded text-xs font-bold mt-2 ${user.isHardcore ? 'bg-red-900/20 text-red-500' : 'bg-emerald-900/20 text-emerald-500'}`}>
              {user.isHardcore ? 'HARDCORE AGENT' : 'STANDARD AGENT'}
            </div>
          </div>
        </div>

        <div className="space-y-6">
           <div>
             <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2"><Palette size={16} /> PERSONALIZAÇÃO DE INTERFACE</h3>
             <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
                {Object.entries(THEMES).map(([key, theme]) => {
                  const unlocked = isThemeUnlocked(key);
                  return (
                    <button
                      key={key}
                      onClick={() => unlocked && onUpdateUser({ themeColor: key })}
                      className={`h-12 rounded-xl transition-all relative group flex items-center justify-center
                        ${theme.bg} 
                        ${user.themeColor === key ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : ''}
                        ${!unlocked ? 'opacity-30 cursor-not-allowed grayscale' : 'hover:scale-105 opacity-70 hover:opacity-100'}
                      `}
                      title={unlocked ? theme.name : `Bloqueado: ${theme.name}`}
                    >
                      {user.themeColor === key && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CheckCircle2 size={20} className="text-black" />
                        </div>
                      )}
                      {!unlocked && (
                         <Lock size={16} className="text-black/50" />
                      )}
                    </button>
                  );
                })}
             </div>
             <p className="text-xs text-slate-500 mt-2">Novos temas disponíveis na Loja.</p>
           </div>

           <div className="h-px bg-slate-800"></div>

           <div>
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2"><Settings size={16} /> DADOS DA CONTA</h3>
                  {hasChanges && (
                      <button 
                        onClick={handleSave}
                        className={`text-xs ${accentColor} text-black font-bold px-3 py-1 rounded-lg hover:brightness-110 transition-all animate-pulse`}
                      >
                        SALVAR ALTERAÇÕES
                      </button>
                  )}
              </div>
              <div className="space-y-4">
                <div>
                   <label className="text-xs text-slate-500 block mb-1">CODINOME</label>
                   <input 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 outline-none transition-colors"
                   />
                </div>
                 <div>
                   <label className="text-xs text-slate-500 block mb-1">EMAIL DE ACESSO</label>
                   <input 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-slate-600 outline-none transition-colors"
                   />
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.MISSIONS);
  const [dailyBriefing, setDailyBriefing] = useState<string | null>(null);
  
  // State for visual feedback
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const refreshUser = () => {
    const currentUser = db.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      
      // Generate daily briefing if not already shown
      if (!dailyBriefing) {
        geminiService.generateDailyMotivation(currentUser).then(setDailyBriefing);
      }
    }
  };
  
  useEffect(() => {
    refreshUser();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateUser = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const oldLevel = user.level;
    const updated = db.updateUser(updates);
    
    if (updated) {
      setUser(updated);
      // Check for level up
      if (updated.level > oldLevel) {
        setShowLevelUp(true);
      }
    }
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
    setDailyBriefing(null);
  };

  const toggleHardcore = () => {
    if (user) {
      // If toggling to Hardcore, and user hasn't set a custom color (still using default), maybe switch to Rose?
      // For simplicity, we just toggle the mode. The user can customize color separately.
      handleUpdateUser({ isHardcore: !user.isHardcore });
    }
  };

  if (!user) {
    return <AuthScreen onLogin={refreshUser} />;
  }

  // Determine Colors based on User Preference
  const currentThemeKey = user.themeColor || (user.isHardcore ? 'rose' : 'emerald');
  const theme = THEMES[currentThemeKey] || THEMES.emerald;
  const accentColor = theme.bg;
  const accentText = theme.text;

  return (
    <div className={`min-h-screen bg-[#050511] font-sans selection:bg-emerald-500 selection:text-black overflow-hidden flex`}>
      {toastMessage && <ToastNotification message={toastMessage} accentColor={accentColor} />}
      {showLevelUp && <LevelUpModal level={user.level} onClose={() => setShowLevelUp(false)} accentColor={accentColor} />}

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        accentColor={accentColor}
        isHardcore={user.isHardcore}
      />
      
      <div className="flex-1 ml-64 flex flex-col h-screen">
        <TopBar user={user} accentColor={accentColor} accentText={accentText} />
        
        <main className="flex-1 overflow-y-auto p-8 relative">
          {/* Background Ambient Glow */}
          <div 
             className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[120px] rounded-full pointer-events-none -z-10 transition-colors duration-1000 opacity-10`}
             style={{ backgroundColor: theme.hex }}
          ></div>

          <div className="absolute top-4 right-4 z-20">
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-white rounded-full hover:bg-slate-800 transition-all" title="Logout">
              <LogOut size={20} />
            </button>
          </div>

          {dailyBriefing && activeTab === Tab.MISSIONS && (
            <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 bg-slate-950/20 border-slate-900/50`}>
               <BrainCircuit className={accentText} size={24} />
               <div>
                 <h4 className={`text-sm font-bold ${accentText} mb-1`}>IA DO QG</h4>
                 <p className="text-slate-300 italic text-sm">"{dailyBriefing}"</p>
               </div>
            </div>
          )}

          {activeTab === Tab.MISSIONS && (
            <MissionsView 
              user={user} 
              onUpdateUser={handleUpdateUser} 
              onShowToast={triggerToast}
              accentColor={accentColor}
            />
          )}

          {activeTab === Tab.CHAT && (
            <GeneralChatView 
              user={user}
              accentColor={accentColor}
            />
          )}
          
          {activeTab === Tab.TRAINING && (
            <TrainingView 
              accentColor={accentColor} 
              user={user} 
              onShowToast={triggerToast}
            />
          )}

          {activeTab === Tab.MARTIAL_ARTS && (
            <MartialArtsView 
              accentColor={accentColor} 
              user={user}
              onShowToast={triggerToast}
            />
          )}
          
          {activeTab === Tab.DIET && (
            <DietView 
              accentColor={accentColor} 
              onShowToast={triggerToast} 
            />
          )}
          
          {activeTab === Tab.TOOLS && <Tools accentColor={accentColor} />}
          {activeTab === Tab.PROGRESS && <StatsView user={user} accentColor={accentColor} />}
          {activeTab === Tab.LEADERBOARD && <LeaderboardView />}
          {activeTab === Tab.MOTIVATION && <MotivationView isHardcore={user.isHardcore} toggleHardcore={toggleHardcore} />}
          
          {activeTab === Tab.PROFILE && (
            <ProfileView user={user} onUpdateUser={handleUpdateUser} accentColor={accentColor} />
          )}

          {activeTab === Tab.SHOP && (
            <ShopView 
              user={user} 
              onUpdateUser={handleUpdateUser} 
              accentColor={accentColor} 
              onShowToast={triggerToast}
            />
          )}

        </main>
      </div>
    </div>
  );
};

export default App;