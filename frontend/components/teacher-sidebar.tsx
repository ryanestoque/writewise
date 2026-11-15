"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  UsersIcon,
  ClipboardListIcon,
  SettingsIcon,
  LogOutIcon,
  BookOpenIcon,
  ScaleIcon,
  PenLineIcon,
  FileUpIcon,
  ChevronsUpDownIcon,
  KeyboardIcon,
  GraduationCapIcon,
} from "lucide-react";
import { BrandIcon, BrandLogo } from "@/components/brand-logo";
import { Kbd } from "@/components/ui/kbd";
import { useTeacherModals } from "@/components/teacher-modals-provider";
import { useShortcutKeys } from "@/hooks/use-shortcut-keys";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "activities";
}

const classroomNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Class Roster", href: "/roster", icon: UsersIcon },
  { title: "Activities", href: "/activities", icon: ClipboardListIcon, badgeKey: "activities" },
  { title: "Gradebook", href: "/gradebook", icon: BookOpenIcon },
];

interface TeacherSidebarProps {
  user: {
    fullName: string;
    email: string;
    schoolName?: string;
  };
  pendingSubmissionsCount?: number;
}

function getInitials(name: string): string {
  const honorifics = /^(teacher|ma'?am|sir|bb|gng|mr|mrs|ms|dr|prof|sr|fr|rev)\.?\s+/i;
  const stripped = name.replace(honorifics, "").trim();
  const cleaned = (stripped || name).replace(/[^\p{L}\s]/gu, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeacherSidebar({ user, pendingSubmissionsCount }: TeacherSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { modifierKey, altKey } = useShortcutKeys();

  const {
    openUpload,
    openRubric,
    openCursiveGuide,
    openSignOut,
    openShortcuts,
    uploadOpen,
    rubricOpen,
    cursiveGuideOpen,
    shortcutsOpen,
  } = useTeacherModals();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isItemActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <Sidebar id="teacher-sidebar" variant="floating" collapsible="icon">
      <SidebarHeader className="h-16 justify-center p-2 group-data-[collapsible=icon]:h-14">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              id="nav-brand"
              size="lg"
              render={
                <Link
                  href="/dashboard"
                  onClick={handleNavClick}
                  aria-label="WriteWise Dashboard"
                />
              }
              tooltip="WriteWise — Teacher Dashboard"
              className="h-12 px-2 py-0 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
            >
              {/* Collapsed Icon: centered mark in rail mode */}
              <div className="hidden group-data-[collapsible=icon]:flex aspect-square size-8 items-center justify-center rounded-lg bg-card border border-border/80 shadow-xs shrink-0 overflow-hidden p-0.5">
                <BrandIcon className="size-full object-contain" />
              </div>

              {/* Expanded view: full wordmark. */}
              <div className="flex min-w-0 items-center group-data-[collapsible=icon]:hidden">
                <BrandLogo
                  size="sm"
                  variant="logo"
                  imageClassName="h-11 w-auto"
                  priority
                />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1">
        {/* Primary Educator CTA: Upload Worksheet (Quick action outside nav landmark) */}
        <div className="flex flex-col gap-1">
          <div className="px-2 pt-1 group-data-[collapsible=icon]:hidden">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      openUpload();
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={uploadOpen}
                    aria-keyshortcuts="Control+K Meta+K"
                    className="flex items-center justify-center gap-2 w-full h-11 md:h-10 px-4 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-medium text-sm shadow-xs hover:bg-sidebar-primary/90 transition-colors cursor-pointer group/cta focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                    id="quick-upload-worksheet"
                  />
                }
              >
                <FileUpIcon className="size-4 shrink-0" aria-hidden="true" />
                <span>Upload Worksheet</span>
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="flex items-center gap-1.5">
                <span>Upload Worksheet</span>
                <Kbd aria-hidden="true" className="text-xs h-5 px-1 font-mono font-normal">
                  {modifierKey}+K
                </Kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Actionable Pending Grading Queue Entry Point */}
          {typeof pendingSubmissionsCount === "number" && pendingSubmissionsCount > 0 && (
            <div className="px-2 group-data-[collapsible=icon]:hidden">
              <Link
                href="/activities"
                id="queue-pending-review"
                onClick={handleNavClick}
                className="flex items-center justify-between w-full h-8 px-2.5 rounded-lg bg-brand-50 hover:bg-brand-100/90 dark:bg-brand-950/50 dark:hover:bg-brand-900/50 border border-brand-200/70 dark:border-brand-900/70 text-brand-900 dark:text-brand-200 text-xs font-medium transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className="size-1.5 rounded-full bg-brand-600 dark:bg-brand-400 shrink-0" aria-hidden="true" />
                  <span className="truncate">{pendingSubmissionsCount} pending review</span>
                </span>
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 shrink-0 ml-1">
                  Grade &rarr;
                </span>
              </Link>
            </div>
          )}

          <div className="hidden group-data-[collapsible=icon]:flex justify-center pt-1 pb-1 px-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      openUpload();
                    }}
                    aria-label="Upload Worksheet"
                    aria-haspopup="dialog"
                    aria-expanded={uploadOpen}
                    aria-keyshortcuts="Control+K Meta+K"
                    className="flex aspect-square size-10 md:size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-colors shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                  />
                }
              >
                <FileUpIcon className="size-4" aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center" className="flex items-center gap-1.5">
                <span>Upload Worksheet</span>
                <Kbd aria-hidden="true" className="text-xs h-5 px-1 font-mono font-normal">{modifierKey}+K</Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <SidebarSeparator className="my-1 bg-border/60" />

        {/* Unified Teacher Navigation Landmark per docs/DESIGN.md §5 */}
        <nav aria-label="Teacher navigation" className="flex flex-col">
          {/* Group 1: Classroom Navigation */}
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2">
              Classroom
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {classroomNavItems.map((item) => {
                  const isActive = isItemActive(item.href);
                  const showBadge =
                    item.badgeKey === "activities" &&
                    typeof pendingSubmissionsCount === "number" &&
                    pendingSubmissionsCount > 0;
                  const displayCount =
                    typeof pendingSubmissionsCount === "number" && pendingSubmissionsCount > 99
                      ? "99+"
                      : pendingSubmissionsCount;

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        id={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        render={
                          <Link
                            href={item.href}
                            aria-current={isActive ? "page" : undefined}
                            onClick={handleNavClick}
                          />
                        }
                        isActive={isActive}
                        tooltip={
                          showBadge
                            ? `${item.title} (${displayCount} pending)`
                            : item.title
                        }
                        className={cn(
                          "h-11 md:h-10 text-sm font-medium transition-colors relative",
                          isActive &&
                            "bg-brand-50 text-brand-900 font-semibold dark:bg-brand-950/60 dark:text-brand-100"
                        )}
                      >
                        <div className="flex items-center justify-between w-full min-w-0">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative flex items-center justify-center shrink-0">
                              <item.icon className="size-4 shrink-0" aria-hidden="true" />
                              {showBadge && (
                                <span
                                  className="hidden group-data-[collapsible=icon]:flex absolute -top-1.5 -right-2 min-w-4 h-4 px-1 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold tabular-nums leading-none ring-2 ring-sidebar shadow-xs"
                                  aria-hidden="true"
                                >
                                  {displayCount}
                                </span>
                              )}
                            </div>
                            <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                          </div>
                          {showBadge && (
                            <span
                              className="ml-auto group-data-[collapsible=icon]:hidden inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-xs font-semibold tabular-nums bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/60"
                              aria-label={`${pendingSubmissionsCount} pending submissions`}
                            >
                              <span aria-hidden="true">{displayCount}</span>
                            </span>
                          )}
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Delineating separator: provides critical chunking in collapsed rail mode */}
          <SidebarSeparator className="my-1 bg-border/60" />

          {/* Group 2: Dedicated Pedagogical Reference Utility Guides */}
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2">
              Reference
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Cursive Alphabet Guide Modal Trigger */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      openCursiveGuide();
                    }}
                    isActive={false}
                    aria-haspopup="dialog"
                    aria-expanded={cursiveGuideOpen}
                    aria-controls={cursiveGuideOpen ? "cursive-guide-dialog" : undefined}
                    aria-label="Cursive Guide (On-screen Reference Modal)"
                    tooltip={{
                      children: (
                        <div className="flex items-center gap-1.5">
                          <span>Cursive Guide · Reference</span>
                          <Kbd aria-hidden="true" className="text-xs h-5 px-1 font-mono font-normal">{altKey}+C</Kbd>
                        </div>
                      ),
                    }}
                    className={cn(
                      "h-11 md:h-10 text-sm font-medium cursor-pointer transition-colors group-data-[collapsible=icon]:rounded-lg",
                      cursiveGuideOpen
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold ring-1 ring-border/80 shadow-xs"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                    )}
                    id="open-cursive-guide"
                  >
                    <div className="flex items-center justify-between w-full min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PenLineIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-sidebar-foreground" aria-hidden="true" />
                        <span className="truncate group-data-[collapsible=icon]:hidden">Cursive Guide</span>
                      </div>
                      <Kbd aria-hidden="true" className="hidden text-xs h-5 px-1.5 font-mono font-medium text-muted-foreground bg-muted/80 border border-border/50 shrink-0 md:inline-flex group-data-[collapsible=icon]:hidden">
                        {altKey}+C
                      </Kbd>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* Scoring Rubric Reference Modal Trigger */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      openRubric();
                    }}
                    isActive={false}
                    aria-haspopup="dialog"
                    aria-expanded={rubricOpen}
                    aria-controls={rubricOpen ? "rubric-reference-dialog" : undefined}
                    aria-label="Scoring Rubric (On-screen Reference Modal)"
                    tooltip={{
                      children: (
                        <div className="flex items-center gap-1.5">
                          <span>Scoring Rubric · Reference</span>
                          <Kbd aria-hidden="true" className="text-xs h-5 px-1 font-mono font-normal">{altKey}+R</Kbd>
                        </div>
                      ),
                    }}
                    className={cn(
                      "h-11 md:h-10 text-sm font-medium cursor-pointer transition-colors group-data-[collapsible=icon]:rounded-lg",
                      rubricOpen
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold ring-1 ring-border/80 shadow-xs"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
                    )}
                    id="open-rubric-guide"
                  >
                    <div className="flex items-center justify-between w-full min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ScaleIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-sidebar-foreground" aria-hidden="true" />
                        <span className="truncate group-data-[collapsible=icon]:hidden">Scoring Rubric</span>
                      </div>
                      <Kbd aria-hidden="true" className="hidden text-xs h-5 px-1.5 font-mono font-medium text-muted-foreground bg-muted/80 border border-border/50 shrink-0 md:inline-flex group-data-[collapsible=icon]:hidden">
                        {altKey}+R
                      </Kbd>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden mb-1 bg-border/60" />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    isActive={isItemActive("/settings")}
                    tooltip="Teacher Profile & Settings"
                    aria-label={`User account menu for ${user.fullName}`}
                    aria-haspopup="menu"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-0 h-12 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center cursor-pointer"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs shrink-0 border border-brand-200/60 dark:border-brand-900/60">
                  {getInitials(user.fullName)}
                </div>
                <div className="grid flex-1 min-w-0 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium text-sidebar-foreground text-sm">
                    {user.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" title={user.email}>
                    {user.email}
                  </span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                side="top"
                align="start"
                sideOffset={8}
                className="w-64 max-h-[calc(100vh-80px)] overflow-y-auto rounded-xl p-1.5 shadow-xl border border-border/80 bg-popover"
              >
                <div className="p-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200/60 dark:border-brand-900/60 shrink-0">
                      {getInitials(user.fullName)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {user.fullName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate" title={user.email}>
                        {user.email}
                      </span>
                      {user.schoolName && (
                        <span className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1.5 truncate">
                          <GraduationCapIcon className="size-3.5 shrink-0 text-primary/80" aria-hidden="true" />
                          <span className="truncate">{user.schoolName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href="/settings" onClick={handleNavClick} aria-current={isItemActive("/settings") ? "page" : undefined} />}
                    className="min-h-10 cursor-pointer gap-2 py-2 text-xs md:min-h-0"
                  >
                    <SettingsIcon className="size-3.5 text-muted-foreground" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    id="open-keyboard-shortcuts"
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      openShortcuts();
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={shortcutsOpen}
                    className="min-h-10 cursor-pointer gap-2 py-2 text-xs md:min-h-0"
                  >
                    <KeyboardIcon className="size-3.5 text-muted-foreground" />
                    <span>Keyboard shortcuts</span>
                    <Kbd aria-hidden="true" className="ml-auto">?</Kbd>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    openSignOut();
                  }}
                  className="min-h-10 cursor-pointer gap-2 py-2 text-xs text-muted-foreground hover:text-foreground focus:text-foreground md:min-h-0"
                >
                  <LogOutIcon className="size-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail aria-controls="teacher-sidebar" />
    </Sidebar>
  );
}
