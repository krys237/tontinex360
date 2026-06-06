import Image from "next/image";
import Link from "next/link";

interface Props {
  /** "full" = logo + wordmark | "icon" = juste le pictogramme rond */
  variant?: "full" | "icon";
  /** Hauteur en px */
  size?: number;
  /** Wrap dans Link href */
  href?: string;
  className?: string;
  priority?: boolean;
}

/**
 * Logo officiel TontineX360 — utilise les PNG dans /public/logo/
 *
 * Mobile-parity : même asset que le mobile pour cohérence cross-platform.
 *
 * <BrandLogo variant="full" size={40} href="/" />
 */
export function BrandLogo({ variant = "full", size = 40, href, className, priority }: Props) {
  // Ratios extraits des PNG sources
  // logo-full.png est environ 3:1 (large) — logo-icon.png est carré 1:1
  const isFull = variant === "full";
  const width = isFull ? size * 3 : size;
  const height = size;

  const img = (
    <Image
      src={isFull ? "/logo/logo-full.png" : "/logo/logo-icon.png"}
      alt="TontineX360"
      width={width}
      height={height}
      priority={priority}
      style={{ height, width: "auto", objectFit: "contain" }}
      className={className}
    />
  );

  if (href) {
    return (
      <Link href={href} aria-label="TontineX360 — Accueil" className="inline-block">
        {img}
      </Link>
    );
  }
  return img;
}
