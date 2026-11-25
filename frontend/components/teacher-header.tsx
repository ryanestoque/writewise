"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";

const routeTitles: Record<string, string> = {
  dashboard: "Dashboard",
  roster: "Class Roster",
  activities: "Handwriting Activities",
  gradebook: "Gradebook",
  settings: "Account Settings",
};

export function TeacherHeader({ userId }: { userId: string }) {
  const pathname = usePathname();
  const { modifierKey } = useShortcutKeys();
  const { isMobile, open, openMobile } = useSidebar();
  const sidebarToggleLabel = isMobile
    ? openMobile ? "Close navigation" : "Open navigation"
    : open ? "Collapse sidebar" : "Expand sidebar";
  const segments = pathname.split("/").filter(Boolean);

  const primarySegment = segments[0] || "dashboard";
  const primaryTitle = routeTitles[primarySegment] || primarySegment;
  const isSubRoute = segments.length > 1;

  let subTitle = "";
  if (isSubRoute) {
    if (primarySegment === "roster") {
      subTitle = "Student Profile";
    } else if (primarySegment === "activities") {
      subTitle =
        segments.length > 2 && segments[2] === "submissions"
          ? "Submission Detail"
          : "Activity Details";
    } else {
      subTitle = segments[1];
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur-xs px-4 sm:px-6">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                className="-ml-1 size-10 text-muted-foreground hover:text-foreground md:size-9 shrink-0"
                id="sidebar-toggle"
                aria-controls="teacher-sidebar"
                aria-keyshortcuts="Control+B Meta+B"
              />
            }
          />
          <TooltipContent side="bottom" align="start">
            <span className="flex items-center gap-1.5">
              {sidebarToggleLabel} <Kbd>{modifierKey}+B</Kbd>
            </span>
          </TooltipContent>
        </Tooltip>

        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="hidden sm:inline-flex shrink-0">
              <BreadcrumbLink
                render={<Link href="/dashboard" />}
                className="text-xs whitespace-nowrap"
              >
                WriteWise
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex shrink-0" />

            {isSubRoute ? (
              <>
                <BreadcrumbItem className="hidden sm:inline-flex shrink-0">
                  <BreadcrumbLink
                    render={<Link href={`/${primarySegment}`} />}
                    className="text-xs whitespace-nowrap"
                  >
                    {primaryTitle}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:inline-flex shrink-0" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="text-sm font-medium sm:text-xs truncate">
                    {subTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem className="min-w-0">
                <BreadcrumbPage className="text-sm font-medium sm:text-xs truncate">
                  {primaryTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <NotificationBell key={userId} userId={userId} role="teacher" />
    </header>
  );
}
