export default function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon && <div className="mb-4 text-[#333]">{icon}</div>}
      <h3 className="text-[14px] font-medium text-[#f0f0f0] mb-1">{title}</h3>
      <p className="text-[13px] text-[#666] text-center max-w-sm">{description}</p>
    </div>
  );
}
