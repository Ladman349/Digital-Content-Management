import { Typography } from "@mui/material";

interface Props {
  value: number;
  loading?: boolean;
}

export default function AnimatedCounter({ value, loading = false }: Props) {
  if (loading) {
    return (
      <Typography
        sx={{
          fontSize: { xs: 22, sm: 26, md: 32 },
          fontWeight: 800,
          color: "#0F172A",
          mt: 0.5,
          letterSpacing: "-0.02em",
        }}
      >
        —
      </Typography>
    );
  }

  return (
    <Typography
      component="div"
      sx={{
        fontSize: { xs: 22, sm: 26, md: 32 },
        fontWeight: 800,
        color: "#0F172A",
        mt: 0.5,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value.toLocaleString()}
    </Typography>
  );
}
