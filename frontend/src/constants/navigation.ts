import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import type { SvgIconComponent } from "@mui/icons-material";

export interface NavigationItem {
  title: string;
  path: string;
  icon: SvgIconComponent;
  /** Operator-only pages: hidden from client users, and their routes redirect. */
  adminOnly?: boolean;
}

// Names match the board: a screen is a screen, and the home page answers "what is on right now".
export const navigationItems: NavigationItem[] = [
  { title: "Now", path: "/", icon: DashboardRoundedIcon },
  { title: "Screens", path: "/devices", icon: TvRoundedIcon },
  { title: "Media", path: "/media", icon: PermMediaRoundedIcon },
  { title: "Playlists", path: "/playlists", icon: PlaylistPlayRoundedIcon },
  { title: "Schedule", path: "/schedule", icon: EventRoundedIcon },
  { title: "Updates", path: "/updates", icon: SystemUpdateAltRoundedIcon, adminOnly: true },
  { title: "Accounts", path: "/accounts", icon: ManageAccountsRoundedIcon, adminOnly: true },
];

export function navigationFor(isAdmin: boolean): NavigationItem[] {
  return isAdmin ? navigationItems : navigationItems.filter((n) => !n.adminOnly);
}

export function pageTitleFor(pathname: string): string {
  const match = navigationItems.find((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)));
  return match?.title ?? "Signage";
}
