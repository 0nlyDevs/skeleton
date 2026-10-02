"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { forwardRef, useCallback, useRef, type ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * `next/link` without viewport prefetching.
 *
 * By default Next prefetches every link that scrolls into view: a feed page
 * fires dozens of requests at once. The contest host serves an account about
 * nine requests at a time and answers the rest with a 500 after ten seconds,
 * so those bursts made pages fail at random. Here a route is prefetched only
 * on intent (pointer over it, touch, or keyboard focus): one request, just
 * before the click, which keeps navigation instant without the burst.
 */
const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { prefetch, href, onPointerEnter, onTouchStart, onFocus, ...props },
  ref,
) {
  const router = useRouter();
  const done = useRef(false);
  const target = typeof href === "string" ? href : (href.pathname ?? null);

  const warm = useCallback(() => {
    if (done.current || prefetch === false || !target || !target.startsWith("/") || target.startsWith("//")) return;
    done.current = true;
    router.prefetch(typeof href === "string" ? href : target);
  }, [href, prefetch, router, target]);

  return (
    <NextLink
      ref={ref}
      href={href}
      prefetch={false}
      onPointerEnter={(event) => {
        warm();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        warm();
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        warm();
        onFocus?.(event);
      }}
      {...props}
    />
  );
});

export default Link;
