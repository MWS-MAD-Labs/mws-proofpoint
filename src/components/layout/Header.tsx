"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  User,
  LogOut,
  ClipboardList,
  Users,
  Building2,
  FileText,
  Shield,
  LayoutDashboard,
  ChevronDown,
  Moon,
  Sun,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const pathname = usePathname();
  const { user, profile, isAdmin, isManager, isDirector, signOut } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme from localStorage or document
    const savedTheme = localStorage.getItem("theme");
    const isDarkMode = savedTheme
      ? savedTheme === "dark"
      : document.documentElement.classList.contains("dark");

    setIsDark(isDarkMode);

    // Ensure class is applied if it was missing
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);

    if (newIsDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const isActive = (path: string) => pathname === path;

  const navItems = [
    {
      path: "/assessment",
      label: "Self-Assessment",
      icon: ClipboardList,
      show: true,
    },
    {
      path: "/manager",
      label: "Team",
      icon: Users,
      show: isManager || isAdmin,
    },
    {
      path: "/director",
      label: "Organization",
      icon: Building2,
      show: isDirector || isAdmin,
    },
    {
      path: "/rubrics",
      label: "Rubrics",
      icon: FileText,
      show: isManager || isDirector || isAdmin,
    },
    {
      path: "/admin",
      label: "Admin",
      icon: Shield,
      show: isAdmin,
    },
  ].filter((item) => item.show);

  return (
    <header
      className={cn(
        "h-16 border-b border-border/50 glass-panel-strong sticky top-0 z-50",
        className,
      )}
    >
      <div className="container h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="shrink-0">
          <Logo />
        </Link>

        {/* Nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/30 backdrop-blur-sm">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 rounded-lg transition-all duration-300",
                      active
                        ? "bg-background/80 text-primary shadow-sm border border-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        active ? "text-primary" : "",
                      )}
                    />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 hover:border-primary/30 transition-all duration-300"
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-amber-500 transition-transform hover:rotate-12" />
            ) : (
              <Moon className="h-5 w-5 text-primary transition-transform hover:-rotate-12" />
            )}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 px-3 py-2 h-auto rounded-xl bg-muted/30 border border-border/30 hover:bg-muted/50 hover:border-primary/30 transition-all duration-300"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-foreground leading-none">
                      {profile?.full_name?.split(" ")[0] || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isAdmin
                        ? "Admin"
                        : isDirector
                          ? "Director"
                          : isManager
                            ? "Manager"
                            : "Staff"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 glass-panel-strong border-border/30 p-2"
              >
                {/* User Info */}
                <div className="px-3 py-3 rounded-lg bg-muted/30 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {profile?.full_name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.email}
                      </p>
                    </div>
                  </div>
                </div>

                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 p-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <LayoutDashboard className="h-4 w-4 text-foreground" />
                    </div>
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/profile" className="flex items-center gap-2 p-2">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <User className="h-4 w-4 text-foreground" />
                    </div>
                    <span>Profile Settings</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                  <Link href="/settings/notifications" className="flex items-center gap-2 p-2">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Settings className="h-4 w-4 text-foreground" />
                    </div>
                    <span>Notification Settings</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-2 bg-border/50" />

                <DropdownMenuItem
                  onClick={signOut}
                  className="rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <div className="flex items-center gap-2 p-1">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <LogOut className="h-4 w-4" />
                    </div>
                    <span>Sign Out</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button className="glow-primary hover:scale-105 transition-all duration-300">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
