import { useRef, useState } from "react"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import { recordsApi } from "~/axios/records"
import type { Record } from "~/types/record"

interface UseUploadRecord {
    inputRef: React.RefObject<HTMLInputElement | null>
    isUploading: boolean
    lastRecord: Record | null
    handleClick: () => void
    handleChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
}

export function useUploadRecord(): UseUploadRecord {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [lastRecord, setLastRecord] = useState<Record | null>(null)

    const handleClick = (): void => {
        inputRef.current?.click()
    }

    const handleChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ): Promise<void> => {
        const file = event.target.files?.[0]
        event.target.value = ""
        if (!file) return

        setIsUploading(true)
        try {
            const record = await recordsApi.upload(file)
            setLastRecord(record)
            toast.success(`Загружено: ${file.name}`)
        } catch (error) {
            const message = isAxiosError(error)
                ? (error.response?.data as { message?: string } | undefined)?.message
                : undefined
            toast.error(message ?? "Не удалось загрузить файл")
        } finally {
            setIsUploading(false)
        }
    }

    return { inputRef, isUploading, lastRecord, handleClick, handleChange }
}
