import { cn } from "@/shared/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
    return (
        <select
            className={cn(
                "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
}
