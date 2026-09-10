import { Box } from "@mui/material";

/** Small vector logo: a screen outline with a play triangle, tinted with the primary colour. */
export default function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      aria-hidden
      sx={{ width: size, height: size, flexShrink: 0, color: "primary.main", display: "block" }}
    >
      <rect x="2" y="3.5" width="20" height="14" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="2" y="3.5" width="20" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8.2v4.6l4-2.3z" fill="currentColor" />
      <path d="M8 21h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Box>
  );
}
