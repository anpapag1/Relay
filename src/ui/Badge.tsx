import React from 'react';
import type { ArticleStatus } from '../state/types';

export interface BadgeProps {
  status: ArticleStatus;
  label?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label }) => {
  let badgeClass = 'badge ';
  let defaultLabel = status as string;

  switch (status) {
    case 'ready':
      badgeClass += 'badge-ready';
      defaultLabel = 'Ready';
      break;
    case 'review':
      badgeClass += 'badge-review';
      defaultLabel = 'Review';
      break;
    case 'edited':
      badgeClass += 'badge-edited';
      defaultLabel = 'Edited';
      break;
    case 'excluded_auto':
    case 'excluded_manual':
      badgeClass += 'badge-excluded';
      defaultLabel = 'Excluded';
      break;
    default:
      badgeClass += 'badge-excluded';
      break;
  }

  return <span className={badgeClass}>{label ?? defaultLabel}</span>;
};
