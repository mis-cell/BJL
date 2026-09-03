import os
import re
from collections import defaultdict

id_map = defaultdict(list)
id_pattern = re.compile(r'id=["\']([^"\']+)["\']')

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    # check if line is commented out with //
                    if line.strip().startswith('//'):
                        continue
                    matches = id_pattern.findall(line)
                    for match in matches:
                        if not match.startswith('{') and '${' not in match:
                            id_map[match].append((path, line_num))

duplicates = {k: v for k, v in id_map.items() if len(v) > 1}
print(f'Total Unique Static IDs: {len(id_map)}')
print(f'Total Duplicate IDs found: {len(duplicates)}')

for k, v in sorted(duplicates.items()):
    print(f'\nID: "{k}" ({len(v)} occurrences):')
    for file_path, line in v:
        print(f'  - {file_path}:{line}')
