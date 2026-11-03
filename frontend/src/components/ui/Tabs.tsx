import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Tabs"
      className={`flex items-center gap-1.5 p-1 rounded-xl overflow-x-auto border ${className}`}
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 whitespace-nowrap min-h-[38px] cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${
              isActive ? 'shadow-sv-sm' : 'hover:opacity-80'
            }`}
            style={{
              background: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? '#FFFFFF' : 'var(--color-text-2)',
            }}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className="text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-surface-subtle)',
                  color: isActive ? '#FFFFFF' : 'var(--color-text-2)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

