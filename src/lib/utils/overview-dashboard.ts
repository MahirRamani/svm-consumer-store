// lib/utils/dashboard.ts

export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  })}`;
};

export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export const calculateProfitChange = (today: number, yesterday: number): number => {
  if (yesterday === 0) return 0;
  return ((today - yesterday) / yesterday) * 100;
};