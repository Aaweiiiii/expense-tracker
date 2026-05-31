// Icon system: PNG mask icons (currentColor).

import foodPng from '../assets/icons/food.png';
import transportPng from '../assets/icons/transport.png';
import entertainmentPng from '../assets/icons/entertainment.png';
import clothingPng from '../assets/icons/clothing.png';
import salaryPng from '../assets/icons/salary.png';
import shoppingPng from '../assets/icons/shopping.png';
import housingPng from '../assets/icons/housing.png';
import medicalPng from '../assets/icons/medical.png';
import educationPng from '../assets/icons/education.png';
import digitalPng from '../assets/icons/digital.png';
import otherPng from '../assets/icons/other.png';
import billsPng from '../assets/icons/bills.png';
import addPng from '../assets/icons/add.png';
import statsPng from '../assets/icons/stats.png';
import settingsPng from '../assets/icons/settings.png';
import analysisPng from '../assets/icons/analysis.png';

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ children, size = 24, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function PngIcon(src: string) {
  return function ({ size = 24, className }: IconProps) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          backgroundColor: 'currentColor',
          maskImage: `url(${src})`,
          maskSize: 'contain',
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          WebkitMaskImage: `url(${src})`,
          WebkitMaskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
        }}
      />
    );
  };
}

// ── Shared icons ──

export function OtherIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </Svg>
  );
}

// ── Income icons ──

export function SideJobIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M12 11v5M9 14h6" />
    </Svg>
  );
}

export function InvestmentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 20V10l5 4 4-6 5 3 4-6" />
      <path d="M21 4h-4l2 2Z" />
    </Svg>
  );
}

export function RefundIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9 9 9 0 0 1-9 9" />
      <path d="M3 12h4l2-3 2 5 2-4 2 6 2-4h4" />
    </Svg>
  );
}

export function OtherIncomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M7 12h10" />
    </Svg>
  );
}

// ── Icon map ──

import type { ComponentType } from 'react';

type IconComponent = ComponentType<IconProps>;

export const EXPENSE_ICONS: Record<string, IconComponent> = {
  '餐饮': PngIcon(foodPng),
  '交通': PngIcon(transportPng),
  '购物': PngIcon(shoppingPng),
  '娱乐': PngIcon(entertainmentPng),
  '居住': PngIcon(housingPng),
  '医疗': PngIcon(medicalPng),
  '教育': PngIcon(educationPng),
  '数码': PngIcon(digitalPng),
  '服饰': PngIcon(clothingPng),
  '其他': PngIcon(otherPng),
};

export const INCOME_ICONS: Record<string, IconComponent> = {
  '工资': PngIcon(salaryPng),
  '兼职': SideJobIcon,
  '理财': InvestmentIcon,
  '退款': RefundIcon,
  '其他收入': OtherIncomeIcon,
};

// Nav tab icons
export const BillsIcon = PngIcon(billsPng);
export const AddIcon = PngIcon(addPng);
export const StatsIcon = PngIcon(statsPng);
export const AnalysisIcon = PngIcon(analysisPng);
export const SettingsIcon = PngIcon(settingsPng);
