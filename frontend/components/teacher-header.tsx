"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
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

const routeTitles: Record<string, string> = {
  dashboard: "Dashboard",
  roster: "Class Roster",
  activities: "Handwriting Activities",
  settings: "Account Settings",
};

export function TeacherHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const primarySegment = segments[0] || "dashboard";
  const primaryTitle = routeTitles[primarySegment] || primarySegment;
  const isSubRoute = segments.length > 1;

  let subTitle = "";
  if (isSubRoute) {
    if (primarySegment === "roster") {
      subTitle = "Student Profile";
    } else if (primarySegment === "activities") {
      subTitle = "Activity Details";
    } else {
      subTitle = segments[1];
    }
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur-xs px-4 sm:px-6">
      <div className="flex items-center gap-2 min-w-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <SidebarTrigger
                className="-ml-1 text-muted-foreground hover:text-foreground"
                id="sidebar-toggle"
                aria-label="Toggle sidebar (Ctrl+B / ⌘B)"
              />
            }
          />
          <TooltipContent side="bottom" align="start">
            <span className="flex items-center gap-1.5">
              Toggle sidebar <Kbd>⌘B</Kbd>
            </span>
          </TooltipContent>
        </Tooltip>

        <Breadcrumb className="truncate">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink
                render={<Link href="/dashboard" />}
                className="text-xs"
              >
                WriteWise
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />

            {isSubRoute ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    render={<Link href={`/${primarySegment}`} />}
                    className="text-xs"
                  >
                    {primaryTitle}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-medium truncate max-w-[160px] sm:max-w-[240px]">
                    {subTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs font-medium">
                  {primaryTitle}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
