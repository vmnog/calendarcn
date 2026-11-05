import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** The CalendarCN repository, for links to pull requests. */
const GITHUB_URL = "https://github.com/vmnog/calendarcn";

/** Avatar size requested from GitHub, in px (2x the rendered 16px). */
const AVATAR_SIZE = 32;

/** Link styles inside the badge: accent text, underlined on hover only. */
const CONTRIBUTOR_LINK_CLASS =
  "rounded-sm no-underline underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring";

interface DocsContributorProps {
  /** GitHub username, without the `@`. */
  handle: string;
  /** Number of the pull request that shipped the item. */
  pr: number;
  className?: string;
}

/**
 * Credit for a community contribution, in the brand red on the tint of the
 * current sidebar item:
 * the contributor's avatar and handle, linking to their profile, and the pull
 * request, linking to it. Sits at the end of a roadmap item.
 */
export function DocsContributor({
  handle,
  pr,
  className,
}: DocsContributorProps) {
  return (
    <span
      className={cn(
        "not-prose ms-1 inline-flex items-center gap-1.5 rounded-full bg-(--docs-nav-item-active) py-0.5 ps-0.5 pe-2 align-middle text-xs leading-5 font-medium text-(--docs-accent) ring-1 ring-(--docs-accent-line)",
        className,
      )}
    >
      <Avatar className="size-4">
        <AvatarImage
          src={`https://github.com/${handle}.png?size=${AVATAR_SIZE}`}
          alt=""
        />
        <AvatarFallback className="text-[0.5rem]">
          {handle.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span>
        Contributed by{" "}
        <a
          href={`https://github.com/${handle}`}
          className={CONTRIBUTOR_LINK_CLASS}
        >
          @{handle}
        </a>{" "}
        in{" "}
        <a href={`${GITHUB_URL}/pull/${pr}`} className={CONTRIBUTOR_LINK_CLASS}>
          #{pr}
        </a>
      </span>
    </span>
  );
}
