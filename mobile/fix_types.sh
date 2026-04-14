#!/bin/bash
# Remove unused React imports
find app src -name "*.tsx" -o -name "*.ts" | xargs sed -i -E 's/import React, \{([^{}]+)\} from .react.;/import { \1 } from '"'"'react'"'"';/g'
find app src -name "*.tsx" -o -name "*.ts" | xargs sed -i -E 's/import React from .react.;//g'

# Fix FlashCard colors typing
sed -i 's/let bg = theme.card;/let bg: string = theme.card;/' src/components/FlashCard.tsx
sed -i 's/let border = theme.border;/let border: string = theme.border;/' src/components/FlashCard.tsx
sed -i 's/let textColor = theme.text;/let textColor: string = theme.text;/' src/components/FlashCard.tsx

# Fix Avatar parts TS2532
sed -i 's/parts\[0\]\[0\]/parts[0]?.[0]/g' src/components/ui/Avatar.tsx
sed -i 's/parts\[parts.length - 1\]\[0\]/parts[parts.length - 1]?.[0]/g' src/components/ui/Avatar.tsx

# Fix ThemeContext mismatch
sed -i 's/export type Theme = typeof lightTheme;/export type Theme = Record<keyof typeof lightTheme, string>;/g' src/theme/tokens.ts

