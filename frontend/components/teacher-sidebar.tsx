"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
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
  UploadCloudIcon,
  ChevronsUpDownIcon,
  GraduationCapIcon,
} from "lucide-react";
import { BrandIcon } from "@/components/brand-logo";
import { Kbd } from "@/components/ui/kbd";
import { useTeacherModals } from "@/components/teacher-modals-provider";
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
}

const classroomNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Class Roster", href: "/roster", icon: UsersIcon },
];

const assessmentNavItems: NavItem[] = [
  { title: "Activities", href: "/activities", icon: ClipboardListIcon },
];

interface TeacherSidebarProps {
  user: {
    fullName: string;
    email: string;
  };
  }

function getInitials(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z\s]/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeacherSidebar({ user }: TeacherSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const { openUpload, openRubric, openSignOut, uploadOpen, rubricOpen } =
    useTeacherModals();

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
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <Link
                  href="/dashboard"
                  id="nav-brand"
                  onClick={handleNavClick}
                  aria-current={pathname === "/dashboard" ? "page" : undefined}
                />
              }
              tooltip="WriteWise — Teacher Portal"
              className="h-13 group-data-[collapsible=icon]:p-0"
            >
              <div className="flex aspect-square size-8.5 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shadow-xs border border-brand-200/80 dark:border-brand-900/80 shrink-0">
                <BrandIcon className="size-4.5 text-primary" />
              </div>
              <div className="grid flex-1 min-w-0 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="font-heading font-bold text-sidebar-foreground tracking-tight text-[15px] truncate">
                  WriteWise
                </span>
                <span className="truncate text-xs text-muted-foreground font-medium">
                  Teacher Portal
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-2 px-1">
        {/* Primary Educator CTA: Upload Worksheet */}
        <div className="px-2 pt-1 pb-1 group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            onClick={() => {
              if (isMobile) setOpenMobile(false);
              openUpload();
            }}
            aria-haspopup="dialog"
            aria-expanded={uploadOpen}
            className="flex items-center justify-center gap-2 w-full h-9.5 px-3 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-medium text-xs shadow-xs hover:bg-sidebar-primary/90 transition-colors cursor-pointer group/cta focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
            id="quick-upload-worksheet"
          >
            <UploadCloudIcon className="size-4 shrink-0 transition-transform group-hover/cta:-translate-y-0.5" />
            <span>Upload Worksheet</span>
          </button>
        </div>

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
                  aria-label="Upload cursive worksheets (⌘K / Ctrl+K)"
                  aria-haspopup="dialog"
                  aria-expanded={uploadOpen}
                  className="flex aspect-square size-8.5 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-colors shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                />
              }
            >
              <UploadCloudIcon className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="right" align="center" className="flex items-center gap-1.5">
              <span>Upload & Scan Worksheets</span>
              <Kbd className="text-xs h-4.5 px-1 font-mono font-normal">⌘K</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <SidebarSeparator className="my-1 opacity-60" />

        {/* Group 1: Classroom Navigation */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2">
            Classroom
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {classroomNavItems.map((item) => {
                const isActive = isItemActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={item.href}
                          id={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={handleNavClick}
                        />
                      }
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-9.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Group 2: Assessment Navigation */}
        <SidebarGroup className="py-1">
          <SidebarGroupLabel className="text-xs font-semibold tracking-wider text-muted-foreground uppercase px-2">
            Assessment
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {assessmentNavItems.map((item) => {
                const isActive = isItemActive(item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={
                        <Link
                          href={item.href}
                          id={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          aria-current={isActive ? "page" : undefined}
                          onClick={handleNavClick}
                        />
                      }
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-9.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Rubric Guide Reference Modal Trigger */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    openRubric();
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={rubricOpen}
                  tooltip="Rubric Guide Reference (5 Diagnostic Criteria Modal)"
                  className="h-9.5 cursor-pointer"
                  id="open-rubric-guide"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BookOpenIcon className="size-4 shrink-0" />
                    <span className="truncate">Rubric Guide</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden mb-1 opacity-60" />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    tooltip={`${user.fullName} (${user.email})`}
                    aria-haspopup="menu"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-0 h-12"
                  />
                }
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs shrink-0 border border-brand-200/60 dark:border-brand-900/60">
                  {getInitials(user.fullName)}
                </div>
                <div className="grid flex-1 min-w-0 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium text-sidebar-foreground text-xs">
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
                className="w-64 rounded-2xl p-1.5 shadow-xl border border-border/80 bg-popover"
              >
                <div className="p-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200/60 shrink-0">
                      {getInitials(user.fullName)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-xs text-foreground truncate">
                        {user.fullName}
                      </span>
                      <span className="text-xs text-muted-foreground truncate" title={user.email}>
                        {user.email}
                      </span>
                      <span className="text-xs text-primary font-medium mt-0.5 flex items-center gap-1 truncate">
                        <GraduationCapIcon className="size-3.5 shrink-0" />
                        <span className="truncate">Matina Aplaya Elementary</span>
                      </span>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href="/settings" onClick={handleNavClick} />}
                    className="cursor-pointer gap-2 py-2 text-xs"
                  >
                    <SettingsIcon className="size-3.5 text-muted-foreground" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                    openSignOut();
                  }}
                  className="cursor-pointer gap-2 py-2 text-xs text-destructive focus:text-destructive"
                >
                  <LogOutIcon className="size-3.5" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
