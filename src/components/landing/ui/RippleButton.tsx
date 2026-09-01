"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

export function RippleButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const [ripples, setRipples] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);

  const onPointer = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [
      ...r,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
    window.setTimeout(() => {
      setRipples((r) => r.filter((x) => x.id !== id));
    }, 900);
  }, []);

  return (
    <Link
      href={href}
      className="ripple-btn"
      onMouseEnter={onPointer}
      onClick={onPointer}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-wave"
          style={{
            left: r.x - 20,
            top: r.y - 20,
            width: 40,
            height: 40,
          }}
        />
      ))}
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </Link>
  );
}
