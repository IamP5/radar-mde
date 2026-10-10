import Link from "next/link";
import type { ComponentProps } from "react";
import type { ButtonSize, ButtonVariant } from "@/components/arc/button/button";
import styles from "@/components/arc/button/button.module.css";
import { cn } from "@/lib/utils";

type Props = ComponentProps<"a"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  prefetch?: boolean;
  /** A plain anchor, for downloads, other origins, and routes that are not pages. */
  external?: boolean;
};

/** A link that looks like Arc's Button: navigation stays a link for assistive tech and the browser. */
export function ButtonLink({ variant = "secondary", size = "sm", external = false, className, children, ...props }: Props) {
  const classes = cn(styles.button, styles[variant], styles[size], "no-underline", className);
  const label = <span className={styles.labelPhase}>{children}</span>;
  if (external) return <a {...props} className={classes}>{label}</a>;
  return <Link {...props} className={classes}>{label}</Link>;
}
