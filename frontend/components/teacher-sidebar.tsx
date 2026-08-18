"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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
  Loader2Icon,
  BookOpenIcon,
  UploadCloudIcon,
  ChevronsUpDownIcon,
  GraduationCapIcon,
  KeyboardIcon,
  SparklesIcon,
} from "lucide-react";
import { BrandIcon } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import { QuickUploadDialog } from "@/components/quick-upload-dialog";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  badgeKey?: "activities" | "roster";
  tag?: string;
}

const classroomNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Class Roster", href: "/roster", icon: UsersIcon, badgeKey: "roster" },
];

const assessmentNavItems: NavItem[] = [
  { title: "Activities", href: "/activities", icon: ClipboardListIcon, badgeKey: "activities" },
];

interface TeacherSidebarProps {
  user: {
    fullName: string;
    email: string;
  };
  badgeCounts?: {
    activities?: number | string;
    roster?: number | string;
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TeacherSidebar({ user, badgeCounts }: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setSignOutOpen(false);
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      console.error("Sign out error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to sign out. Please check your connection and try again.";
      toast.error(message);
      setIsSigningOut(false);
    }
  }

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
    <>
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
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="font-heading font-bold text-sidebar-foreground tracking-tight text-[15px]">
                    WriteWise
                  </span>
                  <span className="truncate text-xs text-muted-foreground font-medium">
                    Grade 3 Teacher Portal
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="gap-2 px-1">
          {/* Primary Educator CTA: Upload / Scan Worksheets */}
          <div className="px-2 pt-1 pb-1 group-data-[collapsible=icon]:hidden">
            <button
              type="button"
              onClick={() => {
                if (isMobile) setOpenMobile(false);
                setUploadOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={uploadOpen}
              className="flex items-center justify-between gap-2 w-full h-9.5 px-3 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-medium text-xs shadow-xs hover:bg-sidebar-primary/90 transition-all cursor-pointer group/cta focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
              id="quick-upload-worksheet"
            >
              <div className="flex items-center gap-2">
                <UploadCloudIcon className="size-4 shrink-0 transition-transform group-hover/cta:-translate-y-0.5" />
                <span>Upload Worksheets</span>
              </div>
              <span className="text-[10px] font-normal opacity-85 bg-black/15 dark:bg-white/15 px-1.5 py-0.5 rounded-md">
                Scan
              </span>
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
                      setUploadOpen(true);
                    }}
                    aria-label="Upload cursive worksheets"
                    aria-haspopup="dialog"
                    aria-expanded={uploadOpen}
                    className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-colors shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
                  />
                }
              >
                <UploadCloudIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                Upload & Scan Worksheets
              </TooltipContent>
            </Tooltip>
          </div>

          <SidebarSeparator className="my-1 opacity-60" />

          {/* Group 1: Classroom Navigation */}
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase px-2">
              Classroom
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {classroomNavItems.map((item) => {
                  const isActive = isItemActive(item.href);
                  const count = item.badgeKey ? badgeCounts?.[item.badgeKey] : undefined;

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
                        className="h-9.5 justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </div>
                        {count !== undefined && (
                          <Badge
                            variant="secondary"
                            className="group-data-[collapsible=icon]:hidden text-[10px] h-4.5 px-1.5 font-medium bg-sidebar-accent text-sidebar-accent-foreground border-transparent"
                          >
                            {count}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Group 2: Assessments & Diagnostics */}
          <SidebarGroup className="py-1">
            <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase px-2">
              Assessment
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {assessmentNavItems.map((item) => {
                  const isActive = isItemActive(item.href);
                  const count = item.badgeKey ? badgeCounts?.[item.badgeKey] : undefined;

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
                        className="h-9.5 justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <item.icon className="size-4 shrink-0" />
                          <span className="truncate">{item.title}</span>
                        </div>
                        {count !== undefined && (
                          <Badge
                            variant="secondary"
                            className="group-data-[collapsible=icon]:hidden text-[10px] h-4.5 px-1.5 font-medium bg-sidebar-accent text-sidebar-accent-foreground border-transparent"
                          >
                            {count}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}

                {/* Rubric Guide Reference Modal Trigger */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      setRubricOpen(true);
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={rubricOpen}
                    tooltip="Handwriting Rubric Guide (5 Criteria Modal)"
                    className="h-9.5 justify-between cursor-pointer text-muted-foreground hover:text-sidebar-foreground transition-colors group/rubric"
                    id="open-rubric-guide"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BookOpenIcon className="size-4 shrink-0 text-primary/80 group-hover/rubric:text-primary transition-colors" />
                      <span className="truncate font-normal group-hover/rubric:font-medium">Rubric Guide</span>
                    </div>
                    <Badge
                      variant="outline"
                      className="group-data-[collapsible=icon]:hidden text-[10px] h-4.5 px-1.5 font-normal border-primary/25 text-primary bg-primary/5 flex items-center gap-1"
                    >
                      <SparklesIcon className="size-2.5 shrink-0" />
                      <span>5 Criteria</span>
                    </Badge>
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
                      className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground group-data-[collapsible=icon]:p-0 h-12"
                    />
                  }
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs shrink-0 border border-brand-200/60 dark:border-brand-900/60">
                    {getInitials(user.fullName)}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium text-sidebar-foreground text-xs">
                      {user.fullName}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground/80 group-data-[collapsible=icon]:hidden" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  side="top"
                  align="start"
                  sideOffset={8}
                  className="w-64 rounded-2xl p-1.5 shadow-xl border border-border/80 bg-popover"
                >
                  <div className="p-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200/60 shrink-0">
                        {getInitials(user.fullName)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {user.fullName}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {user.email}
                        </span>
                        <span className="text-[10px] text-primary font-medium mt-0.5 flex items-center gap-1 truncate">
                          <GraduationCapIcon className="size-3 shrink-0" />
                          Matina Aplaya Elementary
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
                    <DropdownMenuItem
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                        setRubricOpen(true);
                      }}
                      className="cursor-pointer gap-2 py-2 text-xs"
                    >
                      <BookOpenIcon className="size-3.5 text-muted-foreground" />
                      <span>Rubric Reference</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (isMobile) setOpenMobile(false);
                        setShortcutsOpen(true);
                      }}
                      className="cursor-pointer gap-2 py-2 text-xs"
                    >
                      <KeyboardIcon className="size-3.5 text-muted-foreground" />
                      <span>Keyboard Shortcuts</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      if (isMobile) setOpenMobile(false);
                      setSignOutOpen(true);
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

      {/* Quick Worksheet Upload Modal */}
      <QuickUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* Handwriting Rubric Modal */}
      <RubricReferenceDialog open={rubricOpen} onOpenChange={setRubricOpen} />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Sign Out Confirmation Alert Dialog */}
      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of WriteWise?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access the teacher portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              id="confirm-sign-out"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="gap-2"
            >
              {isSigningOut ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                  <span>Signing out...</span>
                </>
              ) : (
                "Sign out"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
