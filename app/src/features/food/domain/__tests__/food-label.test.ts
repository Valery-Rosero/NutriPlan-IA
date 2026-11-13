import { classifyQuietly, type FoodLabel, type FoodLabelRepository } from '@/features/food/domain/food-label';

const LABEL: FoodLabel = {
  name: 'Queso campesino', isFood: true, foodGroupId: 5, storeCategoryId: 3, mealSlot: null,
  kcalPerServing: null, proteinPerServing: null, source: 'ai',
};
const repo = (classify: FoodLabelRepository['classify']): FoodLabelRepository => ({ classify });

describe('clasificar sin estorbar (B3)', () => {
  it('devuelve la clasificación cuando llega a tiempo', async () => {
    await expect(classifyQuietly(repo(async () => LABEL), 'queso campesino')).resolves.toEqual(LABEL);
  });

  it('si falla, devuelve null (nunca lanza)', async () => {
    await expect(classifyQuietly(repo(async () => { throw new Error('sin red'); }), 'queso')).resolves.toBeNull();
  });

  it('si se demora más del límite, sigue sin ella', async () => {
    const slow = repo(() => new Promise((resolve) => setTimeout(() => resolve(LABEL), 200)));
    await expect(classifyQuietly(slow, 'queso', 20)).resolves.toBeNull();
  });
});
