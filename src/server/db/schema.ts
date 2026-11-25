import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const usersTable = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('user'),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(1),
    streakDays: integer('streak_days').notNull().default(1),
    lastStudyDate: text('last_study_date'),
    planTier: text('plan_tier').notNull().default('premium_trial'),
    dailyGoal: integer('daily_goal').notNull().default(20),
    pushEnabled: boolean('push_enabled').notNull().default(false),
    preferredTheme: text('preferred_theme').notNull().default('light'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)]
);

export const studyProfilesTable = pgTable(
  'study_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    career: text('career').notNull(),
    targetBoard: text('target_board').notNull(),
    examDate: text('exam_date'),
    dailyHours: integer('daily_hours').notNull().default(3),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('study_profiles_user_idx').on(table.userId)]
);

export const pdfImportsTable = pgTable(
  'pdf_imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    fileName: text('file_name').notNull(),
    board: text('board').notNull(),
    career: text('career').notNull(),
    year: integer('year').notNull().default(2025),
    extractedCount: integer('extracted_count').notNull().default(0),
    status: text('status').notNull().default('processed'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('pdf_imports_user_idx').on(table.userId)]
);

export const questionsTable = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    board: text('board').notNull(),
    career: text('career').notNull(),
    subject: text('subject').notNull(),
    topic: text('topic').notNull(),
    organ: text('organ').notNull(),
    year: integer('year').notNull(),
    difficulty: text('difficulty').notNull(),
    questionType: text('question_type').notNull().default('multiple_choice'),
    statement: text('statement').notNull(),
    optionsJson: jsonb('options_json')
      .$type<{ key: string; text: string }[]>()
      .notNull(),
    correctOption: text('correct_option').notNull(),
    commentary: text('commentary').notNull(),
    sourceType: text('source_type').notNull().default('curated'),
    pdfImportId: uuid('pdf_import_id').references(() => pdfImportsTable.id, {
      onDelete: 'cascade',
    }),
    createdByUserId: uuid('created_by_user_id').references(
      () => usersTable.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('questions_board_career_idx').on(table.board, table.career),
    index('questions_subject_idx').on(table.subject),
    index('questions_pdf_idx').on(table.pdfImportId),
  ]
);

export const questionAttemptsTable = pgTable(
  'question_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questionsTable.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id').references(() => studyProfilesTable.id, {
      onDelete: 'set null',
    }),
    subject: text('subject').notNull(),
    topic: text('topic').notNull(),
    board: text('board').notNull(),
    selectedOption: text('selected_option').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    timeSpentSec: integer('time_spent_sec').notNull().default(45),
    isBookmarked: boolean('is_bookmarked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('attempts_user_idx').on(table.userId),
    index('attempts_user_question_idx').on(table.userId, table.questionId),
  ]
);

export const scrapeJobsTable = pgTable('scrape_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  board: text('board').notNull(),
  career: text('career').notNull(),
  questionsImported: integer('questions_imported').notNull().default(0),
  status: text('status').notNull().default('completed'),
  summary: text('summary'),
  ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mockExamsTable = pgTable(
  'mock_exams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    board: text('board').notNull(),
    career: text('career').notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(20),
    elapsedSeconds: integer('elapsed_seconds').notNull().default(0),
    totalQuestions: integer('total_questions').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    wrongCount: integer('wrong_count').notNull().default(0),
    blankCount: integer('blank_count').notNull().default(0),
    netScore: integer('net_score').notNull().default(0),
    status: text('status').notNull().default('completed'),
    breakdownJson: jsonb('breakdown_json')
      .$type<{ subject: string; total: number; correct: number }[]>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('mock_exams_user_idx').on(table.userId)]
);

export const studySchedulesTable = pgTable(
  'study_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull().default(1),
    startTime: text('start_time').notNull().default('19:00'),
    durationMinutes: integer('duration_minutes').notNull().default(90),
    subject: text('subject').notNull(),
    focusType: text('focus_type').notNull().default('Questões'),
    completed: boolean('completed').notNull().default(false),
    calendarEventId: text('calendar_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('schedules_user_idx').on(table.userId)]
);

export const achievementsTable = pgTable(
  'achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    badgeKey: text('badge_key').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('achievements_user_badge_idx').on(table.userId, table.badgeKey),
  ]
);

export const forumPostsTable = pgTable('forum_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').references(() => questionsTable.id, {
    onDelete: 'set null',
  }),
  subject: text('subject').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  authorName: text('author_name').notNull(),
  upvotes: integer('upvotes').notNull().default(1),
  repliesJson: jsonb('replies_json')
    .$type<
      { id: string; author: string; text: string; createdAt: string }[]
    >()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const chatMessagesTable = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    room: text('room').notNull(),
    authorName: text('author_name').notNull(),
    authorLevel: integer('author_level').notNull().default(1),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('chat_room_created_idx').on(table.room, table.createdAt)]
);
