import { MenuItem, TextField } from "@mui/material";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  width?: number;
}

export default function FilterSelect({ label, value, options, onChange, width = 150 }: Props) {
  return (
    <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ width, flexShrink: 0 }}>
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value}>
          {o.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
