import os
import re

files = [
    'src/components/dashboard/ActivityChart.tsx',
    'src/components/dashboard/DeviceStatusCard.tsx',
    'src/components/dashboard/RecentDevices.tsx',
    'src/components/dashboard/RecentPlaylists.tsx',
    'src/components/dashboard/StatsGrid.tsx',
    'src/components/dashboard/StorageCard.tsx'
]

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()

    # Add import if missing
    if 'useSnackbar' not in content:
        content = content.replace('import ', 'import { useSnackbar } from "notistack";\nimport ', 1)
    
    # Add enqueueSnackbar to component
    if 'enqueueSnackbar' not in content:
        content = content.replace(') {', ') {\n  const { enqueueSnackbar } = useSnackbar();', 1)

    # Replace console.error
    content = re.sub(
        r'console\.error\("([^"]+)",\s*(err|error)\);',
        r'enqueueSnackbar(\2.message || "\1", { variant: "error" });',
        content
    )

    with open(file_path, 'w') as f:
        f.write(content)
    print('Updated', file_path)
