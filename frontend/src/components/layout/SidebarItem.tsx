import {
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
} from "@mui/material";

import { NavLink } from "react-router-dom";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  title: string;
  path: string;
  icon: SvgIconComponent;
}

export default function SidebarItem({
  title,
  path,
  icon: Icon,
}: Props) {
  return (
    <ListItemButton
      component={NavLink}
      to={path}
      sx={{
        mx: 2,
        mb: 1,
        borderRadius: 3,
        color: "#CBD5E1",
        transition: ".25s",

        "&.active": {
          background:
            "linear-gradient(135deg,#7C4DFF,#5B3DF5)",
          color: "#fff",

          boxShadow:
            "0 10px 30px rgba(108,76,241,.35)",
        },

        "&:hover": {
    bgcolor: "rgba(255,255,255,.08)",
    transform: "translateX(4px)",
    transition: ".25s",
},
      }}
    >
      <ListItemIcon
        sx={{
          color: "inherit",
          minWidth: 40,
        }}
      >
        <Icon />
      </ListItemIcon>
      <ListItemText
    primary={
        <Typography
            sx={{
                fontWeight: 600,
                fontSize: 15,
            }}
        >
            {title}
        </Typography>
    }
/>

      
    </ListItemButton>
  );
}