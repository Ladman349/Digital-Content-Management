import {
  Box,
  Divider,
  Drawer,
  List,
  Typography,
  Paper,
  Button,
} from "@mui/material";

import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import HeadsetMicRoundedIcon from "@mui/icons-material/HeadsetMicRounded";

import Logo from "./Logo";
import SidebarItem from "./SidebarItem";
import { navigationItems } from "../../constants/navigation";

const drawerWidth = 300;

export default function Sidebar({ open = true }: { open?: boolean }) {
  const mainItems = navigationItems.filter(
    (item) => item.section === "main"
  );

  const managementItems = navigationItems.filter(
    (item) => item.section === "management"
  );

  const currentWidth = open ? drawerWidth : 0;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        transition: "width 0.2s",
        "& .MuiDrawer-paper": {
          width: currentWidth,
          overflowX: "hidden",
          transition: "width 0.2s",
          border: "none",
          color: "#fff",
          background:
            "linear-gradient(180deg,#0F172A 0%,#111827 100%)",
        },
      }}
    >
      <Logo />

      <Box sx={{ mt: 2 }}>

        <List>
          {mainItems.map((item) => (
            <SidebarItem
              key={item.title}
              title={item.title}
              path={item.path}
              icon={item.icon}
            />
          ))}
        </List>

        {managementItems.length > 0 && (
          <>
            <Divider
              sx={{
                my: 3,
                borderColor: "rgba(255,255,255,.08)",
              }}
            />

            <Typography
              sx={{
                px: 3,
                mb: 1,
                color: "#64748B",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 1,
              }}
            >
              MANAGEMENT
            </Typography>

            <List>
              {managementItems.map((item) => (
                <SidebarItem
                  key={item.title}
                  title={item.title}
                  path={item.path}
                  icon={item.icon}
                />
              ))}
            </List>
          </>
        )}
      </Box>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{ p: 2 }}>

        <Paper
          sx={{
            p: 3,
            color: "#fff",
            borderRadius: 4,

            background:
              "linear-gradient(135deg,#6C4CF1,#7C4DFF)",

            boxShadow:
              "0 20px 40px rgba(108,76,241,.35)",
          }}
        >
          <AutoAwesomeRoundedIcon />

          <Typography
            sx={{
              mt: 1,
              fontWeight: 700,
            }}
          >
            Pro Plan
          </Typography>

          <Typography
            sx={{
              mt: 1,
              fontSize: 13,
              opacity: .9,
            }}
          >
            Unlock analytics, scheduling and advanced reporting.
          </Typography>

          <Button
            fullWidth
            variant="contained"
            sx={{
              mt: 3,
              bgcolor: "#fff",
              color: "#6C4CF1",

              "&:hover": {
                bgcolor: "#F3F4F6",
              },
            }}
          >
            Upgrade
          </Button>
        </Paper>

        <Paper
          sx={{
            mt: 2,
            p: 2.5,
            bgcolor: "#182233",
            color: "#fff",
          }}
        >
          <HeadsetMicRoundedIcon />

          <Typography
            sx={{
              mt: 1,
              fontWeight: 700,
            }}
          >
            Need Help?
          </Typography>

          <Typography
            sx={{
              fontSize: 13,
              color: "#94A3B8",
              mt: 1,
            }}
          >
            Contact our support team anytime.
          </Typography>
        </Paper>

      </Box>
    </Drawer>
  );
}