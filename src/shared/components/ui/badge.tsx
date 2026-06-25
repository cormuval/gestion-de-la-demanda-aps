import { cn } from "@/shared/lib/utils";

type BadgeVariant = "default" | "warning" | "muted" | "success";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
                variant === "default" && "bg-primary/10 text-primary",
                variant === "warning" && "bg-secondary/20 text-secondary-foreground",
                variant === "muted" && "bg-muted text-muted-foreground",
                variant === "success" && "bg-accent/15 text-accent",
                className
            )}
            {...props}
        />
    );
}
