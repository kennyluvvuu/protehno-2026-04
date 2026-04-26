import type { Record as CallRecord, DirectionKind, RecordStatus } from "~/types/record";

export type ExportFormat = "csv" | "xlsx";

export interface ExportColumn<T = CallRecord> {
  key: string;
  header: string;
  value: (record: T) => unknown;
}

export interface ExportRecordsOptions<T = CallRecord> {
  records: T[];
  columns?: ExportColumn<T>[];
  fileName?: string;
  sheetName?: string;
}

const DEFAULT_FILENAME_PREFIX = "director-calls-export";

const DEFAULT_COLUMNS: ExportColumn[] = [
  { key: "id", header: "ID", value: (record) => record.id },
  {
    key: "title",
    header: "Название",
    value: (record) => getDisplayTitle(record),
  },
  {
    key: "counterparty",
    header: "Контрагент",
    value: (record) => getDisplayCounterparty(record),
  },
  {
    key: "direction",
    header: "Направление",
    value: (record) => getDirectionLabel(record.directionKind ?? null),
  },
  {
    key: "date",
    header: "Дата",
    value: (record) => formatDateTime(getRecordDate(record)),
  },
  {
    key: "durationSec",
    header: "Длительность, сек",
    value: (record) => getDisplayDuration(record) ?? "",
  },
  {
    key: "callStatus",
    header: "Тип звонка",
    value: (record) => getCallStatusLabel(record),
  },
  {
    key: "status",
    header: "Статус обработки",
    value: (record) => getProcessingStatusLabel(record.status),
  },
  {
    key: "source",
    header: "Источник",
    value: (record) => record.source ?? "",
  },
  {
    key: "callTo",
    header: "Кому звонили",
    value: (record) => record.callTo ?? "",
  },
  {
    key: "callerNumber",
    header: "Номер звонящего",
    value: (record) => record.callerNumber ?? "",
  },
  {
    key: "calleeNumber",
    header: "Номер получателя",
    value: (record) => record.calleeNumber ?? "",
  },
  {
    key: "summary",
    header: "Краткое summary",
    value: (record) => record.summary ?? "",
  },
  {
    key: "transcription",
    header: "Транскрипция",
    value: (record) => record.transcription ?? "",
  },
  {
    key: "tags",
    header: "Теги",
    value: (record) => record.tags.join(", "),
  },
];

export async function exportRecords(
  format: ExportFormat,
  options: ExportRecordsOptions,
): Promise<void> {
  if (format === "csv") {
    exportRecordsToCsv(options);
    return;
  }

  await exportRecordsToXlsx(options);
}

export function exportRecordsToCsv({
  records,
  columns = DEFAULT_COLUMNS,
  fileName,
}: ExportRecordsOptions): void {
  const rows = buildRows(records, columns);
  const csv = toCsv(rows);
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  triggerDownload(blob, ensureExtension(fileName, "csv"));
}

export async function exportRecordsToXlsx({
  records,
  columns = DEFAULT_COLUMNS,
  fileName,
  sheetName = "Calls",
}: ExportRecordsOptions): Promise<void> {
  const rows = buildRows(records, columns);
  const xlsx = await import("xlsx");

  const worksheet = xlsx.utils.json_to_sheet(rows);
  const workbook = xlsx.utils.book_new();

  xlsx.utils.book_append_sheet(
    workbook,
    worksheet,
    sanitizeSheetName(sheetName),
  );

  xlsx.writeFile(workbook, ensureExtension(fileName, "xlsx"), {
    compression: true,
  });
}

export function getDefaultExportColumns(): ExportColumn[] {
  return DEFAULT_COLUMNS;
}

export function buildRows<T>(
  records: T[],
  columns: ExportColumn<T>[],
): Array<Record<string, string | number | boolean>> {
  return records.map((record) => {
    const row: Record<string, string | number | boolean> = {};

    for (const column of columns) {
      row[column.header] = normalizeCellValue(column.value(record));
    }

    return row;
  });
}

function getDisplayTitle(record: CallRecord): string {
  return record.title ?? `Звонок #${record.id}`;
}

function getDisplayCounterparty(record: CallRecord): string {
  if (record.callTo) return record.callTo;

  if (record.directionKind === "inbound") {
    return record.callerNumber ?? record.calleeNumber ?? "—";
  }

  if (record.directionKind === "outbound") {
    return record.calleeNumber ?? record.callerNumber ?? "—";
  }

  return record.callerNumber ?? record.calleeNumber ?? "—";
}

function getDirectionLabel(directionKind?: DirectionKind | null): string {
  if (directionKind === "inbound") return "Входящий";
  if (directionKind === "outbound") return "Исходящий";
  return "Неизвестно";
}

function getRecordDate(record: CallRecord): string | null {
  return record.callStartedAt ?? record.startedAt ?? record.finishedAt ?? null;
}

function getDisplayDuration(record: CallRecord): number | null {
  return record.durationSec ?? record.talkDurationSec ?? null;
}

function isMissedCall(record: CallRecord): boolean {
  return (
    record.isMissed === true ||
    record.ingestionStatus === "no_audio" ||
    record.status === "not_applicable" ||
    (record.talkDurationSec != null && record.talkDurationSec === 0)
  );
}

function getCallStatusLabel(record: CallRecord): string {
  if (record.status === "failed") return "Ошибка";
  if (isMissedCall(record)) return "Пропущенный";
  return "Принятый";
}

function getProcessingStatusLabel(status: RecordStatus): string {
  if (status === "done") return "Выполнено";
  if (status === "failed") return "Ошибка";
  if (status === "not_applicable") return "Нет аудио";
  if (status === "queued") return "В очереди";
  if (status === "uploaded") return "Загружено";
  return "Обработка";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU");
}

function toCsv(rows: Array<Record<string, string | number | boolean>>): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvCell).join(",");

  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCsvCell(row[header])).join(","),
  );

  return [headerLine, ...bodyLines].join("\r\n");
}

function escapeCsvCell(value: unknown): string {
  const normalized = normalizeCellValue(value);
  const stringValue = String(normalized).replaceAll('"', '""');

  if (/[",\r\n;]/.test(stringValue)) {
    return `"${stringValue}"`;
  }

  return stringValue;
}

function normalizeCellValue(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value;

  if (value instanceof Date) {
    return value.toLocaleString("ru-RU");
  }

  return String(value);
}

function ensureExtension(
  fileName: string | undefined,
  extension: "csv" | "xlsx",
): string {
  const safeBaseName =
    (fileName && fileName.trim()) || DEFAULT_FILENAME_PREFIX;

  return safeBaseName.toLowerCase().endsWith(`.${extension}`)
    ? safeBaseName
    : `${safeBaseName}.${extension}`;
}

function sanitizeSheetName(sheetName: string): string {
  const fallback = "Calls";
  const sanitized = sheetName
    .replaceAll(/[\\/*?:[\]]/g, " ")
    .trim()
    .slice(0, 31);

  return sanitized || fallback;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}
