#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";

const API_BASE = "https://app.mango-office.ru/vpbx";

// Ключ можно держать здесь для теста.
const MANGO_API_KEY = "vmie3up6uz7xf2p04rnqsci1ztwo2sub";

// Соль лучше не светить в коде/чатах/репозиториях.
// Вставь локально то значение, которое у тебя есть.
const MANGO_API_SALT = "riumw65saoajbsil0lytavlsh55cf838";

// Период не больше 1 месяца.
// Формат Mango: DD.MM.YYYY HH:mm:ss
const START_DATE = "01.04.2026 00:00:00";
const END_DATE = "25.04.2026 23:59:59";

const LIMIT = 100;
const OFFSET = 0;

function signPayload(jsonString) {
  return crypto
    .createHash("sha256")
    .update(MANGO_API_KEY + jsonString + MANGO_API_SALT)
    .digest("hex");
}

async function mangoPost(path, payload) {
  const json = JSON.stringify(payload);
  const sign = signPayload(json);

  const body = new URLSearchParams({
    vpbx_api_key: MANGO_API_KEY,
    sign,
    json,
  });

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestCallsReport() {
  const payload = {
    start_date: START_DATE,
    end_date: END_DATE,
    limit: LIMIT,
    offset: OFFSET,

    // Опциональные фильтры:
    // context_type: 1,   // 1 входящие, 2 исходящие, 3 внутренние
    // context_status: 1, // 1 успешные, 0 неуспешные
    // search_string: "7495", // минимум 3 символа
  };

  console.log("Requesting calls report...");
  const response = await mangoPost("/stats/calls/request", payload);

  console.log("request response:", JSON.stringify(response, null, 2));

  if (!response || !response.key) {
    throw new Error(`No report key in response: ${JSON.stringify(response)}`);
  }

  return response.key;
}

async function getCallsReportResult(key) {
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Polling result attempt ${attempt}/${maxAttempts}...`);

    const response = await mangoPost("/stats/calls/result", { key });

    console.log("result response preview:", JSON.stringify(response, null, 2).slice(0, 1000));

    // Обычно итоговый ответ содержит status/data.
    // Делаем проверку гибкой, чтобы увидеть реальный ответ от твоего аккаунта.
    if (response && typeof response === "object") {
      if (response.result && response.result !== 1000) {
        throw new Error(`Mango returned error: ${JSON.stringify(response, null, 2)}`);
      }

      if (response.status === "complete" || response.data || response.calls) {
        return response;
      }
    }

    await sleep(3000);
  }

  throw new Error("Report was not ready in time");
}

function flattenCalls(report) {
  // Частый формат расширенной статистики: data = [{ period, list: [...] }]
  if (Array.isArray(report.data)) {
    return report.data.flatMap((day) =>
      Array.isArray(day.list)
        ? day.list.map((call) => ({ period: day.period, ...call }))
        : []
    );
  }

  if (Array.isArray(report.calls)) return report.calls;

  return [];
}

async function main() {
  if (MANGO_API_SALT === "PASTE_YOUR_SALT_HERE") {
    throw new Error("Вставь MANGO_API_SALT в код перед запуском");
  }

  const key = await requestCallsReport();
  const report = await getCallsReportResult(key);
  const calls = flattenCalls(report);

  const output = {
    fetched_at: new Date().toISOString(),
    query: {
      start_date: START_DATE,
      end_date: END_DATE,
      limit: LIMIT,
      offset: OFFSET,
    },
    total_calls: calls.length,
    calls,
    raw: report,
  };

  await fs.writeFile("mango-calls-test.json", JSON.stringify(output, null, 2), "utf8");

  console.log(`Saved ${calls.length} calls to mango-calls-test.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
