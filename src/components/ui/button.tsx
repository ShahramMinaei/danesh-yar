"use client";

import { CircleNotch } from "@phosphor-icons/react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "touch";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border border-accent bg-accent/12 text-accent-fg font-semibold hover:bg-accent/22 active:border-accent-hi active:bg-accent/24 active:text-accent-fg-2",
  secondary:
    "border border-fg/14 bg-transparent text-fg/80 font-medium hover:bg-fg/7 hover:border-fg/22 hover:text-fg",
  ghost: "border border-transparent bg-transparent text-fg/70 font-medium hover:bg-fg/7",
  danger: "border border-error bg-error/10 text-error font-semibold hover:bg-error/20",
  link: "border border-transparent bg-transparent text-accent font-medium hover:text-accent-hi px-0!",
};

const SIZES: Record<Size, string> = {
  sm: "h-[30px] px-2.5 text-[12px] gap-1.5 rounded-[8px]",
  md: "h-9 px-3.5 text-[13px] gap-[7px] rounded-[8px]",
  lg: "h-[46px] px-4 text-[13px] gap-[7px] rounded-[10px]",
  touch: "h-11 px-3 text-[12.5px] gap-1.5 rounded-[10px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-45 aria-busy:cursor-progress aria-busy:opacity-80",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <CircleNotch className="animate-spin text-[14px]" /> : icon}
      {children}
    </button>
  );
});

type IconSize = 24 | 28 | 30 | 32 | 34 | 36 | 44 | 46;

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: IconSize;
  tone?: "default" | "danger" | "success" | "bare";
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 34, tone = "default", active, className, children, style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      style={{ width: size, height: size, ...style }}
      className={cx(
        "grid shrink-0 place-items-center rounded-[8px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45",
        size >= 44 && "rounded-[10px]",
        size <= 24 && "rounded-[6px]",
        tone === "bare"
          ? "border-0 text-fg/45 hover:bg-fg/8 hover:text-fg/80"
          : active
            ? "border border-accent bg-accent/12 text-accent-hi"
            : "border border-fg/12 text-fg/60 hover:bg-fg/7 hover:text-fg/85",
        tone === "danger" && !active && "hover:bg-error/12! hover:text-error!",
        tone === "success" && !active && "hover:bg-success/10! hover:text-success!",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
