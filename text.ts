import crypto from "node:crypto";

const apiKey = "vmie3up6uz7xf2p04rnqsci1ztwo2sub";
const salt = "riumw65saoajbsil0lytavlsh55cf838";

const payload = {
  ext_fields: [
    "general.user_id",
    "general.login",
    "general.mobile",
    "general.sips",
    "groups",
    "general.access_role_id",
  ],
};

const json = JSON.stringify(payload);
const sign = crypto
  .createHash("sha256")
  .update(apiKey + json + salt)
  .digest("hex");

const body = new URLSearchParams({
  vpbx_api_key: apiKey,
  sign,
  json,
});

const res = await fetch("https://app.mango-office.ru/vpbx/config/users/request", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body,
});

console.log(await res.text());
