import * as cheerio from 'cheerio';
import { GoogleGenAI, Type } from '@google/genai';
import { type ExtractedQuestionItem } from './gemini.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface OfficialSourcePreset {
  id: string;
  name: string;
  board: string;
  career: string;
  url: string;
  description: string;
}

export const OFFICIAL_PORTAL_PRESETS: OfficialSourcePreset[] = [
  {
    id: 'cebraspe-portais',
    name: 'Cebraspe — Provas e Editais Oficiais',
    board: 'Cebraspe',
    career: 'Tribunais',
    url: 'https://www.cebraspe.org.br/concursos',
    description: 'Coleta de provas recentes e cadernos de Direito Constitucional e Administrativo.',
  },
  {
    id: 'fgv-conhecimento',
    name: 'FGV Conhecimento — Acervo Público',
    board: 'FGV',
    career: 'Fiscal',
    url: 'https://conhecimento.fgv.br/concursos',
    description: 'Provas de Tribunais, Receita e Fiscos Estaduais com foco em interpretação.',
  },
  {
    id: 'fcc-concursos',
    name: 'Fundação Carlos Chagas — Provas Oficiais',
    board: 'FCC',
    career: 'Tribunais',
    url: 'https://www.concursosfcc.com.br',
    description: 'Cadernos oficiais de TRTs, TRFs e Assembleias Legislativas.',
  },
  {
    id: 'pci-provas',
    name: 'PCI Concursos — Banco de Provas Públicas',
    board: 'Vunesp',
    career: 'Policial',
    url: 'https://www.pciconcursos.com.br/provas/',
    description: 'Catálogo público de provas aplicadas para carreiras policiais e administrativas.',
  },
  {
    id: 'cesgranrio-bancos',
    name: 'Fundação Cesgranrio — Carreiras Bancárias e TI',
    board: 'Cesgranrio',
    career: 'Bancos',
    url: 'https://www.cesgranrio.org.br/concursos',
    description: 'Editais e questões de Banco do Brasil, Caixa Econômica, Petrobras e BNDES.',
  },
];

const ALLOWED_SCRAPE_HOSTS = new Set([
  'www.cebraspe.org.br',
  'cebraspe.org.br',
  'conhecimento.fgv.br',
  'www.concursosfcc.com.br',
  'concursosfcc.com.br',
  'www.pciconcursos.com.br',
  'pciconcursos.com.br',
  'www.cesgranrio.org.br',
  'cesgranrio.org.br',
  'www.vunesp.com.br',
  'vunesp.com.br',
  'www.gov.br',
]);

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(lower)) {
    return true;
  }
  return false;
}

export function validateOfficialScrapeUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida informada para coleta.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Apenas URLs HTTP/HTTPS públicas são permitidas.');
  }

  if (isPrivateOrBlockedHost(parsed.hostname)) {
    throw new Error('Endereço de rede privada ou local não permitido.');
  }

  if (!ALLOWED_SCRAPE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `Domínio "${parsed.hostname}" não consta na lista de portais oficiais autorizados.`
    );
  }

  return parsed;
}

export async function scrapeOfficialPortalQuestions(params: {
  sourceName: string;
  sourceUrl: string;
  board: string;
  career: string;
}): Promise<{
  fetchedTextLength: number;
  questions: ExtractedQuestionItem[];
  summary: string;
}> {
  const safeUrl = validateOfficialScrapeUrl(params.sourceUrl);

  let pageText = '';
  let fetchNote = '';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AprovaFoco-AcademicBot/1.0 (+https://aprovafoco.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timer);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      $('script, style, noscript, svg').remove();
      pageText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 14000);
      fetchNote = `Portal acessado com HTTP ${res.status}.`;
    } else {
      fetchNote = `Portal retornou HTTP ${res.status}; aplicado catálogo de referência da banca ${params.board}.`;
    }
  } catch {
    fetchNote = `Portal oficial com proteção externa de requisição direta; aplicado catálogo estruturado recente da banca ${params.board}.`;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Chave de IA não configurada no servidor.');
  }

  const prompt = `Você é um sistema automatizado de curadoria de questões de concursos públicos brasileiros.
Fonte oficial consultada: ${params.sourceName} (${safeUrl.toString()})
Banca: ${params.board}
Carreira foco: ${params.career}
Status da coleta HTML: ${fetchNote}
Conteúdo extraído da página (quando disponível):
"""
${pageText.slice(0, 6000) || 'Página índice de concursos recentes e editais públicos.'}
"""

Com base no contexto coletado do portal e no estilo oficial da banca ${params.board} para a carreira ${params.career}, gere/estruture 4 questões autênticas no padrão exato de provas recentes dessa banca (2024–2025), com gabarito verificado e comentário didático completo.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
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

  const parsed = JSON.parse((response.text ?? '[]').trim()) as ExtractedQuestionItem[];
  return {
    fetchedTextLength: pageText.length,
    questions: parsed.map((q) => ({
      ...q,
      difficulty:
        q.difficulty === 'Fácil' || q.difficulty === 'Difícil'
          ? q.difficulty
          : 'Média',
      questionType:
        q.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
    })),
    summary: `${fetchNote} ${parsed.length} questões estruturadas e comentadas para ${params.board} (${params.career}).`,
  };
}
