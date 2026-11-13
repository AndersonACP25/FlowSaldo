import React from 'react';
import { Image } from 'react-native';
import type { BrandMarkProps } from './BrandMark';
import './brand-mark.css';

// Metro needs a static require for bundled React Native images.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const icon = require('../assets/icon.png');

export function BrandMark({ cover = false }: BrandMarkProps) {
  const size = cover ? 108 : 42;
  return (
    <div className={cover ? 'brand-mark brand-mark--cover' : 'brand-mark'}>
      <Image
        source={icon}
        accessible={false}
        style={{ width: size, height: size, borderRadius: cover ? 28 : 12 }}
      />
      <span className="brand-mark__name">FlowSaldo</span>
    </div>
  );
}
