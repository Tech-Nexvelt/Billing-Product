import { ModifierGroup } from '@/types/menu.types';
import { SelectedModifier } from '@/types/order.types';

export class DependencyEngine {
  /**
   * Evaluates if a modifier group should be visible based on its conditional dependencies.
   */
  static isGroupVisible(
    group: ModifierGroup,
    selectedModifiers: SelectedModifier[]
  ): boolean {
    if (!group.dependencies || group.dependencies.length === 0) return true;

    return group.dependencies.every(dep => {
      const match = selectedModifiers.find(s => s.group_id === dep.depends_on_group_id);
      if (!match) return dep.action === 'hide';

      const isOptionMatch = !dep.depends_on_option_id || match.option_id === dep.depends_on_option_id;
      return dep.action === 'show' ? isOptionMatch : !isOptionMatch;
    });
  }

  /**
   * Validates mandatory selection rules and min/max selection bounds for a given group.
   */
  static validateGroupSelection(
    group: ModifierGroup,
    selections: SelectedModifier[]
  ): { isValid: boolean; error?: string } {
    const totalCount = selections.reduce((acc, s) => acc + (s.quantity || 1), 0);

    if (!group.is_required && group.min_selections === 0 && totalCount === 0) {
      return { isValid: true };
    }

    if (group.is_required && totalCount === 0) {
      return { isValid: false, error: `Please make a selection for "${group.name}".` };
    }

    if (group.min_selections > 0 && totalCount < group.min_selections) {
      return { isValid: false, error: `Select at least ${group.min_selections} option(s) for "${group.name}".` };
    }

    if (group.max_selections != null && group.max_selections > 0 && totalCount > group.max_selections) {
      return { isValid: false, error: `Select at most ${group.max_selections} option(s) for "${group.name}".` };
    }

    return { isValid: true };
  }
}
