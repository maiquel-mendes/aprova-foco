import type { StudyScheduleItem } from '../types';

function nextDateForDayOfWeek(dayOfWeek: number, timeStr: string): Date {
  const now = new Date();
  const [hours, minutes] = timeStr.split(':').map((n) => Number(n) || 0);
  const diff = (dayOfWeek - now.getDay() + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + (diff === 0 ? 7 : diff));
  target.setHours(hours, minutes, 0, 0);
  return target;
}

export async function syncScheduleToGoogleCalendar(
  accessToken: string,
  item: StudyScheduleItem
): Promise<{ eventId: string; htmlLink?: string }> {
  const start = nextDateForDayOfWeek(item.dayOfWeek, item.startTime);
  const end = new Date(start.getTime() + item.durationMinutes * 60 * 1000);

  const eventBody = {
    summary: `AprovaFoco: ${item.subject} (${item.focusType})`,
    description: `Sessão programada de ${item.durationMinutes} min na plataforma AprovaFoco.`,
    start: {
      dateTime: start.toISOString(),
    },
    end: {
      dateTime: end.toISOString(),
    },
    reminders: {
      useDefault: false,
      overrides: [{ method: 'popup', minutes: 15 }],
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        'Não foi possível criar evento no Google Calendar. Faça login novamente para renovar a permissão.'
    );
  }

  const created = await res.json();
  return { eventId: created.id, htmlLink: created.htmlLink };
}

export async function uploadBackupToGoogleDrive(
  accessToken: string,
  backupJson: unknown
): Promise<{ fileId: string; name: string }> {
  const fileName = `aprovafoco-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };

  const boundary = '-------aprovafoco-backup-boundary';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    JSON.stringify(backupJson, null, 2),
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        'Não foi possível salvar backup no Google Drive. Renove o login com o Google.'
    );
  }

  const created = await res.json();
  return { fileId: created.id, name: created.name || fileName };
}
