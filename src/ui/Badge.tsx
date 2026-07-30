import React from 'react';
import type { ArticleStatus } from '../state/types';
import type { BuilderValidationStatus } from '../core/builders/types';

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

export interface BuilderStatusPillProps {
  status: BuilderValidationStatus;
}

/** Renders nothing for a validated builder — the pill only exists to flag
 * builders that haven't been verified against a real site export yet. */
export const BuilderStatusPill: React.FC<BuilderStatusPillProps> = ({ status }) => {
  if (status !== 'beta') return null;
  return <span className="badge badge-beta">Beta · not verified on a real site</span>;
};
