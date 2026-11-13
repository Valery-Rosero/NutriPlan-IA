import { foodEmoji } from '@/core/food-emoji';

describe('foodEmoji', () => {
  it('reconoce los platos del catálogo (el plato gana sobre el ingrediente)', () => {
    expect(foodEmoji('Arroz salteado con lo que tengas')).toBe('🍛');
    expect(foodEmoji('Tortilla de papa con lo que sobre')).toBe('🍳');
    expect(foodEmoji('Crema de ahuyama')).toBe('🥣');
    expect(foodEmoji('Lentejas guisadas con lo que haya')).toBe('🍲');
    expect(foodEmoji('Sudado de lo que haya')).toBe('🍲');
    expect(foodEmoji('Pasta con lo que hay en la nevera')).toBe('🍝');
    expect(foodEmoji('Avena con fruta')).toBe('🥣');
    expect(foodEmoji('Batido de fruta')).toBe('🥤');
    expect(foodEmoji('Arepa rellena a tu gusto')).toBe('🫓');
    expect(foodEmoji('Patacones con lo que tengas')).toBe('🍌');
  });

  it('reconoce ingredientes sin importar tildes ni mayúsculas', () => {
    expect(foodEmoji('Fríjol rojo seco')).toBe('🫘');
    expect(foodEmoji('PAPA CRIOLLA')).toBe('🥔');
    expect(foodEmoji('Champiñones')).toBe('🍄');
    expect(foodEmoji('Carne de res molida')).toBe('🥩');
    expect(foodEmoji('Queso campesino')).toBe('🧀');
  });

  it('no confunde palabras que empiezan igual', () => {
    expect(foodEmoji('Aguacate')).toBe('🥑'); // no es "agua"
    expect(foodEmoji('Panela')).toBe('🍯'); // no es "pan"
    expect(foodEmoji('Pan blanco')).toBe('🍞');
    expect(foodEmoji('Salsa rosada')).toBe('🍽️'); // no es "sal"
  });

  it('usa el respaldo cuando no reconoce el nombre', () => {
    expect(foodEmoji('Receta de la abuela')).toBe('🍽️');
    expect(foodEmoji('Receta de la abuela', '☕')).toBe('☕');
  });
});
