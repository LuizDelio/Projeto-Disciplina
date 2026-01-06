import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock, Timer, Watch } from 'lucide-react';

export const Tools: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const [activeTool, setActiveTool] = useState<'pomodoro' | 'stopwatch' | 'alarms'>('pomodoro');

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex bg-slate-900 p-1 rounded-lg self-center border border-slate-800">
        <button 
          onClick={() => setActiveTool('pomodoro')}
          className={`px-6 py-2 rounded-md font-bold transition-all ${activeTool === 'pomodoro' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          POMODORO
        </button>
        <button 
          onClick={() => setActiveTool('alarms')}
          className={`px-6 py-2 rounded-md font-bold transition-all ${activeTool === 'alarms' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          ALARMES
        </button>
        <button 
          onClick={() => setActiveTool('stopwatch')}
          className={`px-6 py-2 rounded-md font-bold transition-all ${activeTool === 'stopwatch' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
        >
          CRONÔMETRO
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        {activeTool === 'pomodoro' && <Pomodoro accentColor={accentColor} />}
        {activeTool === 'stopwatch' && <Stopwatch accentColor={accentColor} />}
        {activeTool === 'alarms' && <Alarms accentColor={accentColor} />}
      </div>
    </div>
  );
};

const Pomodoro: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');

  // Sound Notification Helper
  const playTimerSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      
      const playBeep = (startTime: number, freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.1, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);
        
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      };

      // Play a sequence: High - High - High (Success/Alert style)
      playBeep(ctx.currentTime, 880);       // A5
      playBeep(ctx.currentTime + 0.4, 880); // A5
      playBeep(ctx.currentTime + 0.8, 1760); // A6
      
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isRunning) {
      // Timer finished just now
      setIsRunning(false);
      playTimerSound();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const setTimerMode = (m: 'focus' | 'short' | 'long') => {
    setMode(m);
    setIsRunning(false);
    if (m === 'focus') setTimeLeft(25 * 60);
    if (m === 'short') setTimeLeft(5 * 60);
    if (m === 'long') setTimeLeft(15 * 60);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-10 rounded-2xl w-full max-w-2xl text-center shadow-2xl relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${accentColor}`}></div>
      
      <div className="text-8xl font-mono font-bold tracking-widest mb-10 text-white">
        {formatTime(timeLeft)}
      </div>

      <div className="flex justify-center gap-4 mb-10">
        <button onClick={() => setTimerMode('focus')} className={`px-4 py-1 rounded-full text-sm font-bold ${mode === 'focus' ? accentColor + ' text-black' : 'bg-slate-800 text-slate-400'}`}>FOCO</button>
        <button onClick={() => setTimerMode('short')} className={`px-4 py-1 rounded-full text-sm font-bold ${mode === 'short' ? accentColor + ' text-black' : 'bg-slate-800 text-slate-400'}`}>PAUSA CURTA</button>
        <button onClick={() => setTimerMode('long')} className={`px-4 py-1 rounded-full text-sm font-bold ${mode === 'long' ? accentColor + ' text-black' : 'bg-slate-800 text-slate-400'}`}>PAUSA LONGA</button>
      </div>

      <div className="flex justify-center gap-6">
        <button onClick={() => setIsRunning(!isRunning)} className="bg-white hover:bg-slate-200 text-black p-6 rounded-full transition-all">
          {isRunning ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
        </button>
        <button onClick={() => setTimerMode(mode)} className="bg-slate-800 hover:bg-slate-700 text-white p-6 rounded-full transition-all">
          <RotateCcw size={32} />
        </button>
      </div>
    </div>
  );
};

const Stopwatch: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isRunning) {
      interval = setInterval(() => setTime((prev) => prev + 10), 10);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const cs = Math.floor((ms % 1000) / 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-10 rounded-2xl w-full max-w-2xl text-center shadow-2xl relative">
       <div className={`absolute top-0 left-0 w-full h-1 ${accentColor}`}></div>
      <div className="text-8xl font-mono font-bold tracking-widest mb-10 text-white">
        {formatTime(time)}
      </div>
      <div className="flex justify-center gap-6">
        <button onClick={() => setIsRunning(!isRunning)} className={`${accentColor} hover:brightness-110 text-black p-6 rounded-full transition-all`}>
          {isRunning ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
        </button>
        <button onClick={() => { setIsRunning(false); setTime(0); }} className="bg-slate-800 hover:bg-slate-700 text-white p-6 rounded-full transition-all">
          <RotateCcw size={32} />
        </button>
      </div>
    </div>
  );
};

const Alarms: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  return (
    <div className="w-full max-w-2xl">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between mb-4">
        <div className="text-4xl font-mono text-slate-400">--:--</div>
        <button className={`${accentColor} text-black p-3 rounded-lg hover:brightness-110`}>
          <Clock size={24} />
        </button>
      </div>
      <p className="text-center text-slate-500 mt-4">Nenhum alarme configurado.</p>
    </div>
  );
};