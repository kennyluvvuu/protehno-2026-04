import Elysia, { t, type Static } from "elysia";
import type RecordService from "../records/service";
import type RecordAiService from "../records/ai-service";
import type UserService from "../user/service";
import type { IStorage } from "../../storage/interface";
import { guardPlugin } from "../guard";
import type { UserRole } from "../guard";
import { MangoClient } from "./client";

const syncLog = (...args: unknown[]) => console.log("[mango-sync]", ...args);

type ProtectedContext = {
    userId: number;
    userRole: UserRole;
    set: {
        status?: number | string;
    };
    request: Request;
};

type MangoUsersResponse = {
    users?: Array<{
        general?: {
            user_id?: number;
            name?: string | null;
            email?: string | null;
            department?: string | null;
            position?: string | null;
            access_role_id?: number | null;
            mobile?: string | null;
            login?: string | null;
            sips?: Array<{ number?: string | null }>;
        };
        telephony?: {
            extension?: string | null;
            outgoingline?: string | null;
            numbers?: Array<{
                number?: string | null;
                protocol?: string | null;
                order?: number | null;
                wait_sec?: number | null;
                status?: string | null;
            }>;
        };
        groups?: number[];
    }>;
};

type MangoCallsRequestResponse = {
    key?: string;
    result?: number;
    message?: string;
};

type MangoCallLeg = {
    call_abonent_id?: number | null;
    call_abonent_info?: string | null;
    call_abonent_extension?: string | null;
    caller_extension?: string | null;
    call_abonent_number?: string | null;
    call_start_time?: number | null;
    call_answer_time?: number | null;
    call_end_time?: number | null;
    call_duration?: number | null;
    talk_duration?: number | null;
    dial_duration?: number | null;
    hold_duration?: number | null;
    call_end_reason?: number | null;
    recording_id?: string[] | string | null;
    call_id?: string | string[] | null;
    external_call_id?: string | null;
    communication_id?: string | null;
    DirectionInbound?: boolean;
    DirectionOutbound?: boolean;
    ModeConversation?: boolean;
    ModeListen?: boolean;
    ModePrompt?: boolean;
    ModeConference?: boolean;
    ModeGroup?: boolean;
    RecordInbound?: boolean;
    RecordOutbound?: boolean;
    BlindTransfer?: boolean;
    ConsultTransfer?: boolean;
    OutboundDialing?: boolean;
    Intercepted?: boolean;
    IvrNotUsed?: boolean;
    members?: MangoCallLeg[] | null;
};

type MangoCallContext = {
    entry_id: string;
    context_type?: number | null;
    context_status?: number | null;
    caller_id?: number | null;
    caller_name?: string | null;
    caller_login?: string | null;
    caller_number?: string | null;
    called_number?: string | null;
    context_start_time?: number | null;
    duration?: number | null;
    talk_duration?: number | null;
    context_init_type?: number | null;
    recall_status?: number | null;
    context_calls?: MangoCallLeg[] | null;
};

type MangoCallsPeriodBucket = {
    period?: string;
    list?: MangoCallContext[];
    total_talks_duration?: number;
    total_calls_duration?: number;
    total_calls_count?: number;
};

type MangoCallsResultResponse = {
    result?: number;
    status?: string;
    data?:
        | {
              list?: MangoCallContext[];
              period?: string;
              total_talks_duration?: number;
              total_calls_duration?: number;
              total_calls_count?: number;
          }
        | MangoCallsPeriodBucket[];
};

type MangoTelephonyNumber = {
    number: string;
    protocol?: string;
    order?: number;
    wait_sec?: number;
    status?: string;
};

type MangoUserDirectoryEntry = {
    mangoUserId: number;
    name: string | null;
    email: string | null;
    department: string | null;
    position: string | null;
    accessRoleId: number | null;
    mobile: string | null;
    login: string | null;
    extension: string | null;
    outgoingLine: string | null;
    sips: string[];
    telephonyNumbers: Array<{
        number: string;
        protocol: string | undefined;
        order: number | undefined;
        wait_sec: number | undefined;
        status: string | undefined;
    }>;
    groups: number[];
};

type LocalUserCandidate = {
    id: number;
    name: string;
    fio: string | null;
    email: string;
    role: "director" | "manager";
    mangoUserId: number | null;
};

type MatchReason =
    | "mango_user_id_exact"
    | "extension_hint"
    | "login_hint"
    | "sip_hint"
    | "record_history";

type MangoMappingCandidate = {
    user: LocalUserCandidate;
    score: number;
    reasons: MatchReason[];
};

type MangoDirectoryRow = {
    mangoUserId: number;
    name: string | null;
    email: string | null;
    department: string | null;
    position: string | null;
    accessRoleId: number | null;
    mobile: string | null;
    login: string | null;
    extension: string | null;
    outgoingLine: string | null;
    sips: string[];
    telephonyNumbers: MangoTelephonyNumber[];
    groups: number[];
    linkedUserId: number | null;
    linkedByMangoUserId: boolean;
    candidates: MangoMappingCandidate[];
    createLocalUserDraft: {
        name: string;
        fio: string | null;
        email: string;
        role: "manager";
        mangoUserId: number;
        mangoLogin: string | null;
        mangoExtension: string | null;
        mangoPosition: string | null;
        mangoDepartment: string | null;
        mangoMobile: string | null;
        mangoOutgoingLine: string | null;
        mangoAccessRoleId: number | null;
        mangoGroups: number[];
        mangoSips: string[];
        mangoTelephonyNumbers: MangoTelephonyNumber[];
    } | null;
};

type ResolvedOwner = {
    mangoUserId?: number;
    extension?: string;
    matchedBy?:
        | "call_abonent_id"
        | "context_caller_id"
        | "call_abonent_extension"
        | "caller_extension"
        | "caller_login"
        | "sip";
};

type NormalizedCall = {
    entryId: string;
    direction: "inbound" | "outbound" | "unknown";
    directionKind: "inbound" | "outbound" | "unknown";
    callerNumber?: string;
    calleeNumber?: string;
    lineNumber?: string;
    extension?: string;
    callStartedAt?: Date;
    callAnsweredAt?: Date;
    callEndedAt?: Date;
    talkDurationSec?: number;
    isMissed: boolean;
    callTo?: string;
    mangoCallId?: string;
    mangoUserId?: number;
    mangoCommunicationId?: string;
    recordingIds: string[];
    debug: {
        matchedBy?: string;
        contextStatus?: number | null;
        callerId?: number | null;
    };
};

type SyncOptions = {
    startDate: string;
    endDate: string;
    limit?: number;
    offset?: number;
    maxPages?: number;
    pollIntervalMs?: number;
    maxAttempts?: number;
    downloadRecordings?: boolean;
};

type SyncSummary = {
    startDate: string;
    endDate: string;
    fetched: number;
    created: number;
    updated: number;
    downloaded: number;
    failedDownloads: number;
    skippedNoAudio: number;
};

type MangoDateWindow = {
    startDate: string;
    endDate: string;
};

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_MAX_ATTEMPTS = 30;
const DEFAULT_LIMIT = 500;
const DEFAULT_OFFSET = 0;
const DEFAULT_MAX_PAGES = 50;
const STATS_REQUEST_MIN_INTERVAL_MS = 2100;

const MANGO_DATE_TIME_RE =
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/;

const parseMangoDateTime = (value: string): Date | null => {
    const match = value.trim().match(MANGO_DATE_TIME_RE);
    if (!match) return null;

    const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = match;
    const day = Number(dd);
    const month = Number(mm);
    const year = Number(yyyy);
    const hours = Number(hh);
    const minutes = Number(mi);
    const seconds = Number(ss);

    if (
        !Number.isInteger(day) ||
        !Number.isInteger(month) ||
        !Number.isInteger(year) ||
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds)
    ) {
        return null;
    }

    const date = new Date(year, month - 1, day, hours, minutes, seconds, 0);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hours ||
        date.getMinutes() !== minutes ||
        date.getSeconds() !== seconds
    ) {
        return null;
    }

    return date;
};

const toMangoDateTime = (value: Date): string => {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = String(value.getFullYear());
    const hh = String(value.getHours()).padStart(2, "0");
    const mi = String(value.getMinutes()).padStart(2, "0");
    const ss = String(value.getSeconds()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}`;
};

const splitByMonthWindows = (
    startDateRaw: string,
    endDateRaw: string,
): MangoDateWindow[] => {
    const start = parseMangoDateTime(startDateRaw);
    const end = parseMangoDateTime(endDateRaw);

    if (!start || !end) {
        throw new Error(
            `Invalid Mango date format. Expected DD.MM.YYYY HH:mm:ss, got startDate="${startDateRaw}" endDate="${endDateRaw}"`,
        );
    }

    if (start.getTime() > end.getTime()) {
        throw new Error("endDate must be greater or equal to startDate");
    }

    const windows: MangoDateWindow[] = [];
    let cursor = new Date(start);

    while (cursor.getTime() <= end.getTime()) {
        const windowStart = new Date(cursor);
        const monthEnd = new Date(
            windowStart.getFullYear(),
            windowStart.getMonth() + 1,
            0,
            23,
            59,
            59,
            0,
        );
        const windowEnd =
            monthEnd.getTime() > end.getTime() ? new Date(end) : monthEnd;

        windows.push({
            startDate: toMangoDateTime(windowStart),
            endDate: toMangoDateTime(windowEnd),
        });

        cursor = new Date(windowEnd.getTime() + 1000);
    }

    return windows;
};

const assertDirector = (userRole: UserRole, set: ProtectedContext["set"]) => {
    if (userRole !== "director") {
        set.status = 403;
        return { message: "Forbidden" };
    }

    return null;
};

const normalizeError = (error: unknown) =>
    error instanceof Error ? error.message : "Unknown error";

const isPositiveInt = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value > 0;

const toOptionalDate = (value?: number | null): Date | undefined =>
    typeof value === "number" && value > 0 ? new Date(value * 1000) : undefined;

const toOptionalString = (value?: string | null): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};

const firstNonEmptyString = (...values: Array<string | null | undefined>) => {
    for (const value of values) {
        const normalized = toOptionalString(value);
        if (normalized) return normalized;
    }

    return undefined;
};

const flattenLegs = (
    legs: MangoCallLeg[] | null | undefined,
): MangoCallLeg[] => {
    if (!Array.isArray(legs) || !legs.length) return [];

    const result: MangoCallLeg[] = [];

    for (const leg of legs) {
        result.push(leg);

        if (Array.isArray(leg.members) && leg.members.length) {
            result.push(...flattenLegs(leg.members));
        }
    }

    return result;
};

const normalizeRecordingIds = (legs: MangoCallLeg[]): string[] => {
    const ids = new Set<string>();

    for (const leg of legs) {
        const source = leg.recording_id;

        if (Array.isArray(source)) {
            for (const item of source) {
                const normalized = toOptionalString(item);
                if (normalized) ids.add(normalized);
            }
            continue;
        }

        const normalized = toOptionalString(source);
        if (normalized) ids.add(normalized);
    }

    return Array.from(ids);
};

const pickPrimaryLeg = (legs: MangoCallLeg[]): MangoCallLeg | undefined => {
    if (!legs.length) return undefined;

    const answered = legs.find(
        (leg) => typeof leg.call_answer_time === "number",
    );
    if (answered) return answered;

    const withRecording = legs.find((leg) => {
        const ids = Array.isArray(leg.recording_id)
            ? leg.recording_id
            : leg.recording_id
              ? [leg.recording_id]
              : [];
        return ids.some((item) => !!toOptionalString(item));
    });
    if (withRecording) return withRecording;

    return legs[0];
};

const pickDirection = (
    call: MangoCallContext,
    leg?: MangoCallLeg,
): "inbound" | "outbound" | "unknown" => {
    if (leg?.DirectionInbound === true) return "inbound";
    if (leg?.DirectionOutbound === true) return "outbound";

    if (call.context_type === 1) return "inbound";
    if (call.context_type === 2) return "outbound";

    return "unknown";
};

const isMissedCall = (
    call: MangoCallContext,
    legs: MangoCallLeg[],
): boolean => {
    const talkDuration =
        typeof call.talk_duration === "number" ? call.talk_duration : 0;
    if (talkDuration > 0) return false;

    const anyAnswered = legs.some(
        (leg) =>
            typeof leg.call_answer_time === "number" &&
            leg.call_answer_time > 0 &&
            typeof leg.talk_duration === "number" &&
            leg.talk_duration > 0,
    );

    if (anyAnswered) return false;

    const hasAnyAnswerTimestamp = legs.some(
        (leg) =>
            typeof leg.call_answer_time === "number" &&
            leg.call_answer_time > 0,
    );

    if (!hasAnyAnswerTimestamp) return true;

    const anyTalk = legs.some(
        (leg) => typeof leg.talk_duration === "number" && leg.talk_duration > 0,
    );

    return !anyTalk;
};

const extractSipCandidates = (value?: string | null): string[] => {
    const normalized = toOptionalString(value);
    if (!normalized) return [];

    const candidates = new Set<string>();
    candidates.add(normalized.toLowerCase());

    const sipMatch = normalized.match(/user\d+@[^ >]+/i);
    if (sipMatch?.[0]) {
        candidates.add(sipMatch[0].toLowerCase());
    }

    const userMatch = normalized.match(/user\d+/i);
    if (userMatch?.[0]) {
        candidates.add(userMatch[0].toLowerCase());
    }

    return Array.from(candidates);
};

class MangoPollingSyncService {
    private usersCache: {
        loadedAt: number;
        entries: MangoUserDirectoryEntry[];
    } | null = null;
    private lastStatsRequestAt = 0;

    constructor(
        private readonly mangoClient: MangoClient,
        private readonly recordService: RecordService,
        private readonly userService: UserService,
        private readonly storage: IStorage,
        private readonly aiService: RecordAiService,
    ) {}

    private async sleep(ms: number) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async ensureStatsRequestRateLimit() {
        const elapsed = Date.now() - this.lastStatsRequestAt;
        if (elapsed < STATS_REQUEST_MIN_INTERVAL_MS) {
            await this.sleep(STATS_REQUEST_MIN_INTERVAL_MS - elapsed);
        }
        this.lastStatsRequestAt = Date.now();
    }

    private async loadUsersDirectory(
        force = false,
    ): Promise<MangoUserDirectoryEntry[]> {
        const now = Date.now();
        if (
            !force &&
            this.usersCache &&
            now - this.usersCache.loadedAt < 5 * 60 * 1000
        ) {
            return this.usersCache.entries;
        }

        const response = await this.mangoClient.post<MangoUsersResponse>(
            "/vpbx/config/users/request",
            {
                ext_fields: [
                    "general.user_id",
                    "general.name",
                    "general.email",
                    "general.department",
                    "general.position",
                    "general.login",
                    "general.mobile",
                    "general.sips",
                    "general.access_role_id",
                    "telephony.extension",
                    "telephony.outgoingline",
                    "telephony.numbers",
                    "groups",
                ],
            },
        );

        const entries: MangoUserDirectoryEntry[] = Array.isArray(response.users)
            ? response.users.flatMap((user) => {
                  const mangoUserId = user.general?.user_id;
                  if (!isPositiveInt(mangoUserId)) return [];

                  const sips = Array.isArray(user.general?.sips)
                      ? user.general!.sips!.flatMap((sip) => {
                            const normalized = toOptionalString(sip?.number);
                            return normalized ? [normalized] : [];
                        })
                      : [];

                  const telephonyNumbers: MangoUserDirectoryEntry["telephonyNumbers"] =
                      Array.isArray(user.telephony?.numbers)
                          ? user.telephony!.numbers!.flatMap((item) => {
                                const number = toOptionalString(item?.number);
                                if (!number) return [];

                                return [
                                    {
                                        number,
                                        protocol: toOptionalString(
                                            item?.protocol,
                                        ),
                                        order:
                                            typeof item?.order === "number"
                                                ? item.order
                                                : undefined,
                                        wait_sec:
                                            typeof item?.wait_sec === "number"
                                                ? item.wait_sec
                                                : undefined,
                                        status: toOptionalString(item?.status),
                                    },
                                ];
                            })
                          : [];

                  const groups = Array.isArray(user.groups)
                      ? user.groups.filter(
                            (value): value is number =>
                                typeof value === "number" &&
                                Number.isInteger(value),
                        )
                      : [];

                  return [
                      {
                          mangoUserId,
                          name: user.general?.name ?? null,
                          email: user.general?.email ?? null,
                          department: user.general?.department ?? null,
                          position: user.general?.position ?? null,
                          accessRoleId:
                              typeof user.general?.access_role_id === "number"
                                  ? user.general.access_role_id
                                  : null,
                          mobile: user.general?.mobile ?? null,
                          login: user.general?.login ?? null,
                          extension: user.telephony?.extension ?? null,
                          outgoingLine: user.telephony?.outgoingline ?? null,
                          sips,
                          telephonyNumbers,
                          groups,
                      },
                  ];
              })
            : [];

        this.usersCache = {
            loadedAt: now,
            entries,
        };

        syncLog("users directory loaded", { count: entries.length });
        return entries;
    }

    private async getLocalUsers(): Promise<LocalUserCandidate[]> {
        const users = await this.userService.getAllUsers();

        return users.map((user) => ({
            id: user.id,
            name: user.name,
            fio: user.fio ?? null,
            email: user.email,
            role: user.role,
            mangoUserId: user.mangoUserId ?? null,
        }));
    }

    async buildDirectoryRows(): Promise<MangoDirectoryRow[]> {
        const [directory, localUsers, records] = await Promise.all([
            this.loadUsersDirectory(),
            this.getLocalUsers(),
            this.recordService.getAllRecordsFeed(),
        ]);

        const recordsByMangoUserId = new Map<number, Set<number>>();

        for (const record of records ?? []) {
            if (
                typeof record.mangoUserId === "number" &&
                Number.isInteger(record.mangoUserId) &&
                record.mangoUserId > 0 &&
                typeof record.userId === "number" &&
                Number.isInteger(record.userId) &&
                record.userId > 0
            ) {
                const existing = recordsByMangoUserId.get(record.mangoUserId);
                if (existing) {
                    existing.add(record.userId);
                } else {
                    recordsByMangoUserId.set(
                        record.mangoUserId,
                        new Set([record.userId]),
                    );
                }
            }
        }

        return directory.map((entry) => {
            const candidates: MangoMappingCandidate[] = [];

            for (const user of localUsers) {
                const reasons: MatchReason[] = [];
                let score = 0;

                if (user.mangoUserId === entry.mangoUserId) {
                    reasons.push("mango_user_id_exact");
                    score += 100;
                }

                const login = toOptionalString(entry.login)?.toLowerCase();
                const extension = toOptionalString(entry.extension);

                const loginContainsEmail =
                    login && user.email.toLowerCase().includes(login);
                const loginContainsName =
                    login &&
                    (user.name.toLowerCase().includes(login) ||
                        (user.fio?.toLowerCase().includes(login) ?? false));

                if (loginContainsEmail || loginContainsName) {
                    reasons.push("login_hint");
                    score += 20;
                }

                const extensionSeenInRecords = (records ?? []).some(
                    (record) =>
                        record.userId === user.id &&
                        record.extension &&
                        extension &&
                        record.extension === extension,
                );

                if (extensionSeenInRecords) {
                    reasons.push("extension_hint");
                    score += 15;
                }

                const sipSeenInRecords = entry.sips.some((sip) =>
                    (records ?? []).some(
                        (record) =>
                            record.userId === user.id &&
                            typeof record.calleeNumber === "string" &&
                            record.calleeNumber
                                .toLowerCase()
                                .includes(sip.toLowerCase()),
                    ),
                );

                if (sipSeenInRecords) {
                    reasons.push("sip_hint");
                    score += 10;
                }

                if (recordsByMangoUserId.get(entry.mangoUserId)?.has(user.id)) {
                    reasons.push("record_history");
                    score += 25;
                }

                if (reasons.length > 0) {
                    candidates.push({
                        user,
                        score,
                        reasons,
                    });
                }
            }

            candidates.sort(
                (a, b) => b.score - a.score || a.user.id - b.user.id,
            );

            const linkedUser =
                localUsers.find(
                    (user) => user.mangoUserId === entry.mangoUserId,
                ) ?? null;

            const login = toOptionalString(entry.login);
            const loginTail = login?.includes("/")
                ? (login.split("/").pop() ?? login)
                : login;
            const emailCandidate = entry.mangoUserId
                ? `mango-user-${entry.mangoUserId}@example.com`
                : loginTail
                  ? `${loginTail.toLowerCase()}@example.com`
                  : `mango-user-unknown@example.com`;

            const createLocalUserDraft = linkedUser
                ? null
                : {
                      name:
                          toOptionalString(entry.name) ??
                          loginTail ??
                          `mango-user-${entry.mangoUserId}`,
                      fio: toOptionalString(entry.name) ?? null,
                      email:
                          toOptionalString(entry.email)?.toLowerCase() ??
                          emailCandidate,
                      role: "manager" as const,
                      mangoUserId: entry.mangoUserId,
                      mangoLogin: entry.login,
                      mangoExtension: entry.extension,
                      mangoPosition: entry.position,
                      mangoDepartment: entry.department,
                      mangoMobile: entry.mobile,
                      mangoOutgoingLine: entry.outgoingLine,
                      mangoAccessRoleId: entry.accessRoleId,
                      mangoGroups: entry.groups,
                      mangoSips: entry.sips,
                      mangoTelephonyNumbers: entry.telephonyNumbers,
                  };

            return {
                mangoUserId: entry.mangoUserId,
                name: entry.name,
                email: entry.email,
                department: entry.department,
                position: entry.position,
                accessRoleId: entry.accessRoleId,
                mobile: entry.mobile,
                login: entry.login,
                extension: entry.extension,
                outgoingLine: entry.outgoingLine,
                sips: entry.sips,
                telephonyNumbers: entry.telephonyNumbers,
                groups: entry.groups,
                linkedUserId: linkedUser?.id ?? null,
                linkedByMangoUserId: !!linkedUser,
                candidates: candidates.slice(0, 10),
                createLocalUserDraft,
            };
        });
    }

    private async requestCallsReport(options: SyncOptions): Promise<string> {
        await this.ensureStatsRequestRateLimit();

        syncLog("requesting calls report", {
            startDate: options.startDate,
            endDate: options.endDate,
            limit: options.limit ?? DEFAULT_LIMIT,
            offset: options.offset ?? DEFAULT_OFFSET,
        });

        const response = await this.mangoClient.post<MangoCallsRequestResponse>(
            "/vpbx/stats/calls/request",
            {
                start_date: options.startDate,
                end_date: options.endDate,
                limit: options.limit ?? DEFAULT_LIMIT,
                offset: options.offset ?? DEFAULT_OFFSET,
            },
        );

        syncLog("calls report requested", {
            result: response?.result ?? null,
            hasKey: !!response?.key,
            message: response?.message ?? null,
        });

        if (!response?.key) {
            throw new Error(
                `Mango did not return report key: ${JSON.stringify(response)}`,
            );
        }

        return response.key;
    }

    private async pollCallsReport(
        key: string,
        options: SyncOptions,
    ): Promise<MangoCallContext[]> {
        const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
        const pollIntervalMs =
            options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const response =
                await this.mangoClient.post<MangoCallsResultResponse>(
                    "/vpbx/stats/calls/result",
                    { key },
                );

            const data = response.data;
            const listCount = Array.isArray(data)
                ? data.reduce(
                      (sum, bucket) =>
                          sum +
                          (Array.isArray(bucket.list) ? bucket.list.length : 0),
                      0,
                  )
                : Array.isArray(data?.list)
                  ? data.list.length
                  : 0;
            const totalCallsCount = Array.isArray(data)
                ? data.reduce(
                      (sum, bucket) =>
                          sum +
                          (typeof bucket.total_calls_count === "number"
                              ? bucket.total_calls_count
                              : 0),
                      0,
                  )
                : (data?.total_calls_count ?? null);
            const period = Array.isArray(data)
                ? data.map((bucket) => bucket.period ?? null)
                : (data?.period ?? null);

            syncLog("polling calls report", {
                key,
                attempt,
                maxAttempts,
                status: response.status ?? null,
                result: response.result ?? null,
                listCount,
                totalCallsCount,
                period,
            });

            if (response.result && response.result !== 1000) {
                throw new Error(
                    `Mango report error: ${JSON.stringify(response)}`,
                );
            }

            if (response.status === "complete") {
                if (Array.isArray(data)) {
                    return data.flatMap((bucket) =>
                        Array.isArray(bucket.list) ? bucket.list : [],
                    );
                }

                return Array.isArray(data?.list) ? data.list : [];
            }

            await this.sleep(pollIntervalMs);
        }

        throw new Error("Mango calls report was not ready in time");
    }

    private resolveOwner(
        call: MangoCallContext,
        legs: MangoCallLeg[],
        directory: MangoUserDirectoryEntry[],
    ): ResolvedOwner {
        const byMangoUserId = new Map<number, MangoUserDirectoryEntry>();
        const byExtension = new Map<string, MangoUserDirectoryEntry>();
        const byLogin = new Map<string, MangoUserDirectoryEntry>();
        const bySip = new Map<string, MangoUserDirectoryEntry>();

        for (const entry of directory) {
            byMangoUserId.set(entry.mangoUserId, entry);

            const extension = toOptionalString(entry.extension);
            if (extension) byExtension.set(extension, entry);

            const login = toOptionalString(entry.login);
            if (login) byLogin.set(login.toLowerCase(), entry);

            for (const sip of entry.sips) {
                const normalized = sip.toLowerCase();
                bySip.set(normalized, entry);

                const userPart = normalized.match(/user\d+/i)?.[0];
                if (userPart) {
                    bySip.set(userPart.toLowerCase(), entry);
                }
            }
        }

        for (const leg of legs) {
            if (isPositiveInt(leg.call_abonent_id)) {
                const matched = byMangoUserId.get(leg.call_abonent_id);
                if (matched) {
                    return {
                        mangoUserId: matched.mangoUserId,
                        extension: toOptionalString(matched.extension),
                        matchedBy: "call_abonent_id",
                    };
                }
            }
        }

        if (isPositiveInt(call.caller_id)) {
            const matched = byMangoUserId.get(call.caller_id);
            if (matched) {
                return {
                    mangoUserId: matched.mangoUserId,
                    extension: toOptionalString(matched.extension),
                    matchedBy: "context_caller_id",
                };
            }
        }

        for (const leg of legs) {
            const extension = toOptionalString(leg.call_abonent_extension);
            if (extension) {
                const matched = byExtension.get(extension);
                if (matched) {
                    return {
                        mangoUserId: matched.mangoUserId,
                        extension,
                        matchedBy: "call_abonent_extension",
                    };
                }
            }
        }

        for (const leg of legs) {
            const extension = toOptionalString(leg.caller_extension);
            if (extension) {
                const matched = byExtension.get(extension);
                if (matched) {
                    return {
                        mangoUserId: matched.mangoUserId,
                        extension,
                        matchedBy: "caller_extension",
                    };
                }
            }
        }

        const callerLogin = toOptionalString(call.caller_login)?.toLowerCase();
        if (callerLogin) {
            const matched = byLogin.get(callerLogin);
            if (matched) {
                return {
                    mangoUserId: matched.mangoUserId,
                    extension: toOptionalString(matched.extension),
                    matchedBy: "caller_login",
                };
            }
        }

        for (const leg of legs) {
            for (const candidate of extractSipCandidates(
                leg.call_abonent_info,
            )) {
                const matched = bySip.get(candidate);
                if (matched) {
                    return {
                        mangoUserId: matched.mangoUserId,
                        extension: toOptionalString(matched.extension),
                        matchedBy: "sip",
                    };
                }
            }
        }

        return {};
    }

    private normalizeCall(
        call: MangoCallContext,
        directory: MangoUserDirectoryEntry[],
    ): NormalizedCall {
        const legs = flattenLegs(call.context_calls);
        const primaryLeg = pickPrimaryLeg(legs);
        const directionKind = pickDirection(call, primaryLeg);
        const direction = directionKind;
        const owner = this.resolveOwner(call, legs, directory);
        const recordingIds = normalizeRecordingIds(legs);
        const isMissed = isMissedCall(call, legs);

        const callerNumber = firstNonEmptyString(
            call.caller_number,
            primaryLeg?.call_abonent_number,
        );
        const calleeNumber = firstNonEmptyString(call.called_number);

        const talkDurationSec =
            typeof call.talk_duration === "number"
                ? call.talk_duration
                : typeof primaryLeg?.talk_duration === "number"
                  ? primaryLeg.talk_duration
                  : 0;

        const callStartedAt = toOptionalDate(
            call.context_start_time ?? primaryLeg?.call_start_time,
        );
        const callAnsweredAt = isMissed
            ? undefined
            : toOptionalDate(primaryLeg?.call_answer_time);
        const callEndedAt = toOptionalDate(primaryLeg?.call_end_time);

        const primaryCallId = Array.isArray(primaryLeg?.call_id)
            ? primaryLeg?.call_id.find((item) => !!toOptionalString(item))
            : (primaryLeg?.call_id ?? undefined);

        const callTo =
            direction === "inbound"
                ? callerNumber
                : direction === "outbound"
                  ? calleeNumber
                  : (callerNumber ?? calleeNumber);

        return {
            entryId: call.entry_id,
            direction,
            directionKind,
            callerNumber,
            calleeNumber,
            lineNumber: undefined,
            extension: owner.extension,
            callStartedAt,
            callAnsweredAt,
            callEndedAt,
            talkDurationSec,
            isMissed,
            callTo,
            mangoCallId: toOptionalString(primaryCallId),
            mangoUserId: owner.mangoUserId,
            mangoCommunicationId: toOptionalString(
                primaryLeg?.communication_id,
            ),
            recordingIds,
            debug: {
                matchedBy: owner.matchedBy,
                contextStatus: call.context_status ?? null,
                callerId: call.caller_id ?? null,
            },
        };
    }

    private async attachOwner(recordId: number, mangoUserId?: number) {
        if (!isPositiveInt(mangoUserId)) return;

        await this.recordService.setMangoUserId(recordId, mangoUserId);

        const user = await this.userService.getUserByMangoUserId(mangoUserId);
        if (user) {
            await this.recordService.setRecordOwner(recordId, user.id);
        }
    }

    private async attachRecording(
        recordId: number,
        entryId: string,
        recordingIds: string[],
        title?: string,
    ): Promise<"downloaded" | "skipped" | "failed"> {
        const recordingId = recordingIds.find(
            (item) => !!toOptionalString(item),
        );
        if (!recordingId) return "skipped";

        try {
            await this.recordService.setIngestionStatus(
                recordId,
                "downloading",
            );
            const audio = await this.mangoClient.downloadRecording(recordingId);

            const fileName = `mango-${entryId}-${recordingId}.mp3`;
            const file = new File([audio], fileName, { type: "audio/mpeg" });

            const storageKey = `mango/${entryId}/${fileName}`;

            const fileUri = await this.storage.upload(storageKey, file);
            await this.recordService.setMangoAudio(
                recordId,
                fileUri,
                recordingId,
            );

            this.runAiPipelineInBackground(recordId, fileUri, title);

            return "downloaded";
        } catch (error) {
            await this.recordService.setIngestionStatus(
                recordId,
                "failed",
                normalizeError(error),
            );
            return "failed";
        }
    }

    async syncCalls(options: SyncOptions): Promise<SyncSummary> {
        const limit = options.limit ?? DEFAULT_LIMIT;
        const offset = options.offset ?? DEFAULT_OFFSET;
        const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

        syncLog("sync calls started", {
            startDate: options.startDate,
            endDate: options.endDate,
            limit,
            offset,
            maxPages,
            pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
            maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
            downloadRecordings: options.downloadRecordings ?? true,
        });

        const directory = await this.loadUsersDirectory();
        const rawCalls: MangoCallContext[] = [];
        const uniqueCallsByEntryId = new Map<string, MangoCallContext>();
        const windows = splitByMonthWindows(options.startDate, options.endDate);

        syncLog("sync windows prepared", {
            count: windows.length,
            first: windows[0] ?? null,
            last: windows[windows.length - 1] ?? null,
        });

        for (const [windowIndex, window] of windows.entries()) {
            for (let page = 0; page < maxPages; page++) {
                const pageOffset = offset + page * limit;
                const key = await this.requestCallsReport({
                    ...options,
                    startDate: window.startDate,
                    endDate: window.endDate,
                    limit,
                    offset: pageOffset,
                });

                const pageCalls = await this.pollCallsReport(key, options);

                for (const call of pageCalls) {
                    const entryId = toOptionalString(call.entry_id);
                    if (!entryId) {
                        rawCalls.push(call);
                        continue;
                    }
                    if (!uniqueCallsByEntryId.has(entryId)) {
                        uniqueCallsByEntryId.set(entryId, call);
                    }
                }

                syncLog("raw calls page received", {
                    windowIndex,
                    windowStart: window.startDate,
                    windowEnd: window.endDate,
                    page,
                    pageOffset,
                    pageSize: pageCalls.length,
                    uniqueCollected: uniqueCallsByEntryId.size,
                });

                if (pageCalls.length < limit) {
                    break;
                }
            }
        }

        rawCalls.push(...uniqueCallsByEntryId.values());

        syncLog("raw calls received", {
            count: rawCalls.length,
            sampleEntryIds: rawCalls
                .slice(0, 5)
                .map((call) => toOptionalString(call.entry_id))
                .filter(Boolean),
        });

        let created = 0;
        let updated = 0;
        let downloaded = 0;
        let failedDownloads = 0;
        let skippedNoAudio = 0;
        let skippedWithoutEntryId = 0;

        for (const rawCall of rawCalls) {
            if (!toOptionalString(rawCall.entry_id)) {
                skippedWithoutEntryId += 1;
                syncLog("skipping call without entry id", {
                    callerId: rawCall.caller_id ?? null,
                    callerLogin: rawCall.caller_login ?? null,
                    contextStartTime: rawCall.context_start_time ?? null,
                });
                continue;
            }

            const normalized = this.normalizeCall(rawCall, directory);

            syncLog("upserting call", {
                entryId: normalized.entryId,
                direction: normalized.direction,
                isMissed: normalized.isMissed,
                matchedBy: normalized.debug.matchedBy,
                mangoUserId: normalized.mangoUserId,
                recordings: normalized.recordingIds.length,
                callerId: normalized.debug.callerId,
                callStartedAt: normalized.callStartedAt?.toISOString() ?? null,
                callAnsweredAt:
                    normalized.callAnsweredAt?.toISOString() ?? null,
                callEndedAt: normalized.callEndedAt?.toISOString() ?? null,
            });

            const upsertResult = await this.recordService.upsertMangoRecord({
                mangoEntryId: normalized.entryId,
                mangoCallId: normalized.mangoCallId,
                mangoCommunicationId: normalized.mangoCommunicationId,
                mangoUserId: normalized.mangoUserId,
                direction: normalized.direction,
                directionKind: normalized.directionKind,
                callerNumber: normalized.callerNumber,
                calleeNumber: normalized.calleeNumber,
                lineNumber: normalized.lineNumber,
                extension: normalized.extension,
                callStartedAt: normalized.callStartedAt,
                callAnsweredAt: normalized.callAnsweredAt,
                callEndedAt: normalized.callEndedAt,
                talkDurationSec: normalized.talkDurationSec,
                isMissed: normalized.isMissed,
                callTo: normalized.callTo,
            });

            if (upsertResult.created) created += 1;
            else updated += 1;

            await this.attachOwner(
                upsertResult.record.id,
                normalized.mangoUserId,
            );

            if (normalized.recordingIds.length === 0) {
                skippedNoAudio += 1;
                continue;
            }

            if (options.downloadRecordings === false) {
                continue;
            }

            const result = await this.attachRecording(
                upsertResult.record.id,
                normalized.entryId,
                normalized.recordingIds,
                upsertResult.record.title ?? undefined,
            );

            if (result === "downloaded") downloaded += 1;
            if (result === "failed") failedDownloads += 1;
        }

        syncLog("sync calls finished", {
            fetched: rawCalls.length,
            created,
            updated,
            downloaded,
            failedDownloads,
            skippedNoAudio,
            skippedWithoutEntryId,
        });

        return {
            startDate: options.startDate,
            endDate: options.endDate,
            fetched: rawCalls.length,
            created,
            updated,
            downloaded,
            failedDownloads,
            skippedNoAudio,
        };
    }

    async refreshUsersDirectory(): Promise<{ count: number }> {
        const users = await this.loadUsersDirectory(true);
        return { count: users.length };
    }

    private runAiPipelineInBackground(
        recordId: number,
        fileUri: string,
        title?: string,
    ): void {
        void (async () => {
            try {
                syncLog("AI processing started", { recordId });
                await this.recordService.markProcessing(recordId);

                const file = await this.storage.readIntoFile(fileUri);
                const result = await this.aiService.processFile(file, title);

                await this.recordService.finishProcessing(recordId, {
                    transcription: result.transcription,
                    title: result.title,
                    summary: result.summary,
                    durationSec: result.durationSec,
                    qualityScore: result.qualityScore,
                    tags: result.tags,
                    checkboxes: result.checkboxes,
                });

                syncLog("AI processing finished", { recordId });
            } catch (error) {
                const message = normalizeError(error);
                syncLog("AI processing failed", { recordId, message });

                try {
                    await this.recordService.failProcessing(recordId, message);
                } catch {
                    syncLog("failed to persist AI error", { recordId });
                }
            }
        })();
    }
}

const syncBodySchema = t.Object({
    startDate: t.String(),
    endDate: t.String(),
    limit: t.Optional(t.Number()),
    offset: t.Optional(t.Number()),
    maxPages: t.Optional(t.Number()),
    pollIntervalMs: t.Optional(t.Number()),
    maxAttempts: t.Optional(t.Number()),
    downloadRecordings: t.Optional(t.Boolean()),
});

const mangoUserLinkBodySchema = t.Object({
    userId: t.Union([t.Number(), t.Null()]),
});

export const mangoSyncPlugin = (
    mangoClient: MangoClient,
    recordService: RecordService,
    userService: UserService,
    storage: IStorage,
    aiService: RecordAiService,
) => {
    const syncService = new MangoPollingSyncService(
        mangoClient,
        recordService,
        userService,
        storage,
        aiService,
    );

    return new Elysia({ prefix: "/integrations/mango" })
        .use(guardPlugin(userService))
        .get("/users/candidates", async (context: ProtectedContext) => {
            const forbidden = assertDirector(context.userRole, context.set);
            if (forbidden) return forbidden;

            try {
                return {
                    items: await syncService.buildDirectoryRows(),
                };
            } catch (error) {
                context.set.status = 500;
                return {
                    message: normalizeError(error),
                };
            }
        })
        .patch(
            "/users/:mangoUserId/link",
            async (
                context: ProtectedContext & {
                    params: { mangoUserId: string };
                    body: Static<typeof mangoUserLinkBodySchema>;
                },
            ) => {
                const forbidden = assertDirector(context.userRole, context.set);
                if (forbidden) return forbidden;

                const mangoUserId = Number(context.params.mangoUserId);

                if (!Number.isInteger(mangoUserId) || mangoUserId <= 0) {
                    context.set.status = 400;
                    return { message: "Invalid mango user id" };
                }

                if (context.body.userId === null) {
                    const current =
                        await userService.getUserByMangoUserId(mangoUserId);

                    if (current) {
                        await userService.setMangoUserId(current.id, null);
                    }

                    return {
                        ok: true,
                        mangoUserId,
                        linkedUserId: null,
                    };
                }

                const targetUser = await userService.getUserById(
                    context.body.userId,
                );

                if (!targetUser) {
                    context.set.status = 404;
                    return { message: "User not found" };
                }

                const existing =
                    await userService.getUserByMangoUserId(mangoUserId);

                if (existing && existing.id !== targetUser.id) {
                    await userService.setMangoUserId(existing.id, null);
                }

                await userService.setMangoUserId(targetUser.id, mangoUserId);

                const linkedCount =
                    await recordService.assignUnownedMangoRecordsToUser(
                        mangoUserId,
                        targetUser.id,
                    );

                return {
                    ok: true,
                    mangoUserId,
                    linkedUserId: targetUser.id,
                    linkedCount,
                };
            },
            {
                params: t.Object({
                    mangoUserId: t.String(),
                }),
                body: mangoUserLinkBodySchema,
            },
        )
        .post(
            "/sync",
            async (
                context: ProtectedContext & {
                    body: Static<typeof syncBodySchema>;
                },
            ) => {
                const forbidden = assertDirector(context.userRole, context.set);
                if (forbidden) return forbidden;

                syncLog("manual sync requested", {
                    actorUserId: context.userId,
                    body: context.body,
                });

                try {
                    return await syncService.syncCalls(context.body);
                } catch (error) {
                    context.set.status = 500;
                    return {
                        message: normalizeError(error),
                    };
                }
            },
            {
                body: syncBodySchema,
            },
        )
        .post("/sync/users/refresh", async (context: ProtectedContext) => {
            const forbidden = assertDirector(context.userRole, context.set);
            if (forbidden) return forbidden;

            syncLog("users refresh requested", {
                actorUserId: context.userId,
            });

            try {
                return await syncService.refreshUsersDirectory();
            } catch (error) {
                context.set.status = 500;
                return {
                    message: normalizeError(error),
                };
            }
        });
};

export { MangoPollingSyncService };
