import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
// Removed unused icons

import type { SvgIconComponent } from "@mui/icons-material";

export interface NavigationItem {
  title: string;
  path: string;
  icon: SvgIconComponent;
  section: "main" | "management";
}

export const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    path: "/",
    icon: DashboardRoundedIcon,
    section: "main",
  },
  {
    title: "Devices",
    path: "/devices",
    icon: TvRoundedIcon,
    section: "main",
  },
  {
    title: "Media",
    path: "/media",
    icon: ImageRoundedIcon,
    section: "main",
  },
  {
    title: "Playlists",
    path: "/playlists",
    icon: PlaylistPlayRoundedIcon,
    section: "main",
  },
  {
    title: "Schedule",
    path: "/schedule",
    icon: EventRoundedIcon,
    section: "main",
  },
];