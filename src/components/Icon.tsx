// Icon system: SVG stroke icons (currentColor) + optional PNG overrides.

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

// ── Expense icons ──

export function FoodIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Fork (left) */}
      <path d="M9 4v16" />
      <path d="M7 4h4M7 6h4M7 8h4" />
      {/* Knife (right) */}
      <path d="M15 4v16" />
      <path d="M15 4c1.5 0 2 1.5 2 4s-.5 4-2 4" />
    </Svg>
  );
}

export function TransportIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="8" width="20" height="10" rx="3" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M7 8v-3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3" />
    </Svg>
  );
}

export function ShoppingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16l-1.5 11a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 7Z" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function EntertainmentIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Gamepad body */}
      <path d="M4 9h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2l-1 3H7L6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
      {/* Left cross / d-pad */}
      <path d="M8 11v4M6 13h4" />
      {/* Right buttons */}
      <circle cx="16" cy="12" r="1.5" />
      <circle cx="16" cy="15" r="1.5" />
    </Svg>
  );
}

export function HousingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 10L12 3l9 7" />
      <path d="M5 8v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V8" />
    </Svg>
  );
}

export function MedicalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M7 12h10" />
    </Svg>
  );
}

export function EducationIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 6l10-4 10 4-10 4L2 6Z" />
      <path d="M5 8v6a7 7 0 0 0 7 4 7 7 0 0 0 7-4V8" />
      <path d="M12 10v10" />
    </Svg>
  );
}

export function DigitalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Phone body */}
      <rect x="5" y="2" width="14" height="20" rx="3" />
      {/* Notch at top center */}
      <path d="M9 2h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      {/* Home indicator at bottom */}
      <path d="M10 20h4" />
    </Svg>
  );
}

export function ClothingIcon(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Crew neck */}
      <path d="M9 3c0 2 1.5 3 3 3s3-1 3-3" />
      {/* Left sleeve */}
      <path d="M4 9h4v4a4 4 0 0 0 8 0V9h4" />
      {/* Body */}
      <path d="M6 9v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" />
    </Svg>
  );
}

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

export function SalaryIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M12 8v8M9 11l3-3 3 3" />
      <path d="M2 10h2M20 10h2" />
    </Svg>
  );
}

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
