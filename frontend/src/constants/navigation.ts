import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import type { SvgIconComponent } from "@mui/icons-material";

export interface NavigationItem {
  title: string;
  path: string;
  icon: SvgIconComponent;
}

export const navigationItems: NavigationItem[] = [
  { title: "Dashboard", path: "/", icon: DashboardRoundedIcon },
  { title: "Devices", path: "/devices", icon: TvRoundedIcon },
  { title: "Media", path: "/media", icon: PermMediaRoundedIcon },
  { title: "Playlists", path: "/playlists", icon: PlaylistPlayRoundedIcon },
  { title: "Schedule", path: "/schedule", icon: EventRoundedIcon },
  { title: "App updates", path: "/updates", icon: SystemUpdateAltRoundedIcon },
];

export function pageTitleFor(pathname: string): string {
  const match = navigationItems.find((n) => (n.path === "/" ? pathname === "/" : pathname.startsWith(n.path)));
  return match?.title ?? "Signage";
}
