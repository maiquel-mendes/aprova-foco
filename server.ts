import 'dotenv/config';
import http from 'http';
import path from 'path';
import express from 'express';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { AuthRequest, requireAuth } from './src/middleware/auth.ts';
import {
  extractQuestionsFromPdf,
  generateAdaptiveDiagnosis,
  generateQuestionTutorReply,
} from './src/server/gemini.ts';
import {
  OFFICIAL_PORTAL_PRESETS,
  scrapeOfficialPortalQuestions,
} from './src/server/scraper.ts';

const app = express();
app.use(express.json({ limit: '4mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são suportados.'));
    }
  },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aprovafoco-api' });
});

app.post(
  '/api/pdfs/extract',
  requireAuth,
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Selecione um arquivo PDF.' });
      }

      const title =
        String(req.body?.title || '').trim() ||
        req.file.originalname.replace(/\.pdf$/i, '');
      const board = String(req.body?.board || 'FGV');
      const career = String(req.body?.career || 'Tribunais');
      const year = Number(req.body?.year) || new Date().getFullYear();

      const extracted = await extractQuestionsFromPdf(req.file.buffer, {
        title,
        board,
        career,
        year,
      });

      res.json({
        fileName: req.file.originalname,
        title,
        board,
        career,
        year,
        extracted,
      });
    } catch (error: any) {
      console.error('PDF extraction failed:', error);
      res.status(500).json({
        error:
          error?.message ||
          'Falha ao processar PDF com IA. Verifique o arquivo e tente novamente.',
      });
    }
  }
);

app.get('/api/scraper/sources', requireAuth, (_req, res) => {
  res.json({ sources: OFFICIAL_PORTAL_PRESETS });
});

app.post('/api/scraper/run', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sourceName, sourceUrl, board, career } = req.body ?? {};
    if (!sourceUrl || !board || !career) {
      return res
        .status(400)
        .json({ error: 'Informe URL oficial, banca e carreira.' });
    }

    const result = await scrapeOfficialPortalQuestions({
      sourceName: String(sourceName || 'Portal Oficial'),
      sourceUrl: String(sourceUrl),
      board: String(board),
      career: String(career),
    });

    res.json({
      sourceName: String(sourceName || 'Portal Oficial'),
      sourceUrl: String(sourceUrl),
      board: String(board),
      career: String(career),
      summary: result.summary,
      questions: result.questions,
    });
  } catch (error: any) {
    console.error('Scrape job failed:', error);
    res.status(400).json({
      error: error?.message || 'Não foi possível concluir a coleta oficial.',
    });
  }
});

app.post('/api/ai/adaptive-plan', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      profileName = 'Preparação Geral',
      career = 'Tribunais',
      targetBoard = 'FGV',
      subjectStats = [],
      recentErrors = [],
    } = req.body ?? {};

    const diagnosis = await generateAdaptiveDiagnosis({
      profileName: String(profileName),
      career: String(career),
      targetBoard: String(targetBoard),
      subjectStats: Array.isArray(subjectStats) ? subjectStats : [],
      recentErrors: Array.isArray(recentErrors) ? recentErrors : [],
    });

    res.json({ diagnosis });
  } catch (error: any) {
    console.error('Adaptive AI failed:', error);
    res.status(500).json({
      error:
        error?.message || 'Erro ao gerar diagnóstico adaptativo com IA.',
    });
  }
});

app.post(
  '/api/ai/explain-question',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const {
        statement,
        board,
        subject,
        correctOption,
        commentary,
        userQuestion,
      } = req.body ?? {};

      if (!statement || !correctOption) {
        return res.status(400).json({ error: 'Dados da questão ausentes.' });
      }

      const reply = await generateQuestionTutorReply({
        statement: String(statement),
        board: String(board || 'FGV'),
        subject: String(subject || 'Geral'),
        correctOption: String(correctOption),
        commentary: String(commentary || ''),
        userQuestion: String(
          userQuestion || 'Explique os detalhes deste gabarito.'
        ),
      });
      res.json({ reply });
    } catch (error: any) {
      console.error('Tutor AI failed:', error);
      res
        .status(500)
        .json({ error: error?.message || 'Erro ao consultar tutor IA.' });
    }
  }
);

const server = http.createServer(app);

interface ChatClientMeta {
  ws: WebSocket;
  room: string;
  uid?: string;
  displayName?: string;
  level?: number;
}

const wsClients = new Set<ChatClientMeta>();

function broadcastWsEvent(type: string, payload: unknown, room?: string) {
  const frame = JSON.stringify({ type, payload });
  for (const client of wsClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!room || client.room === room) {
        client.ws.send(frame);
      }
    }
  }
}

function broadcastPresence(room: string) {
  const onlineInRoom = Array.from(wsClients)
    .filter((c) => c.room === room && c.displayName)
    .map((c) => ({ name: c.displayName, level: c.level || 1 }));
  broadcastWsEvent('presence:update', { room, users: onlineInRoom }, room);
}

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const pathname = new URL(
      request.url || '/',
      'http://localhost:3000'
    ).pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  } catch {
    socket.destroy();
  }
});

wss.on('connection', async (ws, req) => {
  const url = new URL(req.url || '/ws', 'http://localhost:3000');
  const room = url.searchParams.get('room') || 'geral';
  const token = url.searchParams.get('token');
  const levelParam = Number(url.searchParams.get('level')) || 1;
  const nameParam = url.searchParams.get('name');

  const meta: ChatClientMeta = { ws, room };

  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      meta.uid = decoded.uid;
      meta.displayName =
        nameParam?.trim() ||
        decoded.name ||
        decoded.email?.split('@')[0] ||
        'Estudante';
      meta.level = Math.max(1, Math.min(1000, levelParam));
    } catch {
      // Unauthenticated WS client stays read-only
    }
  }

  wsClients.add(meta);
  broadcastPresence(meta.room);

  ws.on('message', (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === 'room:switch' && typeof parsed.room === 'string') {
        const oldRoom = meta.room;
        meta.room = parsed.room;
        broadcastPresence(oldRoom);
        broadcastPresence(meta.room);
        return;
      }

      if (parsed.type === 'chat:send' && meta.uid && parsed.message) {
        const cleanMsg = String(parsed.message).trim().slice(0, 800);
        if (!cleanMsg) return;

        const payload = {
          id: String(parsed.id || `${Date.now()}`),
          room: meta.room,
          authorName: String(
            parsed.authorName || meta.displayName || 'Estudante'
          ).slice(0, 60),
          authorLevel: Number(parsed.authorLevel || meta.level || 1),
          message: cleanMsg,
          createdAt: String(parsed.createdAt || new Date().toISOString()),
        };

        broadcastWsEvent('chat:new', payload, meta.room);
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    wsClients.delete(meta);
    broadcastPresence(meta.room);
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(3000, '0.0.0.0', () => {
    console.log('AprovaFoco server running on http://0.0.0.0:3000');
  });
}

startServer();
