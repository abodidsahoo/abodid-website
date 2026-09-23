import { createSupabaseServiceClient } from "../supabaseServer";
import { exhibitionThumbnailFor } from "./thumbnailPool";

export type PublicReading = {
  id: string;
  delivery_date: string;
  display_order: number;
  title: string;
  url: string;
  source_name: string;
  publication_date: string;
  topic_names: string[];
  why_it_matters: string;
  editorial_note: string | null;
  thumbnail_url: string | null;
  fallback_thumbnail_url: string;
};

type PublicReadingRow = Omit<PublicReading, "fallback_thumbnail_url">;

export type ReadingDay = { date: string; readings: PublicReading[] };
export type PublicReadingFeed = {
  todayDate: string;
  today: PublicReading[];
  archive: ReadingDay[];
  nextCursor: string | null;
  topics: Array<{ name: string; count: number }>;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_LIMIT = 5;
const FIELDS = "id,delivery_date,display_order,title,url,source_name,publication_date,topic_names,why_it_matters,editorial_note,thumbnail_url";

export const istDate = (now = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const nextDate = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export const validDate = (value: string): boolean =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export const slugifyTopic = (value: string): string =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const groupReadings = (items: PublicReading[], dates: string[]): ReadingDay[] => {
  const byDate = new Map(dates.map((date) => [date, [] as PublicReading[]]));
  for (const item of items) byDate.get(item.delivery_date)?.push(item);
  return dates.map((date) => ({
    date,
    readings: (byDate.get(date) ?? []).sort((a, b) =>
      a.display_order - b.display_order || a.title.localeCompare(b.title)
    ),
  })).filter((day) => day.readings.length > 0);
};

export async function getPublicReadingFeed({
  topic = null,
  beforeDate = null,
  includeTopics = false,
  now = new Date(),
}: {
  topic?: string | null;
  beforeDate?: string | null;
  includeTopics?: boolean;
  now?: Date;
} = {}): Promise<PublicReadingFeed> {
  if (beforeDate && !validDate(beforeDate)) throw new Error("Invalid archive date.");
  const database = createSupabaseServiceClient();
  if (!database) throw new Error("Reading feed configuration is incomplete.");

  const todayDate = istDate(now);
  const boundary = beforeDate ?? nextDate(todayDate);
  const [daysResult, topicsResult] = await Promise.all([
    database.rpc("reading_digest_public_days", {
      p_before_date: boundary,
      p_topic: topic,
      p_limit: DAY_LIMIT + 2,
    }),
    includeTopics ? database.rpc("reading_digest_public_topics") : Promise.resolve({ data: [], error: null }),
  ]);
  if (daysResult.error) throw new Error(daysResult.error.message);
  if (topicsResult.error) throw new Error(topicsResult.error.message);

  const allDates = (daysResult.data ?? [])
    .map((row: { delivery_date: string }) => row.delivery_date)
    .filter((date: string) => validDate(date) && date <= todayDate);
  const hasToday = !beforeDate && allDates[0] === todayDate;
  const archiveDates = (hasToday ? allDates.slice(1) : allDates).slice(0, DAY_LIMIT);
  const requestedDates = hasToday ? [todayDate, ...archiveDates] : archiveDates;
  const hasMore = allDates.length > requestedDates.length;

  const itemsResult = requestedDates.length
    ? await database.from("reading_digest_public_items").select(FIELDS).in("delivery_date", requestedDates)
    : { data: [], error: null };
  if (itemsResult.error) throw new Error(itemsResult.error.message);

  const byTopic = (item: PublicReadingRow) => !topic || item.topic_names.includes(topic);
  const items = ((itemsResult.data ?? []) as PublicReadingRow[])
    .filter(byTopic)
    .map((item) => ({ ...item, fallback_thumbnail_url: exhibitionThumbnailFor(item.id) }));
  const grouped = groupReadings(items, requestedDates);
  const today = hasToday ? grouped.find((day) => day.date === todayDate)?.readings ?? [] : [];
  const archive = grouped.filter((day) => day.date !== todayDate);
  return {
    todayDate,
    today,
    archive,
    nextCursor: hasMore ? archiveDates.at(-1) ?? null : null,
    topics: (topicsResult.data ?? []).map((row: { name: string; item_count: number }) => ({
      name: row.name,
      count: Number(row.item_count) || 0,
    })),
  };
}
