"use client";

import { useState } from "react";
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
import { LogOut, Upload, User, Users } from "lucide-react";

interface ParentNavProps {
  user: { fullName: string; email: string };
  selectedChildId: string | null;
  linkedChildren: LinkedChild[];
  onChildChange: (childId: string) => void;
  onUploadClick?: () => void;
}

export function ParentNav({
  user,
  selectedChildId,
  linkedChildren,
  onChildChange,
  onUploadClick,
}: ParentNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const selectedChild = linkedChildren.find((c) => c.id === selectedChildId) ?? null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

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
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo size="sm" />
          </div>

          {/* Center: Child Switcher */}
          <div className="flex-1 flex justify-center min-w-0">
            {linkedChildren.length > 1 ? (
              <Select
                value={selectedChildId ?? undefined}
                onValueChange={(val) => {
                  if (val) onChildChange(val);
                }}
              >
                <SelectTrigger
                  className="w-auto min-w-[160px] max-w-[240px] sm:max-w-[320px] h-9 text-xs sm:text-sm font-medium gap-1.5 border-border/70 bg-card hover:bg-muted/40 transition-colors shadow-xs"
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
                        <span className="text-[11px] text-muted-foreground">{child.section}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedChild ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60 text-xs sm:text-sm font-medium text-foreground max-w-[260px] sm:max-w-none truncate">
                <User className="size-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                <span className="truncate">{selectedChild.fullName}</span>
                <span className="text-muted-foreground text-[11px] sm:text-xs shrink-0 font-normal">
                  ({selectedChild.section})
                </span>
              </div>
            ) : null}
          </div>

          {/* Right: Upload button + User menu */}
          <div className="flex items-center gap-2 shrink-0">
            {onUploadClick && (
              <Button
                variant="default"
                size="sm"
                className="h-10 sm:h-9 gap-1.5 shadow-warm font-medium cursor-pointer"
                onClick={onUploadClick}
                aria-label="Upload take-home worksheet"
              >
                <Upload className="size-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                className="size-10 sm:size-9 rounded-full inline-flex items-center justify-center font-semibold text-xs bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 hover:bg-brand-200/80 dark:hover:bg-brand-900/80 ring-1 ring-brand-700/20 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none transition-colors"
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
        <AlertDialogContent className="rounded-2xl shadow-warm border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-lg">Sign out?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              You will need to sign in again to view your child&apos;s handwriting progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-10 sm:h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="h-10 sm:h-9 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
