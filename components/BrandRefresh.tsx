import React from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';
import { COLORS } from '../constants/config';

/** RefreshControl in brand colours on both platforms (tintColor is iOS only; Android uses colors). */
export function BrandRefresh(props: RefreshControlProps) {
  return (
    <RefreshControl
      tintColor={COLORS.primary}
      colors={[COLORS.primary]}
      progressBackgroundColor={COLORS.white}
      {...props}
    />
  );
}
