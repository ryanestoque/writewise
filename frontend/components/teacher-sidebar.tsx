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
  PlusCircleIcon,
} from "lucide-react";
import { BrandIcon } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { RubricReferenceDialog } from "@/components/rubric-reference-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Roster", href: "/roster", icon: UsersIcon },
  { title: "Activities", href: "/activities", icon: ClipboardListIcon },
  { title: "Settings", href: "/settings", icon: SettingsIcon },
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
        <SidebarHeader>
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
                tooltip="WriteWise"
                className="h-14 group-data-[collapsible=icon]:p-0"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-xs">
                  <BrandIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="font-heading font-semibold text-sidebar-foreground truncate">
                    WriteWise
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Teacher Portal
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            {/* Quick Action CTA */}
            <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
              <Link
                href="/activities"
                onClick={handleNavClick}
                className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-medium text-xs shadow-xs hover:bg-sidebar-primary/90 transition-colors"
                id="quick-new-activity"
              >
                <PlusCircleIcon className="size-4" />
                <span>New Activity</span>
              </Link>
            </div>

            <div className="hidden group-data-[collapsible=icon]:flex justify-center pb-2 px-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/activities"
                      onClick={handleNavClick}
                      aria-label="Create new activity"
                      className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-colors shadow-xs"
                    />
                  }
                >
                  <PlusCircleIcon className="size-4" />
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  New Activity
                </TooltipContent>
              </Tooltip>
            </div>

            <SidebarGroupContent>
              <nav aria-label="Teacher navigation">
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = isItemActive(item.href);
                    const count =
                      item.title === "Activities"
                        ? badgeCounts?.activities
                        : item.title === "Roster"
                          ? badgeCounts?.roster
                          : item.badge;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={
                            <Link
                              href={item.href}
                              id={`nav-${item.title.toLowerCase()}`}
                              aria-current={isActive ? "page" : undefined}
                              onClick={handleNavClick}
                            />
                          }
                          isActive={isActive}
                          tooltip={item.title}
                          className="h-10 md:h-9 justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0">
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
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
          <SidebarMenu>
            {/* Rubric Guide Helper */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setRubricOpen(true)}
                tooltip="Rubric Guide"
                className="h-10 md:h-9 text-muted-foreground hover:text-sidebar-foreground cursor-pointer"
                id="open-rubric-guide"
              >
                <BookOpenIcon className="size-4" />
                <span>Rubric Guide</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Expanded user display */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-medium text-xs">
                  {getInitials(user.fullName)}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-sm font-medium text-sidebar-foreground">
                    {user.fullName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </SidebarMenuItem>

            {/* Collapsed icon user avatar */}
            <SidebarMenuItem className="hidden group-data-[collapsible=icon]:flex justify-center py-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div
                      tabIndex={0}
                      role="img"
                      aria-label={`Logged in as ${user.fullName} (${user.email})`}
                      className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-medium text-xs cursor-default outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    />
                  }
                >
                  {getInitials(user.fullName)}
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  <div>
                    <p className="font-medium text-xs">{user.fullName}</p>
                    <p className="text-[11px] text-muted-foreground">{user.email}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </SidebarMenuItem>

            {/* Sign out */}
            <SidebarMenuItem>
              <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
                <AlertDialogTrigger
                  render={
                    <SidebarMenuButton
                      id="sign-out"
                      tooltip="Sign out"
                      className="h-10 md:h-9"
                    />
                  }
                >
                  <LogOutIcon className="size-4" />
                  <span>Sign out</span>
                </AlertDialogTrigger>
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* Handwriting Rubric Modal */}
      <RubricReferenceDialog open={rubricOpen} onOpenChange={setRubricOpen} />
    </>
  );
}
