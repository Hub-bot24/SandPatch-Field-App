import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface SharedProps {
  variant?: Variant;
  fullWidth?: boolean;
  icon?: ReactNode;
}

type ButtonAsButton = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

type ButtonProps = ButtonAsButton | ButtonAsLink;

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand text-brand-contrast active:bg-brand-dark disabled:bg-neutral-bg disabled:text-ink-muted",
  secondary:
    "bg-surface text-ink border-2 border-navy active:bg-neutral-bg disabled:border-border disabled:text-ink-muted",
  danger: "bg-poor text-white active:bg-poor/90 disabled:bg-neutral-bg disabled:text-ink-muted",
  ghost: "bg-transparent text-navy active:bg-neutral-bg disabled:text-ink-muted",
};

/**
 * Large touch-target control (min 56px tall) for outdoor, gloved-hand use.
 * Pass `href` to render a same-looking navigation link instead of a
 * button - never nest this inside a `<Link>` yourself: a `<button>` inside
 * an `<a>` is invalid HTML and confuses screen readers.
 */
export function Button({ variant = "primary", fullWidth = false, icon, className = "", children, ...rest }: ButtonProps) {
  const classes = `inline-flex min-h-14 items-center justify-center gap-2 rounded-xl px-5 text-lg font-semibold tracking-tight transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${fullWidth ? "w-full" : ""} ${className}`;

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest as Omit<ButtonAsLink, keyof SharedProps>;
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {icon}
      {children}
    </button>
  );
}
