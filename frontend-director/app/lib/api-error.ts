import { AxiosError, isAxiosError } from "axios"

interface ErrorResponsePayload {
  message?: string
}

function readServerMessage(error: AxiosError<ErrorResponsePayload>): string | null {
  const payload = error.response?.data
  if (!payload || typeof payload !== "object") return null
  const message = payload.message
  return typeof message === "string" && message.trim() ? message : null
}

export function getHttpStatus(error: unknown): number | null {
  if (!isAxiosError(error)) return null
  return error.response?.status ?? null
}

export function isRateLimitStatus(status: number | null): boolean {
  return status === 429
}

export function getApiErrorMessage(error: unknown, fallback = "Произошла ошибка"): string {
  if (!isAxiosError<ErrorResponsePayload>(error)) {
    if (error instanceof Error && error.message.trim()) return error.message
    return fallback
  }

  if (error.code === "ECONNABORTED") {
    return "Сервер не ответил вовремя. Попробуйте ещё раз."
  }

  if (!error.response) {
    return "Нет соединения с сервером. Проверьте сеть и повторите попытку."
  }

  const status = error.response.status
  const serverMessage = readServerMessage(error)

  if (status === 429) {
    return serverMessage ?? "Слишком много запросов. Подождите немного и повторите."
  }

  if (serverMessage) return serverMessage

  if (status === 400) return "Неверный запрос. Проверьте введённые данные."
  if (status === 401) return "Сессия истекла. Войдите снова."
  if (status === 403) return "Недостаточно прав для выполнения действия."
  if (status === 404) return "Запрошенный ресурс не найден."
  if (status === 408) return "Время ожидания истекло. Повторите попытку."
  if (status === 409) return "Конфликт данных. Обновите страницу и попробуйте снова."
  if (status === 413) return "Слишком большой объём данных для отправки."
  if (status === 415) return "Неподдерживаемый формат данных."
  if (status === 422) return "Данные не прошли проверку. Исправьте поля и повторите."
  if (status >= 500) return "Ошибка сервера. Попробуйте позже."

  return fallback
}
