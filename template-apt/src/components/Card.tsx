import { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export default function Card({ title, value, icon: Icon, color }: CardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs md:text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`${color} p-3 md:p-4 rounded-lg`}>
          <Icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
        </div>
      </div>
    </div>
  );
}
