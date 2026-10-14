import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/theme/colors';
import {
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  ChipGroup,
  Divider,
  EmptyState,
  IconBadge,
  Pill,
  ProgressBar,
  Screen,
  SectionHeader,
  SegmentedControl,
} from '@/shared/ui';

/** Vitrina del sistema de diseño (solo en desarrollo): para revisar tokens y componentes en claro y oscuro. */
export function DesignSystemScreen() {
  const [moment, setMoment] = useState<'breakfast' | 'lunch' | 'snack' | 'dinner'>('lunch');
  const [chip, setChip] = useState(true);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Sistema de diseño' }} />
      <Screen scroll>
        <SectionHeader title="Tipografía" />
        <AppText variant="display">Display 32</AppText>
        <AppText variant="title">Título 26</AppText>
        <AppText variant="heading">Encabezado 20</AppText>
        <AppText variant="subtitle">Subtítulo 17</AppText>
        <AppText>Cuerpo 16: texto de lectura con buen interlineado.</AppText>
        <AppText variant="label">Etiqueta 14</AppText>
        <AppText variant="caption" secondary>Pie 13, secundario</AppText>

        <Divider />
        <SectionHeader title="Botones" actionLabel="Acción" onAction={() => undefined} />
        <Button label="Primario" icon="restaurant-outline" onPress={() => undefined} />
        <Button label="Secundario" variant="secondary" onPress={() => undefined} />
        <Button label="Fantasma" variant="ghost" onPress={() => undefined} />
        <Button label="Peligro" variant="danger" icon="trash-outline" onPress={() => undefined} />
        <Button label="Pequeño" size="sm" icon="add" onPress={() => undefined} />
        <Button label="Deshabilitado" disabled onPress={() => undefined} />

        <Divider />
        <SectionHeader title="Tarjetas" />
        <Card>
          <View style={styles.row}>
            <IconBadge name="sunny-outline" />
            <View style={styles.flex}>
              <AppText variant="subtitle">Elevada</AppText>
              <AppText variant="caption" secondary>Para lo importante</AppText>
            </View>
          </View>
          <ProgressBar value={0.75} label="Tienes el 75 % de los ingredientes" />
          <View style={styles.pills}>
            <Pill label="35 min" icon="time-outline" />
            <Pill label="Usa lo que vence" tone="warning" icon="alert-circle-outline" />
            <Pill label="Lo tienes" tone="primary" icon="checkmark" />
          </View>
        </Card>
        <Card variant="primary">
          <AppText variant="heading">Destacada</AppText>
          <SegmentedControl
            label="Momento del día"
            value={moment}
            onChange={setMoment}
            options={[
              { value: 'breakfast', label: 'Desayuno' },
              { value: 'lunch', label: 'Almuerzo' },
              { value: 'snack', label: 'Algo' },
              { value: 'dinner', label: 'Cena' },
            ]}
          />
        </Card>
        <Card variant="filled">
          <AppText>Rellena</AppText>
        </Card>
        <Card variant="outlined">
          <AppText>Con borde</AppText>
        </Card>

        <Divider />
        <SectionHeader title="Avisos y estados" />
        <Banner tone="info" message="Información" />
        <Banner tone="success" message="Listo, quedó guardado." />
        <Banner tone="warning" message="Vence pronto: espinaca." />
        <Banner tone="danger" message="Esa receta tiene un alérgeno que declaraste." />
        <ChipGroup>
          <Chip label="Seleccionado" selected={chip} multiple onPress={() => setChip((v) => !v)} />
          <Chip label="Sin seleccionar" selected={false} multiple onPress={() => undefined} />
        </ChipGroup>
        <EmptyState message="Estado vacío con su acción" icon="basket-outline" />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
