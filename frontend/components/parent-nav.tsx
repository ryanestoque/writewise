"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandIcon, BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
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
import { LogOut, Settings, Users, BookOpen, PenTool, ChevronDown, Check } from "lucide-react";
import { toast } from "@/components/ui/toast";
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
import { useScrolled } from "@/hooks/use-scrolled";

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
  const [supabase] = useState(createClient);
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
      toast.add({ type: "error", title: message });
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
  const childItems = linkedChildren.map((child) => ({
    value: child.id,
    label: `${child.fullName} (${child.section})`,
  }));
  const hasSubNav = pathname === "/progress";
  const isScrolled = useScrolled(16, !hasSubNav);

  return (
    <>
      <header
        data-scrolled={isScrolled}
        className={cn(
          "fixed top-0 left-0 right-0 z-40 h-14 bg-background print:hidden",
          !hasSubNav &&
            "border-b border-border transition-[border-color,box-shadow] duration-200 ease-out data-[scrolled=true]:border-border data-[scrolled=true]:shadow-warm"
        )}
      >
        <nav
          aria-label="Parent navigation"
          className="flex h-full w-full items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6"
        >
          {/* Left: Brand Logo (App icon on mobile, full logo on desktop) */}
          <Link
            href="/progress"
            className="flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-opacity hover:opacity-90 min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
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
                    items={childItems}
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
                      <SelectValue className="min-w-0">
                        {activeChild ? (
                          <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                            <span className="truncate font-semibold text-foreground">{activeChild.fullName}</span>
                            <span className="text-muted-foreground text-xs shrink-0">({activeChild.section})</span>
                          </span>
                        ) : (
                          "Select child"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="center" className="w-[280px]">
                      <SelectGroup>
                        {linkedChildren.map((child) => (
                          <SelectItem key={child.id} value={child.id} className="cursor-pointer text-sm">
                            <div className="flex flex-col text-left">
                              <span className="font-medium text-foreground">{child.fullName}</span>
                              <span className="text-xs text-muted-foreground">Section {child.section}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile Switcher: Bottom Sheet Drawer */}
                <div className="sm:hidden flex items-center min-w-0 w-full max-w-[min(280px,100%)]">
                  <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen} showSwipeHandle>
                    <DrawerTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={`Switch student profile, currently viewing ${activeChild?.fullName ?? "child"}`}
                          className="h-auto inline-flex items-center gap-1.5 w-full min-w-0 px-2.5 py-1 rounded-full text-xs font-medium bg-card hover:bg-muted/50 border-border/80 text-foreground shadow-warm-sm active:bg-muted cursor-pointer touch-manipulation min-h-11"
                        >
                          <Avatar size="sm" className="shrink-0">
                            <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs">
                              {activeChild ? getStudentInitials(activeChild.fullName) : "S"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate font-semibold text-xs min-w-0 flex-1 text-left">
                            {activeChild?.fullName}
                          </span>
                          <span className="text-muted-foreground text-xs shrink-0">
                            ({activeChild?.section})
                          </span>
                          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        </Button>
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
                            <Button
                              key={child.id}
                              type="button"
                              variant="outline"
                              aria-pressed={isSelected}
                              onClick={() => {
                                onChildChange(child.id);
                                setMobileDrawerOpen(false);
                              }}
                              className={cn(
                                "h-auto w-full flex items-center justify-between p-3 rounded-xl text-left font-normal cursor-pointer min-h-[52px] touch-manipulation",
                                isSelected
                                  ? "bg-primary/5 border-primary/40 hover:bg-primary/10 shadow-warm-sm"
                                  : "bg-card border-border/70 hover:bg-muted/40 active:bg-muted/70"
                              )}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <Avatar size="default" className="size-9 shrink-0">
                                  <AvatarFallback
                                    className={cn(
                                      "font-semibold text-xs",
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {childInitials}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="flex flex-col min-w-0">
                                  <span className="font-semibold text-sm text-foreground truncate">
                                    {child.fullName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Section {child.section}
                                  </span>
                                </span>
                              </span>
                              {isSelected && (
                                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0 ml-3">
                                  <Check className="size-3.5 stroke-[2.5]" aria-hidden="true" />
                                </span>
                              )}
                            </Button>
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
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-9 rounded-full cursor-pointer touch-manipulation"
                    aria-label={`Account menu for ${user.fullName}`}
                  />
                }
              >
                <Avatar className="size-full">
                  <AvatarFallback className="bg-secondary text-secondary-foreground font-semibold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 rounded-2xl p-1.5 shadow-warm border border-border/80 bg-popover"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal p-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-9 rounded-xl after:rounded-xl shrink-0">
                        <AvatarFallback className="rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
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
                      <BookOpen aria-hidden="true" />
                      <span>Score Guide</span>
                    </DropdownMenuItem>
                  )}
                  {onOpenCursiveGuide && (
                    <DropdownMenuItem
                      onClick={() => onOpenCursiveGuide()}
                      className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                    >
                      <PenTool aria-hidden="true" />
                      <span>Cursive Guide</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    render={<Link href="/parent-settings" />}
                    className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm"
                  >
                    <Settings aria-hidden="true" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => setShowSignOutDialog(true)}
                    className="cursor-pointer gap-2 py-2 min-h-10 sm:min-h-9 text-sm text-destructive focus:text-destructive"
                  >
                    <LogOut aria-hidden="true" />
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
            >
              {isSigningOut ? (
                <>
                  <Spinner data-icon="inline-start" aria-hidden="true" />
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
