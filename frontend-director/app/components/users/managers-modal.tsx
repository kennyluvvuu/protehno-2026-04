import { Users } from "lucide-react";
import { useNavigate } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useUsers } from "~/hooks/useUsers";
import type { User } from "~/types/auth";

interface ManagersModalProps {
  open: boolean;
  onClose: () => void;
  currentUserId: number;
}

function ManagerRow({ user, onClick }: { user: User; onClick: () => void }) {
  const displayName = user.fio ?? user.name;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        {displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        <p className="truncate text-xs text-neutral-400">{user.email}</p>
      </div>
      <span className="text-xs text-neutral-300 dark:text-neutral-600">→</span>
    </button>
  );
}

export function ManagersModal({
  open,
  onClose,
  currentUserId,
}: ManagersModalProps) {
  const navigate = useNavigate();
  const { data: users = [] } = useUsers();
  const managers = users.filter((u) => u.id !== currentUserId);

  const handleClick = (id: number): void => {
    onClose();
    navigate(`/users/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[min(440px,calc(100%-2rem))] max-w-none p-0 gap-0 [&>button:last-child]:hidden">
        <DialogHeader className="border-b border-neutral-200 dark:border-neutral-800 px-5 py-4">
          <DialogTitle className="text-base font-semibold">
            Менеджеры
            <span className="ml-2 text-sm font-normal text-neutral-400">
              {managers.length}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {managers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Users className="size-8 text-neutral-300" />
              <p className="text-sm text-neutral-500">Нет менеджеров</p>
            </div>
          ) : (
            managers.map((u) => (
              <ManagerRow
                key={u.id}
                user={u}
                onClick={() => handleClick(u.id)}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
