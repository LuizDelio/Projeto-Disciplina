import { Mission, Reward } from './types';

export const BASE_MISSIONS: Mission[] = [
  { id: 'wakeup', label: 'Acordar antes das 6h', points: 50 },
  { id: 'workout', label: 'Treino (45m+)', points: 100 },
  { id: 'water', label: 'Beber 3L de Água', points: 30 },
  { id: 'reading', label: 'Ler 10 Páginas', points: 40 },
  { id: 'diet', label: 'Dieta Limpa (Sem Açúcar)', points: 60 },
];

export const SUGGESTED_MISSIONS = [
  { label: 'Meditação (10m)', points: 30 },
  { label: 'Sem Redes Sociais', points: 80 },
  { label: 'Banho Gelado', points: 50 },
  { label: 'Jejum (16h)', points: 60 },
  { label: 'Estudo Focado (1h)', points: 70 },
  { label: 'Arrumar a Cama', points: 20 },
  { label: 'Journaling', points: 40 },
  { label: 'Sem Álcool', points: 50 },
  { label: 'Zero Telas (1h antes de dormir)', points: 60 },
  { label: 'Alongamento / Mobilidade', points: 30 },
  { label: 'Planejar o dia seguinte', points: 25 },
  { label: 'Caminhada ao Sol', points: 40 },
  { label: 'Agradecimento (3 coisas)', points: 20 },
];

export const REWARDS: Reward[] = [
  { id: 'cheat_meal', label: 'Refeição Livre', cost: 500, icon: '🍔' },
  { id: 'movie_night', label: 'Noite de Filme', cost: 300, icon: '🎬' },
  { id: 'day_off', label: 'Dia de Descanso', cost: 1000, icon: '🛌' },
  { id: 'buy_game', label: 'Comprar Jogo', cost: 2000, icon: '🎮' },
];

export const REALITY_CHECKS = [
  "Você cancelou porque foi difícil. A vida não vai facilitar.",
  "Disciplina é fazer o que você odeia, mas fazer como se amasse.",
  "Cada missão perdida é um voto para a pessoa que você não quer ser.",
  "Ninguém virá te salvar. Depende tudo de você.",
  "O conforto é o inimigo do progresso.",
  "Não negocie com você mesmo. A missão é absoluta.",
  "A mediocridade é uma escolha que você está fazendo agora.",
  "Sofra a dor da disciplina ou sofra a dor do arrependimento."
];