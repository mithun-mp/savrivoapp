import React from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'image' | 'rect';
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ variant = 'rect', width, height, className = '' }: SkeletonProps) {
  const base = 'skeleton';
  const variantClass =
    variant === 'avatar' ? 'rounded-full' :
    variant === 'text' ? 'rounded' :
    'rounded-xl';

  const style: React.CSSProperties = {
    width: width,
    height: height || (variant === 'text' ? '1em' : variant === 'avatar' ? '40px' : undefined),
  };

  return <div className={`${base} ${variantClass} ${className}`} style={style} aria-hidden="true" />;
}

export function ProductCardSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col border shadow-sv-sm"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      aria-hidden="true"
    >
      <Skeleton variant="image" className="w-full" height="220px" />
      <div className="p-5 space-y-3 flex-1 flex flex-col">
        <Skeleton variant="text" width="35%" height="12px" />
        <Skeleton variant="text" width="85%" height="18px" />
        <Skeleton variant="text" width="100%" height="12px" />
        <Skeleton variant="text" width="60%" height="12px" />
        <div className="mt-auto pt-4 flex items-center justify-between border-t" style={{ borderColor: 'var(--color-border)' }}>
          <Skeleton variant="text" width="40%" height="16px" />
          <Skeleton variant="rect" width="80px" height="32px" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton variant="text" width={i === 0 ? '70%' : '50%'} height="14px" />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
