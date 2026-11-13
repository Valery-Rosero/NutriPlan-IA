import { configure } from '@testing-library/react-native';

// Corre después de montar Jest (la librería de pruebas necesita `expect`; jest.setup.ts corre antes).
// findBy/waitFor esperan 1 s por defecto. Con 48 suites en paralelo (y Docker con Supabase en la misma máquina)
// eso no alcanzaba y fallaban pruebas al azar que solas pasan. 5 s: un error real igual falla.
configure({ asyncUtilTimeout: 5000 });
