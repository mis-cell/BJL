import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  rightAction?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, title, rightAction }) => {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#EAE6DD]">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-[#F7AFA8]/10 text-[#D94B5A]">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-serif font-bold text-lg text-[#D94B5A] tracking-tight">{title}</h2>
      </div>
      {rightAction && <div>{rightAction}</div>}
    </div>
  );
};

export default SectionHeader;
