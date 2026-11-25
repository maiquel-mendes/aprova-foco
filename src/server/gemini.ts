import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface ExtractedQuestionItem {
  subject: string;
  topic: string;
  organ: string;
  difficulty: 'Fácil' | 'Média' | 'Difícil';
  questionType: 'multiple_choice' | 'true_false';
  statement: string;
  options: { key: string; text: string }[];
  correctOption: string;
  commentary: string;
}

export interface AdaptiveDiagnosisResult {
  summary: string;
  readinessScore: number;
  weakTopics: {
    subject: string;
    topic: string;
    accuracy: number;
    priority: 'Alta' | 'Média' | 'Monitorar';
    recommendation: string;
  }[];
  recommendedBlocks: {
    subject: string;
    focusType: 'Questões' | 'Revisão IA' | 'Simulado' | 'Teoria PDF';
    durationMinutes: number;
    reason: string;
  }[];
}

export async function extractQuestionsFromPdf(
  pdfBuffer: Buffer,
  metadata: {
    title: string;
    board: string;
    career: string;
    year: number;
  }
): Promise<ExtractedQuestionItem[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Chave de IA não configurada no servidor.');
  }

  const base64Pdf = pdfBuffer.toString('base64');

  const prompt = `Você é um professor especialista em concursos públicos brasileiros.
Analise o documento PDF anexado ("${metadata.title}", banca provável "${metadata.board}", carreira "${metadata.career}", ano ${metadata.year}).
Extraia até 15 questões reais contidas no PDF (ou, caso o arquivo seja um edital ou material teórico de estudo sem questões prontas, elabore até 8 questões inéditas estilo ${metadata.board} diretamente baseadas nos tópicos do material).
Para cada questão, forneça:
- subject (disciplina principal em português, ex.: Direito Constitucional, Língua Portuguesa, Direito Administrativo, Raciocínio Lógico, Direito Tributário, Direito Penal, Informática e TI, Conhecimentos Bancários)
- topic (assunto específico)
- organ (órgão do concurso ou nome da prova)
- difficulty ("Fácil", "Média" ou "Difícil")
- questionType ("multiple_choice" com alternativas A-D ou A-E, ou "true_false" com C=Certo e E=Errado para estilo Cebraspe)
- statement (enunciado completo e fiel)
- options (array de { key, text })
- correctOption (letra exata do gabarito: A, B, C, D, E)
- commentary (comentário didático objetivo explicando por que o gabarito está correto e por que as demais estão incorretas).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64Pdf,
          },
        },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            topic: { type: Type.STRING },
            organ: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            questionType: { type: Type.STRING },
            statement: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING },
                  text: { type: Type.STRING },
                },
                required: ['key', 'text'],
              },
            },
            correctOption: { type: Type.STRING },
            commentary: { type: Type.STRING },
          },
          required: [
            'subject',
            'topic',
            'organ',
            'difficulty',
            'questionType',
            'statement',
            'options',
            'correctOption',
            'commentary',
          ],
        },
      },
    },
  });

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as ExtractedQuestionItem[];
  return parsed.map((item) => ({
    ...item,
    difficulty:
      item.difficulty === 'Fácil' || item.difficulty === 'Difícil'
        ? item.difficulty
        : 'Média',
    questionType:
      item.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
  }));
}

export async function generateAdaptiveDiagnosis(payload: {
  profileName: string;
  career: string;
  targetBoard: string;
  subjectStats: {
    subject: string;
    total: number;
    correct: number;
    avgSeconds: number;
  }[];
  recentErrors: {
    subject: string;
    topic: string;
    board: string;
  }[];
}): Promise<AdaptiveDiagnosisResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Chave de IA não configurada no servidor.');
  }

  const prompt = `Atue como um mentor estratégico de concursos públicos com inteligência adaptativa.
Analise os dados reais de desempenho do candidato abaixo e produza um diagnóstico prático focado no edital alvo:
- Perfil ativo: ${payload.profileName}
- Carreira: ${payload.career}
- Banca alvo: ${payload.targetBoard}
- Desempenho por disciplina: ${JSON.stringify(payload.subjectStats)}
- Tópicos com erros recentes: ${JSON.stringify(payload.recentErrors)}

Retorne um JSON estruturado em português contendo:
1. summary: diagnóstico objetivo de 2 a 3 frases sobre os pontos fortes, gargalos de tempo/acerto e estratégia imediata.
2. readinessScore: número inteiro de 0 a 100 representando a prontidão atual estimada para o edital.
3. weakTopics: até 4 tópicos/disciplinas prioritárias com accuracy (0-100), priority ("Alta", "Média" ou "Monitorar") e recommendation (ação prática de revisão).
4. recommendedBlocks: 3 blocos de estudo sugeridos para a semana (subject, focusType entre "Questões", "Revisão IA", "Simulado", "Teoria PDF", durationMinutes entre 45 e 120, e reason).`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          readinessScore: { type: Type.INTEGER },
          weakTopics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                topic: { type: Type.STRING },
                accuracy: { type: Type.INTEGER },
                priority: { type: Type.STRING },
                recommendation: { type: Type.STRING },
              },
              required: [
                'subject',
                'topic',
                'accuracy',
                'priority',
                'recommendation',
              ],
            },
          },
          recommendedBlocks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                focusType: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                reason: { type: Type.STRING },
              },
              required: ['subject', 'focusType', 'durationMinutes', 'reason'],
            },
          },
        },
        required: [
          'summary',
          'readinessScore',
          'weakTopics',
          'recommendedBlocks',
        ],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text) as AdaptiveDiagnosisResult;
}

export async function generateQuestionTutorReply(payload: {
  statement: string;
  board: string;
  subject: string;
  correctOption: string;
  commentary: string;
  userQuestion: string;
}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Chave de IA não configurada no servidor.');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Banca: ${payload.board} | Disciplina: ${payload.subject}
Enunciado: ${payload.statement}
Gabarito oficial: ${payload.correctOption}
Comentário base: ${payload.commentary}

Dúvida do estudante: ${payload.userQuestion}

Responda de forma clara, didática e direta em português (máximo 180 palavras), citando o fundamento legal, doutrinário ou gramatical aplicável.`,
  });

  return (
    response.text?.trim() ||
    'Não foi possível gerar a explicação complementar neste momento.'
  );
}
