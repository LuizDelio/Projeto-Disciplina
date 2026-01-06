import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { TrainingPlan, DietPlan, UserProfile, MartialArtsPlan } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const trainingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    split: { type: Type.STRING },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          focus: { type: Type.STRING },
          exercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sets: { type: Type.STRING },
                reps: { type: Type.STRING },
                substitution: { type: Type.STRING, description: "A valid alternative exercise using different equipment or safer for injuries" },
                tip: { type: Type.STRING, description: "Short execution cue or safety warning" }
              }
            }
          }
        }
      }
    }
  }
};

const martialArtsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    style: { type: Type.STRING },
    focus: { type: Type.STRING },
    duration: { type: Type.STRING },
    warmup: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    rounds: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.INTEGER },
          name: { type: Type.STRING },
          duration: { type: Type.STRING },
          drills: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          focusPoint: { type: Type.STRING }
        }
      }
    },
    cooldown: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    }
  }
};

const dietSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    calories: { type: Type.NUMBER },
    meals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }
    }
  }
};

export const geminiService = {
  async generateTrainingPlan(
    goal: string, 
    level: string, 
    days: string, 
    duration: string, 
    equipment: string, 
    focusArea: string, 
    injuries: string
  ): Promise<TrainingPlan | null> {
    try {
      const prompt = `
        Atue como um treinador de elite. Crie um plano de treino detalhado em PORTUGUÊS.
        
        Parâmetros do Usuário:
        - Objetivo: ${goal}
        - Nível: ${level}
        - Frequência: ${days} dias/semana
        - Duração Máxima: ${duration} minutos
        - Equipamento: ${equipment}
        - Foco: ${focusArea || 'Geral'}
        - Lesões/Limitações: ${injuries || 'Nenhuma'}

        Regras Críticas:
        1. Respeite o tempo limite.
        2. Se houver lesões, NÃO inclua exercícios que as agravem.
        3. Para CADA exercício, forneça uma 'substitution' (alternativa) caso a pessoa não tenha o equipamento ou sinta dor.
        4. Para CADA exercício, forneça uma 'tip' (dica curta) de execução ou segurança.
        5. Retorne APENAS o JSON.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: trainingSchema
        }
      });
      
      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as TrainingPlan;
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  },

  async generateMartialArtsPlan(
    style: string,
    level: string,
    duration: string,
    equipment: string,
    focus: string
  ): Promise<MartialArtsPlan | null> {
    try {
      const prompt = `
        Atue como um Grande Mestre (Sensei/Kru/Mestre). Crie um treino de artes marciais em PORTUGUÊS.
        
        Parâmetros:
        - Estilo: ${style} (Ex: Boxe, Muay Thai, Karate, Jiu Jitsu, MMA)
        - Nível: ${level}
        - Duração: ${duration} minutos
        - Equipamento Disponível: ${equipment} (Ex: Sombra/Nada, Saco de Pancada, Manopla, Boneco)
        - Foco do Treino: ${focus} (Ex: Técnica Pura, Cardio/Conditioning, Sparring, Reflexos)

        Estrutura Obrigatória:
        1. Aquecimento específico para o estilo.
        2. Rounds estruturados (Ex: 3 minutos com 1 de descanso).
        3. Drills (combinações de golpes) que façam sentido tecnicamente.
        4. Resfriamento/Alongamento.
        
        Se o equipamento for "Sombra" (Shadowboxing), foque na movimentação e visualização.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: martialArtsSchema
        }
      });

      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as MartialArtsPlan;
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  },

  async generateDietPlan(goal: string, likes: string, pantry: string, budget: string, additionalInfo: string): Promise<DietPlan | null> {
    try {
      const prompt = `
        Atue como um nutricionista esportivo focado em resultados. Crie um plano alimentar diário (1 dia exemplo) em PORTUGUÊS.
        
        Perfil do Aluno:
        - Objetivo Principal: ${goal}
        - Detalhes Específicos/Metas (Muito Importante): ${additionalInfo || 'Nenhum detalhe extra'}
        - Preferências Alimentares: ${likes}
        - Itens na Despensa (Priorizar uso): ${pantry}
        - Restrição Orçamentária: ${budget ? `Máximo de R$ ${budget}` : 'Econômico/Custo-benefício'}
        
        Requisitos:
        1. Calcule as calorias aproximadas considerando o objetivo e os detalhes extras (ex: se pediu para perder 20kg, faça um déficit calórico agressivo mas seguro).
        2. Priorize alimentos que o usuário já tem.
        3. Se o orçamento for baixo, use fontes de proteína baratas (ovos, frango, soja).
        4. Inclua quantidades (gramas/colheres) para cada item.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: dietSchema
        }
      });

      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as DietPlan;
    } catch (error) {
      console.error("Gemini Error:", error);
      return null;
    }
  },

  async chatWithCoach(input: string | { audioData: string, mimeType: string }, user: UserProfile): Promise<string> {
    try {
      // Serialize user data for deep analysis
      const userDataJSON = JSON.stringify({
        name: user.name,
        level: user.level,
        xp: user.xp,
        streak: user.streak,
        stats: user.stats,
        history: user.history.slice(-10), // Last 10 actions for context
        mode: user.isHardcore ? 'HARDCORE' : 'NORMAL'
      });

      const context = `
        VOCÊ É A IA CENTRAL (CEREBRO) DO APP 'DISCIPLINA AI'.
        
        SOBRE O USUÁRIO (Analise estes dados para responder):
        ${userDataJSON}

        SOBRE O APP:
        - Missões: Dão XP. Diárias ou únicas.
        - Treino: IA gera treinos personalizados.
        - Artes Marciais (Dojo): Treinos de luta técnicos.
        - Dieta: IA gera receitas com o que tem na despensa.
        - Ferramentas: Pomodoro, Cronômetro, Alarmes.
        - Rank: Competição global.
        - Modos: Normal (Mentoria Estoica) ou Hardcore (Militar/Agressivo).

        SUA PERSONA:
        ${user.isHardcore 
          ? "Modo: HARDCORE. Você é um sargento militar, agressivo, exigente e impiedoso. Use CAIXA ALTA para enfatizar. Insulte a fraqueza, elogie APENAS a força extrema. O usuário é um recruta." 
          : "Modo: NORMAL. Você é um mentor sábio, estoico e calmo (Estilo Marco Aurélio). Foco na consistência e clareza mental. Seja firme, mas encorajador."
        }
        
        INSTRUÇÕES:
        1. Responda perguntas sobre o app ou sobre o progresso do usuário.
        2. Se o usuário perguntar "como estou?", analise o histórico, XP e streak dele.
        3. Se receber áudio, transcreva mentalmente e responda em texto.
        4. Mantenha as respostas concisas (máximo 3 parágrafos curtos).
        5. Formate com Markdown.
      `;

      let parts: any[] = [];
      
      if (typeof input === 'string') {
        parts.push({ text: input });
      } else {
        parts.push({
          inlineData: {
            mimeType: input.mimeType,
            data: input.audioData
          }
        });
        parts.push({ text: "Analise este áudio e responda conforme as instruções da persona." });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Capable of handling audio input
        contents: [{ parts }],
        config: {
          systemInstruction: context
        }
      });
      
      return response.text || "Sem resposta.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Erro de conexão neural. Tente novamente.";
    }
  },

  async generateDailyMotivation(user: UserProfile): Promise<string> {
    try {
      const prompt = `Generate a short, punchy daily briefing for the user in Portuguese. 
      Context: User ${user.name} is on a ${user.streak} day streak. Level ${user.level}. Mode: ${user.isHardcore ? 'Hardcore' : 'Normal'}.
      Tone: ${user.isHardcore ? 'Aggressive, challenging, militaristic' : 'Stoic, inspiring, focused'}.
      Max length: 2 sentences.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || "Mantenha o foco.";
    } catch (e) {
      return "A disciplina é a ponte entre metas e conquistas.";
    }
  },

  async generateSpeech(text: string, isHardcore: boolean): Promise<string | null> {
    try {
      // Clean up markdown for better speech
      const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

      const voiceName = isHardcore ? 'Kore' : 'Puck';

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  }
};