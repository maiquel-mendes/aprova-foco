import { eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { AuthRequest, requireAuth, requireRole } from '../../middleware/auth.ts';
import type { UserRole } from '../../types.ts';
import {
  hashPassword,
  signLocalBearerToken,
  verifyPassword,
} from '../auth/localJwt.ts';
import { getPgDb, isPostgresDriver } from '../db/client.ts';
import { usersTable } from '../db/schema.ts';
import { getPostgresServerRepositories } from '../repositories/PostgresRepository.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROOMS = new Set([
  'geral',
  'tribunais',
  'fiscal',
  'policial',
  'bancos-ti',
]);

export function createV1Router(): Router {
  const router = Router();
  const repos = getPostgresServerRepositories();

  router.use((_req, res, next) => {
    if (!isPostgresDriver()) {
      return res.status(503).json({
        error:
          'A API /api/v1 está disponível apenas quando DATA_DRIVER=postgres está ativo.',
      });
    }
    next();
  });

  // --- Auth Routes (Local/Self-Hosted Postgres Mode) ---
  router.post('/auth/register', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const displayName = String(req.body?.displayName || '').trim();

      if (!EMAIL_REGEX.test(email) || email.length > 160) {
        return res.status(400).json({ error: 'Informe um e-mail válido.' });
      }
      if (password.length < 8 || password.length > 128) {
        return res
          .status(400)
          .json({ error: 'A senha deve ter entre 8 e 128 caracteres.' });
      }

      const db = getPgDb();
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);
      if (existing.length > 0) {
        return res
          .status(409)
          .json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
      }

      const [{ userCount }] = await db
        .select({ userCount: sql<number>`count(*)::int` })
        .from(usersTable);

      const bootstrapEmail = (
        process.env.BOOTSTRAP_ADMIN_EMAIL || 'maiquelbsb@gmail.com'
      ).toLowerCase();
      const assignedRole: UserRole =
        userCount === 0 || email === bootstrapEmail ? 'admin' : 'user';

      const cleanName =
        displayName.length >= 2 && displayName.length <= 60
          ? displayName
          : email.split('@')[0].slice(0, 60);

      const [created] = await db
        .insert(usersTable)
        .values({
          email,
          passwordHash: hashPassword(password),
          displayName: cleanName,
          role: assignedRole,
          lastStudyDate: new Date().toISOString().slice(0, 10),
        })
        .returning();

      const token = signLocalBearerToken({
        uid: created.id,
        email: created.email,
        role: assignedRole,
      });

      res.status(201).json({
        token,
        user: {
          uid: created.id,
          email: created.email,
          displayName: created.displayName,
          photoURL: created.avatarUrl,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao criar conta.' });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');

      if (!EMAIL_REGEX.test(email) || !password) {
        return res.status(400).json({ error: 'E-mail e senha inválidos.' });
      }

      const db = getPgDb();
      const [found] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1);

      if (!found || !verifyPassword(password, found.passwordHash)) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      const token = signLocalBearerToken({
        uid: found.id,
        email: found.email,
        role: (found.role as UserRole) || 'user',
      });

      res.json({
        token,
        user: {
          uid: found.id,
          email: found.email,
          displayName: found.displayName,
          photoURL: found.avatarUrl,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao autenticar.' });
    }
  });

  // --- Workspace & Profile ---
  router.get('/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const targetUid =
        req.user!.role === 'admin' && req.query.uid
          ? String(req.query.uid)
          : req.user!.uid;
      const user = await repos.users.findById(targetUid);
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao carregar usuário.' });
    }
  });

  router.post('/workspace/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await repos.users.syncWorkspace({
        uid: req.user!.uid,
        email: req.user!.email || '',
        displayName: req.user!.name || null,
        photoURL: null,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao sincronizar.' });
    }
  });

  router.patch('/me/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await repos.users.update(req.user!.uid, req.body || {});
      res.json({ user });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao atualizar.' });
    }
  });

  router.post('/me/profiles', requireAuth, async (req: AuthRequest, res) => {
    try {
      const profile = await repos.users.createStudyProfile(
        req.user!.uid,
        req.body || {}
      );
      res.status(201).json({ profile });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao criar perfil.' });
    }
  });

  router.post(
    '/me/profiles/:profileId/activate',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        await repos.users.activateStudyProfile(
          req.user!.uid,
          String(req.params.profileId)
        );
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao ativar perfil.' });
      }
    }
  );

  // --- Admin User & RBAC Management ---
  router.get(
    '/admin/users',
    requireAuth,
    requireRole('admin'),
    async (_req, res) => {
      try {
        const users = await repos.users.findAll();
        res.json({ users });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao listar usuários.' });
      }
    }
  );

  router.patch(
    '/admin/users/:userId/role',
    requireAuth,
    requireRole('admin'),
    async (req, res) => {
      try {
        const nextRole = req.body?.role;
        if (
          nextRole !== 'admin' &&
          nextRole !== 'editor' &&
          nextRole !== 'user'
        ) {
          return res.status(400).json({ error: 'Permissão inválida.' });
        }
        const user = await repos.users.updateUserRole(
          String(req.params.userId),
          nextRole
        );
        res.json({ user });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao alterar perfil.' });
      }
    }
  );

  // --- Question Bank ---
  router.get('/questions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await repos.questions.findAll(
        {
          board: req.query.board ? String(req.query.board) : undefined,
          career: req.query.career ? String(req.query.career) : undefined,
          subject: req.query.subject ? String(req.query.subject) : undefined,
          difficulty: req.query.difficulty
            ? String(req.query.difficulty)
            : undefined,
          sourceType: req.query.sourceType
            ? String(req.query.sourceType)
            : undefined,
          status: req.query.status ? String(req.query.status) : undefined,
          search: req.query.search ? String(req.query.search) : undefined,
          limitCount: req.query.limit ? Number(req.query.limit) : 40,
        },
        { uid: req.user!.uid }
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao buscar questões.' });
    }
  });

  router.get('/questions/offline-pack', requireAuth, async (_req, res) => {
    try {
      const questions = await repos.questions.fetchOfflinePack();
      res.json({ questions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro no pacote offline.' });
    }
  });

  router.get('/questions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const question = await repos.questions.findById(String(req.params.id), {
        uid: req.user!.uid,
      });
      res.json({ question });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao buscar questão.' });
    }
  });

  router.post(
    '/questions',
    requireAuth,
    requireRole('admin', 'editor'),
    async (req: AuthRequest, res) => {
      try {
        const question = await repos.questions.create(req.body || {}, {
          uid: req.user!.uid,
        });
        res.status(201).json({ question });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao criar questão.' });
      }
    }
  );

  router.put(
    '/questions/:id',
    requireAuth,
    requireRole('admin', 'editor'),
    async (req, res) => {
      try {
        const question = await repos.questions.update(
          String(req.params.id),
          req.body || {}
        );
        res.json({ question });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao editar questão.' });
      }
    }
  );

  router.delete(
    '/questions/:id',
    requireAuth,
    requireRole('admin', 'editor'),
    async (req, res) => {
      try {
        await repos.questions.delete(String(req.params.id));
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao excluir.' });
      }
    }
  );

  router.post(
    '/questions/:id/attempt',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const result = await repos.questions.submitAttempt(req.user!.uid, {
          questionId: String(req.params.id),
          selectedOption: String(req.body?.selectedOption || ''),
          timeSpentSec: req.body?.timeSpentSec,
          profileId: req.body?.profileId || null,
          isBookmarked: Boolean(req.body?.isBookmarked),
        });
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao registrar.' });
      }
    }
  );

  // --- PDF Imports ---
  router.get(
    '/pdfs/history',
    requireAuth,
    requireRole('admin', 'editor'),
    async (_req, res) => {
      try {
        const imports = await repos.pdfImports.findAll();
        res.json({ imports });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro no histórico.' });
      }
    }
  );

  router.get(
    '/pdfs/:id',
    requireAuth,
    requireRole('admin', 'editor'),
    async (req, res) => {
      try {
        const pdfImport = await repos.pdfImports.findById(
          String(req.params.id)
        );
        res.json({ pdfImport });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro ao buscar PDF.' });
      }
    }
  );

  router.post(
    '/pdfs/commit',
    requireAuth,
    requireRole('admin', 'editor'),
    async (req: AuthRequest, res) => {
      try {
        const result = await repos.pdfImports.create(req.body || {}, {
          uid: req.user!.uid,
        });
        const user = await repos.users.findById(req.user!.uid);
        res.status(201).json({
          insertedCount: result.extractedCount,
          user,
        });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao gravar PDF.' });
      }
    }
  );

  router.delete(
    '/pdfs/:id',
    requireAuth,
    requireRole('admin', 'editor'),
    async (req, res) => {
      try {
        await repos.pdfImports.delete(String(req.params.id));
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao excluir PDF.' });
      }
    }
  );

  // --- Scraper History ---
  router.get(
    '/scraper/history',
    requireAuth,
    requireRole('admin'),
    async (_req, res) => {
      try {
        const jobs = await repos.scraper.listHistory();
        res.json({ jobs });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Erro nas coletas.' });
      }
    }
  );

  router.post(
    '/scraper/commit',
    requireAuth,
    requireRole('admin'),
    async (req: AuthRequest, res) => {
      try {
        const result = await repos.scraper.saveScraped(
          req.user!.uid,
          req.body || {}
        );
        res.status(201).json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao salvar coleta.' });
      }
    }
  );

  // --- Mock Exams & Rankings ---
  router.get('/mock-exams', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await repos.mockExams.findAll(undefined, {
        uid: req.user!.uid,
      });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro nos simulados.' });
    }
  });

  router.get('/mock-exams/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const exam = await repos.mockExams.findById(String(req.params.id), {
        uid: req.user!.uid,
      });
      res.json({ exam });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao buscar simulado.' });
    }
  });

  router.post(
    '/mock-exams/submit',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const result = await repos.mockExams.submit(req.user!.uid, {
          title: String(req.body?.title || 'Simulado'),
          board: String(req.body?.board || 'Todas'),
          career: String(req.body?.career || 'Todas'),
          durationMinutes: Number(req.body?.durationMinutes) || 20,
          elapsedSeconds: Number(req.body?.elapsedSeconds) || 0,
          cebraspePenalty: Boolean(req.body?.cebraspePenalty),
          questionIds: Array.isArray(req.body?.questionIds)
            ? req.body.questionIds.map(String)
            : [],
          answers: req.body?.answers || {},
        });
        res.status(201).json(result);
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro no simulado.' });
      }
    }
  );

  // --- Analytics, Schedules & Backup ---
  router.get('/analytics', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await repos.dashboard.getAnalytics(req.user!.uid);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro nos dados.' });
    }
  });

  router.get('/schedules', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schedules = await repos.dashboard.listSchedules(req.user!.uid);
      res.json({ schedules });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro no cronograma.' });
    }
  });

  router.post('/schedules', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schedule = await repos.dashboard.createSchedule(
        req.user!.uid,
        req.body || {}
      );
      res.status(201).json({ schedule });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao agendar.' });
    }
  });

  router.patch('/schedules/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const schedule = await repos.dashboard.updateSchedule(
        req.user!.uid,
        String(req.params.id),
        req.body || {}
      );
      res.json({ schedule });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao atualizar.' });
    }
  });

  router.delete(
    '/schedules/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        await repos.dashboard.deleteSchedule(
          req.user!.uid,
          String(req.params.id)
        );
        res.json({ ok: true });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao remover.' });
      }
    }
  );

  router.get('/backup/export', requireAuth, async (req: AuthRequest, res) => {
    try {
      const backup = await repos.dashboard.exportBackup(req.user!.uid);
      res.json(backup);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro no backup.' });
    }
  });

  // --- Community Forum & Chat ---
  router.get('/forum', requireAuth, async (_req, res) => {
    try {
      const posts = await repos.community.listForumPosts();
      res.json({ posts });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro no fórum.' });
    }
  });

  router.post('/forum', requireAuth, async (req: AuthRequest, res) => {
    try {
      const post = await repos.community.createForumPost(
        req.user!.uid,
        req.body?.authorName || req.user!.name || req.user!.email || 'Estudante',
        req.body || {}
      );
      res.status(201).json({ post });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao publicar.' });
    }
  });

  router.post(
    '/forum/:postId/reply',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const post = await repos.community.replyForumPost(
          String(req.params.postId),
          req.body?.authorName || req.user!.name || req.user!.email || 'Estudante',
          String(req.body?.text || '')
        );
        res.json({ post });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao responder.' });
      }
    }
  );

  router.post('/forum/:postId/upvote', requireAuth, async (req, res) => {
    try {
      const post = await repos.community.upvoteForumPost(
        String(req.params.postId)
      );
      res.json({ post });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao curtir.' });
    }
  });

  router.get('/chat/:room', requireAuth, async (req, res) => {
    const room = String(req.params.room || 'geral');
    if (!ALLOWED_ROOMS.has(room)) {
      return res.status(400).json({ error: 'Sala inválida.' });
    }
    try {
      const messages = await repos.community.listChatMessages(room);
      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro no chat.' });
    }
  });

  router.post('/chat/:room', requireAuth, async (req: AuthRequest, res) => {
    const room = String(req.params.room || 'geral');
    if (!ALLOWED_ROOMS.has(room)) {
      return res.status(400).json({ error: 'Sala inválida.' });
    }
    try {
      const message = await repos.community.saveChatMessage(
        req.user!.uid,
        req.body?.authorName || req.user!.name || req.user!.email || 'Estudante',
        Number(req.body?.authorLevel) || 1,
        room,
        String(req.body?.message || '')
      );
      res.status(201).json({ message });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Erro ao enviar.' });
    }
  });

  return router;
}
