import { zodResolver } from "@hookform/resolvers/zod"
import { isAxiosError } from "axios"
import { AudioLines, CheckCircle2, Loader2, Upload, X } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate } from "react-router"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { recordsApi } from "~/axios/records"
import { PageHeader } from "~/components/layout"
import { Button } from "~/components/ui/button"
import { Field } from "~/components/ui/field"
import { Input } from "~/components/ui/input"
import { cn } from "~/lib/cn"
import { RECORDS_KEY } from "~/hooks/useRecords"

const uploadSchema = z.object({
    title: z.string().trim().optional(),
    callTo: z.string().trim().optional(),
})

type UploadSchema = z.infer<typeof uploadSchema>

export default function UploadPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const inputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm<UploadSchema>({
        resolver: zodResolver(uploadSchema),
        defaultValues: { title: "", callTo: "" },
    })

    const handleFile = (f: File) => {
        if (!f.type.startsWith("audio/") && !f.name.endsWith(".mp3")) {
            toast.error("Поддерживаются только аудиофайлы (mp3)")
            return
        }
        setFile(f)
    }

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
        const dropped = e.dataTransfer.files[0]
        if (dropped) handleFile(dropped)
    }, [])

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => setIsDragging(false)

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        e.target.value = ""
        if (f) handleFile(f)
    }

    const onSubmit = async (data: UploadSchema): Promise<void> => {
        if (!file) {
            toast.error("Выберите аудиофайл")
            return
        }

        setIsUploading(true)
        try {
            await recordsApi.upload({
                file,
                title: data.title || undefined,
                callTo: data.callTo || undefined,
            })
            await queryClient.invalidateQueries({ queryKey: RECORDS_KEY })
            toast.success("Файл загружен и поставлен в очередь обработки")
            navigate("/calls")
        } catch (error) {
            const message = isAxiosError(error)
                ? (error.response?.data as { message?: string } | undefined)?.message
                : undefined
            toast.error(message ?? "Не удалось загрузить файл")
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div>
            <PageHeader title="Загрузить звонок" description="Добавьте аудиозапись звонка для AI-обработки" />

            <div className="max-w-lg">
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => !file && inputRef.current?.click()}
                        className={cn(
                            "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                            file
                                ? "border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800/40"
                                : isDragging
                                    ? "border-neutral-500 bg-neutral-100 dark:border-neutral-400 dark:bg-neutral-800/60 cursor-copy"
                                    : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-500 dark:hover:bg-neutral-800/40 cursor-pointer",
                        )}
                    >
                        {file ? (
                            <>
                                <CheckCircle2 className="size-8 text-green-500 mb-3" />
                                <p className="text-sm font-medium">{file.name}</p>
                                <p className="mt-1 text-xs text-neutral-400">
                                    {(file.size / 1024 / 1024).toFixed(2)} МБ
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                                    className="mt-3 flex items-center gap-1 text-xs text-red-600/70 hover:text-red-700 dark:text-red-500/70 dark:hover:text-red-400"
                                >
                                    <X className="size-3.5" />
                                    Удалить
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                                    <AudioLines className="size-5 text-neutral-500" />
                                </div>
                                <p className="mt-4 text-sm font-medium">Перетащите файл сюда</p>
                                <p className="mt-1 text-xs text-neutral-400">или нажмите для выбора</p>
                                <p className="mt-2 text-[10px] text-neutral-300 dark:text-neutral-600">MP3, WAV, M4A и другие аудиоформаты</p>
                            </>
                        )}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="audio/*,.mp3"
                            className="hidden"
                            onChange={handleInputChange}
                        />
                    </div>

                    <Field label="Название звонка" htmlFor="title" error={errors.title?.message}>
                        <Input
                            id="title"
                            placeholder="Оставьте пустым — система сгенерирует автоматически"
                            {...register("title")}
                        />
                    </Field>

                    <Field label="Контрагент" htmlFor="callTo" error={errors.callTo?.message}>
                        <Input
                            id="callTo"
                            placeholder="Название компании или имя клиента"
                            {...register("callTo")}
                        />
                    </Field>

                    <div className="flex gap-3 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate("/calls")}
                            disabled={isUploading}
                        >
                            Отмена
                        </Button>
                        <Button type="submit" disabled={isUploading || !file} className="gap-2">
                            {isUploading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Загрузка…
                                </>
                            ) : (
                                <>
                                    <Upload className="size-4" />
                                    Загрузить
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
