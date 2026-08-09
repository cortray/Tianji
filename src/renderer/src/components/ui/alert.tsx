import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current",
        warning:
          "border-amber-500/40 bg-amber-50 text-amber-900 *:data-[slot=alert-description]:text-amber-800/90 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:*:data-[slot=alert-description]:text-amber-300/90",
        success:
          "border-emerald-500/40 bg-emerald-50 text-emerald-900 *:data-[slot=alert-description]:text-emerald-800/90 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:*:data-[slot=alert-description]:text-emerald-300/90",
        info: "border-sky-500/40 bg-sky-50 text-sky-900 *:data-[slot=alert-description]:text-sky-800/90 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:*:data-[slot=alert-description]:text-sky-300/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
