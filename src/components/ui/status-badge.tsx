import { cn } from "@/lib/utils";

type Status = 'pending' | 'running' | 'success' | 'partial' | 'failed';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground border-border',
  },
  running: {
    label: 'Running',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  success: {
    label: 'Success',
    className: 'bg-success/10 text-success border-success/20',
  },
  partial: {
    label: 'Partial',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  failed: {
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
