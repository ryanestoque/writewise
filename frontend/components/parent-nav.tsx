"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
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
import { Loader2, LogOut, Settings, Upload, Users } from "lucide-react";
import { toast } from "sonner";

interface ParentNavProps {
  user: { fullName: string; email: string };
  selectedChildId: string | null;
  linkedChildren: LinkedChild[];
  onChildChange: (childId: string) => void;
  onUploadClick?: () => void;
  hasActivities?: boolean;
}

export function ParentNav({
  user,
  selectedChildId,
  linkedChildren,
  onChildChange,
  onUploadClick,
  hasActivities = false,
}: ParentNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        err instanceof Error
          ? err.message
          : "Failed to sign out. Please check your connection and try again.";
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <nav
          aria-label="Parent navigation"
          className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6"
        >
          {/* Left: Brand Logo */}
          <Link
            href="/progress"
            className="flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-opacity hover:opacity-90"
            aria-label="WriteWise Parent Portal Home"
          >
            <BrandLogo size="sm" />
          </Link>

          {/* Center: Child Switcher (multi-child only) */}
          <div className="flex-1 flex justify-center min-w-0 px-1 sm:px-2">
            {linkedChildren.length > 1 && (
              <Select
                value={selectedChildId ?? undefined}
                onValueChange={(val) => {
                  if (val) onChildChange(val);
                }}
              >
                <SelectTrigger
                  className="w-auto min-w-0 max-w-[170px] sm:max-w-[320px] h-10 sm:h-9 text-xs sm:text-sm font-medium gap-1.5 border-border/70 bg-card hover:bg-muted/40 transition-colors shadow-xs truncate"
                  aria-label="Select child"
                >
                  <Users className="size-3.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent align="center" className="w-[240px] sm:w-[280px]">
                  {linkedChildren.map((child) => (
                    <SelectItem key={child.id} value={child.id} className="cursor-pointer text-xs sm:text-sm">
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-foreground">{child.fullName}</span>
                        <span className="text-xs text-muted-foreground">{child.section}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Right: Upload utility button + User menu */}
          <div className="flex items-center gap-2 shrink-0">
            {onUploadClick && hasActivities && (
              <Button
                variant="outline"
                size="sm"
                className="h-11 sm:h-9 min-h-[44px] sm:min-h-[36px] px-3 sm:px-2.5 gap-1.5 font-medium border-border/80 hover:bg-muted/50 text-foreground cursor-pointer shadow-2xs touch-manipulation"
                onClick={onUploadClick}
                aria-label="Upload take-home worksheet"
              >
                <Upload className="size-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                className="size-11 sm:size-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-full inline-flex items-center justify-center font-semibold text-xs bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 hover:bg-brand-200/80 dark:hover:bg-brand-900/80 ring-1 ring-brand-700/25 dark:ring-brand-400/25 border border-brand-200/60 dark:border-brand-800/60 shadow-2xs cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all touch-manipulation"
                aria-label={`User menu for ${user.fullName}`}
              >
                {initials}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 shadow-warm">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href="/parent-settings" />}
                    className="cursor-pointer gap-2"
                  >
                    <Settings className="size-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => setShowSignOutDialog(true)}
                    className="text-destructive focus:text-destructive cursor-pointer gap-2"
                  >
                    <LogOut className="size-4" />
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
