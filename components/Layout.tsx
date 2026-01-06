import React, { useEffect, useState } from 'react';
import { UserProfile, Tab } from '../types';
import { Target, Dumbbell, Utensils, PenTool, TrendingUp, ShoppingBag, User, Zap, Trophy, Flame, MessageSquare, Swords } from 'lucide-react';

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  accentColor: string;
  isHardcore: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, accentColor, isHardcore }) => {
  const menuItems = [
    { id: Tab.MISSIONS, label: 'Missões', icon: Target },
    { id: Tab.CHAT, label: 'Chat QG', icon: MessageSquare },
    { id: Tab.TRAINING, label: 'Treino', icon: Dumbbell },
    { id: Tab.MARTIAL_ARTS, label: 'Dojo (Luta)', icon: Swords },
    { id: Tab.DIET, label: 'Dieta', icon: Utensils },
    { id: Tab.TOOLS, label: 'Ferramentas', icon: PenTool },
    { id: Tab.PROGRESS, label: 'Progresso', icon: TrendingUp },
    { id: Tab.LEADERBOARD, label: 'Rank', icon: Trophy },
    { id: Tab.SHOP, label: 'Loja', icon: ShoppingBag },
    { id: Tab.PROFILE, label: 'Perfil', icon: User },
    { id: Tab.MOTIVATION, label: 'Motivação', icon: Zap },
  ];

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-900 h-screen flex flex-col p-4 fixed left-0 top-0 z-10">
      <div className="flex items-center gap-2 mb-10 px-2">
        <Flame className={isHardcore ? "text-red-500" : "text-orange-500"} fill="currentColor" />
        <h1 className="text-2xl font-bold tracking-tighter text-white">DISCIPLINA</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? `${accentColor} text-black font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]` 
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <item.icon size={20} className={isActive ? 'text-black' : 'text-slate-500 group-hover:text-white'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export const TopBar: React.FC<{ user: UserProfile; accentColor: string; accentText: string }> = ({ user, accentColor, accentText }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = (user.xp % 1000) / 10; // 0 to 100%

  return (
    <div className="h-20 bg-transparent border-b border-slate-900/50 flex items-center justify-between px-8 ml-64">
      <div className="flex items-center gap-4">
        <div className={`px-3 py-1 rounded bg-slate-800 ${accentText} text-xs font-bold border border-slate-700`}>
          NÍVEL {user.level}
        </div>
        <div className="px-3 py-1 rounded bg-orange-900/30 text-orange-500 text-xs font-bold border border-orange-900/50 flex items-center gap-2">
          <Flame size={12} fill="currentColor" /> {user.streak} DIAS
        </div>
        <div className="px-3 py-1 rounded bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">
          {time.toLocaleTimeString()}
        </div>
      </div>

      <div className="flex flex-col items-end w-64">
        <div className="text-slate-500 text-xs font-bold mb-1">{user.xp} XP</div>
        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${accentColor} transition-all duration-500`} 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-slate-600 text-[10px] mt-1">PRÓXIMO NÍVEL {user.xp % 1000}/1000</div>
      </div>
    </div>
  );
};