#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";

const API_BASE = "https://app.mango-office.ru/vpbx";

// Подставь свои значения локально.
const MANGO_API_KEY = "vmie3up6uz7xf2p04rnqsci1ztwo2sub";
const MANGO_API_SALT = "riumw65saoajbsil0lytavlsh55cf838";

// recording_id возьми из статистики звонков или из /events/record/added.
const RECORDING_ID = "MjY0NTY4NjA1MDI=";

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function buildForm(payload) {
  const json = JSON.stringify(payload);
  const sign = sha256(MANGO_API_KEY + json + MANGO_API_SALT);

  return new URLSearchParams({
    vpbx_api_key: MANGO_API_KEY,
    sign,
    json,
  });
}

async function requestRecordingRedirect(recordingId) {
  const body = buildForm({
    recording_id: recordingId,
    action: "download",
  });

  // redirect: "manual" нужен, чтобы забрать Location самому.
  const res = await fetch(`${API_BASE}/queries/recording/post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "manual",
  });

  if (res.status !== 302) {
    const text = await res.text();
    throw new Error(`Expected 302 redirect, got HTTP ${res.status}: ${text}`);
  }

  const location = res.headers.get("location");

  if (!location) {
    throw new Error("No Location header in Mango response");
  }

  return location;
}

async function downloadFile(url, outputPath) {
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to download file: HTTP ${res.status}: ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

async function main() {
  if (MANGO_API_KEY.includes("YOUR_") || MANGO_API_SALT.includes("YOUR_")) {
    throw new Error("Заполни MANGO_API_KEY и MANGO_API_SALT");
  }

  if (RECORDING_ID === "PASTE_RECORDING_ID_HERE") {
    throw new Error("Укажи RECORDING_ID");
  }

  const fileUrl = await requestRecordingRedirect(RECORDING_ID);
  console.log("Temporary file URL received");

  const output = `${RECORDING_ID.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp3`;
  await downloadFile(fileUrl, output);

  console.log(`Saved recording to ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
