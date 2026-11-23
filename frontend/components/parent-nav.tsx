"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandIcon, BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { createClient } from "@/lib/supabase/client";
import type { LinkedChild } from "@/lib/hooks/use-parent-data";
import { Loader2, LogOut, Settings, Users, BookOpen, PenTool, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

function getStudentInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S"
  );
}

interface ParentNavProps {
  user: { id: string; fullName: string; email: string };
  selectedChildId: string | null;
  linkedChildren: LinkedChild[];
  onChildChange: (childId: string) => void;
  onOpenRubric?: () => void;
  onOpenCursiveGuide?: () => void;
}

export function ParentNav({
  user,
  selectedChildId,
  linkedChildren,
  onChildChange,
  onOpenRubric,
  onOpenCursiveGuide,
}: ParentNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      setShowSignOutDialog(false);
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      console.error("Sign out error:", err);
      const message =
        "We couldn't sign you out. Please check your connection and try again.";
      toast.error(message);
      setIsSigningOut(false);
    }
  }

  const initials =
    user.fullName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  const activeChild = linkedChildren.find((c) => c.id === selectedChildId);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 bg-background",
          pathname !== "/progress" && "border-b border-border"
        )}
      >
        <nav
          aria-label="Parent navigation"
          className="flex h-14 w-full items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6"
        >
          {/* Left: Brand Logo (App icon on mobile, full logo on desktop) */}
          <Link
            href="/progress"
            className="flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-opacity hover:opacity-90 min-h-[40px] min-w-[40px]"
            aria-label="WriteWise Parent Portal Home"
          >
            <div className="flex sm:hidden size-8 items-center justify-center rounded-lg overflow-hidden shrink-0 border border-border/60">
              <BrandIcon size={32} className="size-full object-contain" priority />
            </div>
            <BrandLogo size="sm" priority className="hidden sm:inline-flex" />
          </Link>

          {/* Center: Child Switcher (only shown when linked to multiple children) */}
          <div className="flex flex-1 justify-center min-w-0 px-1 sm:px-2">
            {pathname === "/progress" && linkedChildren.length > 1 ? (
              <>
                {/* Desktop Switcher: Standard Select Dropdown */}
                <div className="hidden sm:block">
                  <Select
                    value={selectedChildId ?? undefined}
                    onValueChange={(val) => {
                      if (val) onChildChange(val);
                    }}
                  >
                    <SelectTrigger
                      className="w-auto min-w-0 max-w-[340px] h-9 text-xs sm:text-sm font-medium gap-1.5 border-border/70 bg-card hover:bg-muted/40 transition-colors shadow-warm-sm"
                      aria-label="Switch child profile"
                    >
                      <Users className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                      <SelectValue placeholder="Select child" className="min-w-0">
                        {activeChild ? (
                          <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                            <span className="truncate font-semibold text-foreground">{activeChild.fullName}</span>
                            <span className="text-muted-foreground text-xs shrink-0">({activeChild.section})</span>
                          </span>
                        ) : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="center" className="w-[280px]">
                      {linkedChildren.map((child) => (
                        <SelectItem key={child.id} value={child.id} className="cursor-pointer text-sm">
                          <div className="flex flex-col text-left">
                            <span className="font-medium text-foreground">{child.fullName}</span>
                            <span className="text-xs text-muted-foreground">Section {child.section}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile Switcher: Bottom Sheet Drawer */}
                <div className="sm:hidden flex items-center min-w-0 max-w-[190px]">
                  <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen} showSwipeHandle>
                    <DrawerTrigger
                      render={
                        <button
                          type="button"
                          aria-label={`Switch student profile, currently viewing ${activeChild?.fullName ?? "child"}`}
                          className="inline-flex items-center gap-1.5 w-full min-w-0 px-2.5 py-1 rounded-full text-xs font-medium bg-card hover:bg-muted/50 border border-border/80 text-foreground shadow-warm-sm active:bg-muted transition-colors cursor-pointer touch-manipulation min-h-8"
                        >
                          <span className="flex size-4.5 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold text-[9px] shrink-0">
                            {activeChild ? getStudentInitials(activeChild.fullName) : "S"}
                          </span>
                          <span className="truncate font-semibold text-xs min-w-0 flex-1 text-left">
                            {activeChild?.fullName}
                          </span>
                          <span className="text-muted-foreground text-[11px] shrink-0">
                            ({activeChild?.section})
                          </span>
                          <ChevronDown className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
                        </button>
                      }
                    />
                    <DrawerContent className="max-h-[80dvh] px-4 pb-6 pt-3 flex flex-col">
                      <DrawerHeader className="text-left pb-3 pt-2 px-1 border-b border-border/60 shrink-0">
                        <DrawerTitle className="font-heading text-base font-semibold text-foreground">
                          Switch student
                        </DrawerTitle>
                        <DrawerDescription className="text-xs text-muted-foreground">
                          Choose which child&apos;s handwriting activities and progress to view.
                        </DrawerDescription>
                      </DrawerHeader>

                      <div className="flex flex-col gap-2 pt-3 pb-1 overflow-y-auto">
                        {linkedChildren.map((child) => {
                          const isSelected = child.id === selectedChildId;
                          const childInitials = getStudentInitials(child.fullName);

                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => {
                                onChildChange(child.id);
                                setMobileDrawerOpen(false);
                              }}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[52px] touch-manipulation",
                                isSelected
                                  ? "bg-brand-50/80 border-brand-500/50 dark:bg-brand-950/50 dark:border-brand-500/40 shadow-warm-sm"
                                  : "bg-card border-border/70 hover:bg-muted/40 active:bg-muted/70"
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "flex size-9 items-center justify-center rounded-full font-bold text-xs shrink-0",
                                    isSelected
                                      ? "bg-brand-700 text-white dark:bg-brand-600 shadow-xs"
                                      : "bg-muted text-muted-foreground border border-border/60"
                                  )}
                                >
                                  {childInitials}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-sm text-foreground truncate">
                                    {child.fullName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Section {child.section}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className="flex size-6 items-center justify-center rounded-full bg-brand-700 text-white dark:bg-brand-600 shrink-0 ml-3">
                                  <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </DrawerContent>
                  </Drawer>
                </div>
              </>
            ) : null}
          </div>

          {/* Right: Notifications + Account & Help Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NotificationBell key={user.id} userId={user.id} role="parent" />

            <DropdownMenu>
              <DropdownMenuTrigger
                className="size-10 sm:size-9 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 rounded-full inline-flex items-center justify-center font-semibold text-xs bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 hover:bg-brand-200/80 dark:hover:bg-brand-900/80 border border-brand-200 dark:border-brand-800 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none transition-colors touch-manipulation"
                aria-label={`Account menu for ${user.fullName}`}
              >
                {initials}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-2xl p-1.5 shadow-warm border border-border/80 bg-popover"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200/60 dark:border-brand-900/60 shrink-0">
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate" title={user.email}>{user.email}</p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {onOpenRubric && (
                    <DropdownMenuItem
                      onClick={() => onOpenRubric()}
                      className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                    >
                      <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>Rubrics</span>
                    </DropdownMenuItem>
                  )}
                  {onOpenCursiveGuide && (
                    <DropdownMenuItem
                      onClick={() => onOpenCursiveGuide()}
                      className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                    >
                      <PenTool className="size-4 text-muted-foreground" aria-hidden="true" />
                      <span>Cursive Guide</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    render={<Link href="/parent-settings" />}
                    className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                  >
                    <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => setShowSignOutDialog(true)}
                    className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm text-destructive focus:text-destructive"
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </header>

      {/* Sign-out confirmation dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of WriteWise?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to view your child&apos;s handwriting progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              id="confirm-parent-sign-out"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="gap-2"
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
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
