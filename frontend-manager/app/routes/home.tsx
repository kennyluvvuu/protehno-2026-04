import { Upload, AudioLines } from "lucide-react"
import { PageHeader } from "~/components/layout"
import { Button } from "~/components/ui/button"
import { useUploadRecord } from "~/hooks/useUploadRecord"

export default function Home() {
    const { inputRef, isUploading, lastRecord, handleClick, handleChange } =
        useUploadRecord()

    return (
        <>
            <PageHeader
                title="Главная"
                description="Загрузите аудио, чтобы добавить новую запись"
                actions={
                    <Button
                        onClick={handleClick}
                        isLoading={isUploading}
                        disabled={isUploading}
                    >
                        <Upload className="size-4" />
                        {isUploading ? "Загрузка…" : "Загрузить"}
                    </Button>
                }
            />

            <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleChange}
            />

            {lastRecord ? (
                <div className="flex items-start gap-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-900">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)] dark:bg-neutral-900">
                        <AudioLines className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Запись #{lastRecord.id}</p>
                        <p className="truncate text-xs text-neutral-500">
                            {lastRecord.fileUri}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 px-6 py-16 text-center dark:border-neutral-800">
                    <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-900">
                        <AudioLines className="size-5" />
                    </div>
                    <p className="mt-4 text-sm font-medium">Пока ничего нет</p>
                    <p className="mt-1 max-w-xs text-xs text-neutral-500">
                        Нажмите «Загрузить», чтобы добавить первую аудиозапись
                    </p>
                </div>
            )}
        </>
    )
}
