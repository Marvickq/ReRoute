export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string | React.ReactNode;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-[18px] font-semibold text-[#f0f0f0]">{title}</h2>
        {description && (
          <p className="text-[13px] text-[#a0a0a0] mt-1">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
