import { sql } from 'drizzle-orm';
import { SEED_QUESTIONS } from '../../lib/seedQuestions.ts';
import { getPgDb } from './client.ts';
import { questionsTable, scrapeJobsTable } from './schema.ts';

let seeded = false;

export async function ensurePostgresSeeded(adminUserId?: string): Promise<void> {
  if (seeded) return;
  const db = getPgDb();

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionsTable);

  if (count === 0) {
    await db.insert(questionsTable).values(
      SEED_QUESTIONS.map((q) => ({
        code: q.code,
        board: q.board,
        career: q.career,
        subject: q.subject,
        topic: q.topic,
        organ: q.organ,
        year: q.year,
        difficulty: q.difficulty,
        questionType: q.questionType,
        statement: q.statement,
        optionsJson: q.optionsJson,
        correctOption: q.correctOption,
        commentary: q.commentary,
        sourceType: 'curated',
        createdByUserId: adminUserId || null,
      }))
    );

    if (adminUserId) {
      const [{ jobsCount }] = await db
        .select({ jobsCount: sql<number>`count(*)::int` })
        .from(scrapeJobsTable);
      if (jobsCount === 0) {
        await db.insert(scrapeJobsTable).values([
          {
            userId: adminUserId,
            sourceName: 'Portal Oficial Cebraspe — Provas Aplicadas',
            sourceUrl: 'https://www.cebraspe.org.br/concursos',
            board: 'Cebraspe',
            career: 'Tribunais',
            questionsImported: 8,
            status: 'completed',
            summary:
              'Sincronização inicial concluída com validação automática de gabarito e comentários.',
          },
          {
            userId: adminUserId,
            sourceName: 'FGV Conhecimento — Cadernos Públicos',
            sourceUrl: 'https://conhecimento.fgv.br/concursos',
            board: 'FGV',
            career: 'Fiscal',
            questionsImported: 6,
            status: 'completed',
            summary:
              'Acervo de Direito Tributário e Português atualizado a partir do portal oficial.',
          },
        ]);
      }
    }
  }

  seeded = true;
}
