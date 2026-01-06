import { UserProfile, LeaderboardEntry, Mission, ActivityLog } from '../types';

const DB_KEY = 'disciplina_db_v2';
const CURRENT_USER_ID_KEY = 'disciplina_current_user_id';

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { name: 'CyberRonin', level: 42, streak: 120, mode: 'Hardcore' },
  { name: 'IronWill', level: 35, streak: 89, mode: 'Normal' },
  { name: 'NightOwl', level: 28, streak: 45, mode: 'Normal' },
  { name: 'GigaChad_AI', level: 99, streak: 365, mode: 'Hardcore' },
];

const INITIAL_MISSIONS: Mission[] = [
  { id: '1', title: 'Acordar antes das 6h', xp: 50, completed: false, type: 'daily' },
  { id: '2', title: 'Treino (45m+)', xp: 100, completed: false, type: 'daily' },
  { id: '3', title: 'Beber 3L de Água', xp: 30, completed: false, type: 'daily' },
  { id: '4', title: 'Ler 10 Páginas', xp: 40, completed: false, type: 'daily' },
  { id: '5', title: 'Dieta Limpa (Sem Açúcar)', xp: 60, completed: false, type: 'daily' },
];

class DatabaseService {
  private getUsers(): Record<string, UserProfile> {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveUsers(users: Record<string, UserProfile>) {
    localStorage.setItem(DB_KEY, JSON.stringify(users));
  }

  register(email: string, name: string, password?: string, birthDate?: string, provider: 'email' | 'google' = 'email'): UserProfile {
    const users = this.getUsers();
    
    // Check if exists
    const existing = Object.values(users).find(u => u.email === email);
    if (existing) {
      throw new Error("Usuário já existe.");
    }

    const id = Date.now().toString();
    const newUser: UserProfile = {
      id,
      name: name || 'Recruta',
      email,
      password, // In a real app, this must be hashed
      provider,
      birthDate,
      level: 1,
      xp: 0,
      streak: 0,
      coins: 0,
      lastLogin: new Date().toISOString(),
      isHardcore: false,
      themeColor: 'emerald', // Default theme
      inventory: [],
      stats: { strength: 1, discipline: 1, intelligence: 1 },
      history: [{
        id: Date.now().toString(),
        date: new Date().toISOString(),
        type: 'login',
        xpEarned: 0
      }]
    };

    users[id] = newUser;
    this.saveUsers(users);
    localStorage.setItem(CURRENT_USER_ID_KEY, id);
    return newUser;
  }

  login(email: string, password?: string, isGoogle = false): UserProfile {
    const users = this.getUsers();
    const user = Object.values(users).find(u => u.email === email);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    if (!isGoogle && user.password !== password) {
      throw new Error("Senha incorreta.");
    }

    // Update login stats
    const lastLogin = new Date(user.lastLogin);
    const today = new Date();
    
    // Reset time components for date comparison
    const lastDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
    const currDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const diffTime = Math.abs(currDate.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays === 1) {
      user.streak += 1;
    } else if (diffDays > 1) {
      user.streak = 0; // Reset streak if missed a day
    }
    // If diffDays === 0, same day, do nothing to streak

    user.lastLogin = new Date().toISOString();
    user.history.push({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: 'login',
      xpEarned: 0
    });

    // Backwards compatibility for older users without themeColor
    if (!user.themeColor) {
      user.themeColor = user.isHardcore ? 'rose' : 'emerald';
    }
    // Backwards compatibility for inventory and coins
    if (!user.inventory) user.inventory = [];
    if (user.coins === undefined) user.coins = 0;

    users[user.id] = user;
    this.saveUsers(users);
    localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
    return user;
  }

  getCurrentUser(): UserProfile | null {
    const id = localStorage.getItem(CURRENT_USER_ID_KEY);
    if (!id) return null;
    const users = this.getUsers();
    const user = users[id];
    
    if (user) {
      // Polyfill missing fields for safety
      if (!user.inventory) user.inventory = [];
      if (user.coins === undefined) user.coins = 0;
      if (!user.themeColor) user.themeColor = user.isHardcore ? 'rose' : 'emerald';
    }
    
    return user || null;
  }

  logout() {
    localStorage.removeItem(CURRENT_USER_ID_KEY);
  }

  updateUser(updates: Partial<UserProfile>): UserProfile | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    const users = this.getUsers();
    const updatedUser = { ...user, ...updates };
    
    // Level up logic
    const xpToNextLevel = updatedUser.level * 1000;
    if (updatedUser.xp >= xpToNextLevel) {
      updatedUser.level += 1;
      updatedUser.xp -= xpToNextLevel;
      updatedUser.stats.discipline += 1; 
      // Log level up?
    }

    users[user.id] = updatedUser;
    this.saveUsers(users);
    return updatedUser;
  }

  logActivity(type: ActivityLog['type'], xp: number, details?: string) {
    const user = this.getCurrentUser();
    if (!user) return;
    
    const users = this.getUsers();
    user.history.push({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type,
      xpEarned: xp,
      details
    });
    
    users[user.id] = user;
    this.saveUsers(users);
  }

  getLeaderboard(): LeaderboardEntry[] {
    const users = Object.values(this.getUsers()).map(u => ({
      name: u.name,
      level: u.level,
      streak: u.streak,
      mode: u.isHardcore ? 'Hardcore' : 'Normal'
    } as LeaderboardEntry));

    // Combine mock and real, sort by level desc, then streak desc
    const all = [...MOCK_LEADERBOARD, ...users];
    return all.sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return b.streak - a.streak;
    }).slice(0, 10);
  }

  getMissions(userId: string): Mission[] {
    const key = `missions_${userId}_${new Date().toDateString()}`;
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    
    // If no missions for today, return defaults
    return INITIAL_MISSIONS.map(m => ({...m}));
  }

  saveMissions(userId: string, missions: Mission[]) {
    const key = `missions_${userId}_${new Date().toDateString()}`;
    localStorage.setItem(key, JSON.stringify(missions));
  }
}

export const db = new DatabaseService();