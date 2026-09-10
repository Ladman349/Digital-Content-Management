import { Box } from "@mui/material";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import BrokenImageRoundedIcon from "@mui/icons-material/BrokenImageRounded";
import type { MediaItem } from "../../types/media";
import { thumbnailUrl } from "../../utils/media";

interface Props {
  media?: MediaItem | null;
  width?: number | string;
  height?: number | string;
  radius?: number;
}

export default function MediaThumb({ media, width = 56, height = 36, radius = 1 }: Props) {
  const url = thumbnailUrl(media);
  const Icon = !media ? BrokenImageRoundedIcon : media.type === "Video" ? MovieRoundedIcon : ImageRoundedIcon;
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        bgcolor: (t) => (t.palette.mode === "light" ? "#1F2430" : "#0B0E13"),
        backgroundImage: url ? `url("${url}")` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "grid",
        placeItems: "center",
        color: "rgba(255,255,255,0.45)",
        overflow: "hidden",
      }}
    >
      {!url && <Icon sx={{ fontSize: typeof height === "number" ? Math.min(28, height * 0.55) : 22 }} />}
    </Box>
  );
}
