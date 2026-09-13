import { IconButton, InputAdornment, TextField } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
  autoFocus?: boolean;
}

export default function SearchField({ value, onChange, placeholder = "Search…", width = 260, autoFocus }: Props) {
  return (
    <TextField
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      // Fills its row on phones; a fixed 260px column of a 375px screen leaves nothing for the action.
      sx={{ width: { xs: "100%", md: width }, minWidth: { md: 160 } }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton onClick={() => onChange("")} edge="end" aria-label="Clear search">
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
        htmlInput: { inputMode: "search", enterKeyHint: "search", autoComplete: "off", "aria-label": placeholder },
      }}
    />
  );
}
