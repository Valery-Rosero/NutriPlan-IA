import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatCOP } from '@/core/format';
import { useSession } from '@/features/auth/application/session';
import { useSignOut } from '@/features/auth/application/use-auth';
import { legalHref } from '@/features/legal/ui/legal-href';
import {
  useCuisines,
  useProfile,
  useProfileOptions,
  useRestrictions,
  useSensitiveAuthorization,
} from '@/features/profile/application/profile-queries';
import { AppearanceSection } from '@/features/profile/ui/appearance-section';
import type { ProfileSection } from '@/features/profile/ui/edit-profile-screen';
import { Spacing } from '@/shared/theme/colors';
import { DisplayFont } from '@/shared/theme/tokens';
import { useTheme } from '@/shared/theme/use-theme';
import { AppText, Card, ListGroup, ListRow, Pill, Screen } from '@/shared/ui';

/** US-116: el perfil como un resumen de tu cocina; cada fila lleva a editar esa parte. */
export function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const c = useTheme();
  const { session } = useSession();
  const signOut = useSignOut();
  const profile = useProfile();
  const restrictions = useRestrictions();
  const sensitive = useSensitiveAuthorization();
  const { regions, allergens, diets } = useProfileOptions();
  const cuisines = useCuisines();
  const edit = (section: ProfileSection) => router.push({ pathname: '/profile/[section]', params: { section } });

  const p = profile.data;
  const names = (ids: number[] | undefined, list: { id: number; name: string }[] | undefined) =>
    ids?.length ? ids.map((id) => list?.find((o) => o.id === id)?.name).filter(Boolean).join(', ') : t('profile.none');

  const region = regions.data?.find((r) => r.id === p?.regionId)?.name;
  const household = p ? t('profile.summary.household', { count: p.householdSize, region: region ?? '—' }) : '…';
  const budget = p?.budgetAmount
    ? t(`profile.summary.budget_${p.budgetPeriod ?? 'week'}`, { amount: formatCOP(p.budgetAmount) })
    : t('profile.summary.noBudget');
  const favoriteCount = cuisines.mine.data?.length ?? 0;
  const preferences = [
    p?.maxCookMinutes ? t('profile.summary.maxTime', { minutes: p.maxCookMinutes }) : t('profile.summary.noMaxTime'),
    favoriteCount > 0 ? t('profile.summary.cuisines', { count: favoriteCount }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const restrictionsSummary = `${t('profile.summary.allergies')}: ${names(restrictions.data?.allergenIds, allergens.data)} · ${t('profile.summary.diets')}: ${names(restrictions.data?.dietIds, diets.data)}`;
  const noAllergies = restrictions.data?.allergenIds.length === 0;

  const email = session?.email ?? '';
  const initial = (email.trim()[0] ?? 'N').toUpperCase();

  const confirmSignOut = () =>
    Alert.alert(t('profile.signOutTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => signOut.mutate() },
    ]);

  return (
    <Screen scroll>
      {/* Tarjeta de identidad: quién eres y para quién cocinas */}
      <Card variant="brand" style={styles.hero}>
        <View style={styles.identity}>
          <View
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[styles.avatar, { backgroundColor: c.onBrand }]}>
            <AppText style={[styles.initial, { color: c.brand }]}>{initial}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="label" tone="onBrandMuted">{t('profile.title').toUpperCase()}</AppText>
            <AppText variant="subtitle" tone="onBrand" numberOfLines={1}>{email || t('common.appName')}</AppText>
          </View>
        </View>
        {p && (
          <View style={styles.pills}>
            <Pill label={t('profile.hero.people', { count: p.householdSize })} icon="people-outline" />
            {region && <Pill label={region} icon="location-outline" />}
            {sensitive.data && !noAllergies && <Pill label={t('profile.hero.protected')} tone="primary" icon="shield-checkmark-outline" />}
            {noAllergies && <Pill label={t('profile.hero.noAllergies')} tone="warning" icon="alert-circle-outline" />}
          </View>
        )}
      </Card>

      <ListGroup title={t('profile.groups.kitchen')}>
        <ListRow icon="home-outline" title={t('profile.sections.household')} subtitle={household} onPress={() => edit('household')} />
        <ListRow
          icon="alert-circle-outline"
          tone={noAllergies ? 'warning' : 'primary'}
          title={t('profile.sections.restrictions')}
          subtitle={restrictionsSummary}
          onPress={() => edit('restrictions')}
        />
        <ListRow icon="wallet-outline" title={t('profile.sections.budget')} subtitle={budget} onPress={() => edit('budget')} />
        <ListRow icon="time-outline" title={t('profile.sections.preferences')} subtitle={preferences} onPress={() => edit('preferences')} />
      </ListGroup>

      <AppearanceSection />

      <ListGroup title={t('profile.groups.privacy')}>
        <ListRow
          icon="shield-checkmark-outline"
          title={t('profile.sections.privacy')}
          subtitle={sensitive.data ? t('profile.summary.privacyGranted') : t('profile.summary.privacyNotGranted')}
          onPress={() => edit('privacy')}
        />
        <ListRow icon="document-text-outline" tone="neutral" title={t('legal.kinds.privacy_policy')} external onPress={() => router.push(legalHref('privacy_policy'))} />
        <ListRow icon="reader-outline" tone="neutral" title={t('legal.kinds.terms')} external onPress={() => router.push(legalHref('terms'))} />
        <ListRow
          icon="medkit-outline"
          tone="neutral"
          title={t('legal.kinds.health_disclaimer')}
          external
          onPress={() => router.push(legalHref('health_disclaimer'))}
        />
      </ListGroup>

      <ListGroup title={t('profile.groups.account')}>
        <ListRow icon="log-out-outline" title={t('profile.signOut')} danger onPress={confirmSignOut} />
        {__DEV__ ? (
          <ListRow icon="color-palette-outline" tone="neutral" title="Sistema de diseño (desarrollo)" onPress={() => router.push('/design-system')} />
        ) : null}
      </ListGroup>

      <View style={styles.footer}>
        <AppText variant="caption" secondary style={styles.center}>
          {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </AppText>
        <AppText variant="caption" secondary style={styles.center}>{t('health.disclaimer')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { padding: Spacing.lg, gap: Spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: DisplayFont, fontSize: 28, lineHeight: 34 },
  flex: { flex: 1, gap: Spacing.xxs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  footer: { gap: Spacing.xs, paddingTop: Spacing.sm },
  center: { textAlign: 'center' },
});
