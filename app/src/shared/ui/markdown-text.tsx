import { Text, View } from 'react-native';

import { Spacing } from '@/shared/theme/colors';
import { useTheme } from '@/shared/theme/use-theme';

/**
 * Lector mínimo de Markdown para textos legales: títulos (#), viñetas (- / 1.), citas (>) y **negrita**.
 * Suficiente para los borradores; no es un motor de Markdown general.
 */
export function MarkdownText({ source }: { source: string }) {
  const c = useTheme();
  const blocks = source.split('\n').filter((line) => line.trim() !== '');

  return (
    <View style={{ gap: Spacing.sm }}>
      {blocks.map((line, i) => {
        const heading = /^(#{1,3})\s+(.*)$/.exec(line);
        if (heading) {
          const size = heading[1].length === 1 ? 24 : heading[1].length === 2 ? 20 : 18;
          return (
            <Text key={i} accessibilityRole="header" style={{ color: c.text, fontSize: size, fontWeight: '700', marginTop: Spacing.sm }}>
              {inline(heading[2])}
            </Text>
          );
        }
        const quote = /^>\s?(.*)$/.exec(line);
        if (quote) {
          return (
            <Text key={i} style={{ color: c.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
              {inline(quote[1])}
            </Text>
          );
        }
        const bullet = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
        return (
          <Text key={i} style={{ color: c.text, fontSize: 16, lineHeight: 24, paddingLeft: bullet ? Spacing.md : 0 }}>
            {bullet ? '•  ' : ''}
            {inline(bullet ? bullet[1] : line)}
          </Text>
        );
      })}
    </View>
  );
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <Text key={i} style={{ fontWeight: '700' }}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}
