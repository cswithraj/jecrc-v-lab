import type { Role } from "@prisma/client";

export interface NavItem { href: string; label: string; icon: string; roles: Role[] }
const ALL: Role[] = ["SUPER_ADMIN", "HOD", "FACULTY", "STUDENT"];
const STAFF: Role[] = ["SUPER_ADMIN", "HOD", "FACULTY"];
const ADMIN: Role[] = ["SUPER_ADMIN", "HOD"];

export const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [
    { href: "/student", label: "Dashboard", icon: "layout-dashboard", roles: ["STUDENT"] },
    { href: "/faculty", label: "Faculty dashboard", icon: "layout-dashboard", roles: ["FACULTY", "HOD"] },
    { href: "/admin", label: "Admin dashboard", icon: "shield", roles: ADMIN },
    { href: "/notifications", label: "Notifications", icon: "bell", roles: ALL },
  ]},
  { section: "Laboratory", items: [
    { href: "/labs", label: "All laboratories", icon: "flask-conical", roles: ALL },
    { href: "/compiler", label: "Online compiler", icon: "terminal", roles: ALL },
    { href: "/practicals", label: "Practical sessions", icon: "timer", roles: ALL },
    { href: "/projects", label: "Projects", icon: "folder-kanban", roles: ALL },
    { href: "/results", label: "Results & ranking", icon: "trophy", roles: ALL },
  ]},
  { section: "Teaching", items: [
    { href: "/faculty/classes", label: "My classes", icon: "users", roles: STAFF },
    { href: "/faculty/question-bank", label: "Question bank", icon: "library", roles: STAFF },
    { href: "/faculty/review", label: "Review submissions", icon: "clipboard-check", roles: STAFF },
    { href: "/reports", label: "Reports & analytics", icon: "bar-chart-3", roles: STAFF },
  ]},
  { section: "Administration", items: [
    { href: "/admin/users", label: "Users", icon: "user-cog", roles: ADMIN },
    { href: "/admin/academics", label: "Academic structure", icon: "building-2", roles: ADMIN },
    { href: "/admin/subjects", label: "Laboratories & credits", icon: "book-open", roles: ADMIN },
    { href: "/admin/grading", label: "Grading policy", icon: "scale", roles: ADMIN },
    { href: "/admin/settings", label: "Platform settings", icon: "settings", roles: ["SUPER_ADMIN"] },
    { href: "/admin/audit", label: "Audit logs", icon: "scroll-text", roles: ADMIN },
  ]},
  { section: "Account", items: [
    { href: "/profile", label: "Profile & settings", icon: "user", roles: ALL },
  ]},
];
