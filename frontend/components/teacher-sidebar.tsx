"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
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
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  UsersIcon,
  ClipboardListIcon,
  SettingsIcon,
  LogOutIcon,
  PenToolIcon,
} from "lucide-react";
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

const navItems = [
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
}

export function TeacherSidebar({ user }: TeacherSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/dashboard" id="nav-brand" />}
              tooltip="WriteWise"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <PenToolIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="font-heading font-semibold text-primary truncate">
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
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} id={`nav-${item.title.toLowerCase()}`} />}
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="flex flex-col gap-0.5 px-2 py-1.5">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user.fullName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <SidebarMenuButton id="sign-out" tooltip="Sign out" />
                }
              >
                <LogOutIcon />
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
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>
                    Sign out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
