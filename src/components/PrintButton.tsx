import { PrinterIcon } from "@heroicons/react/24/outline";

type PrintButtonProps = {
  onClick: () => void;
  className?: string;
  label?: string;
};

export default function PrintButton({ onClick, className = "", label = "Print" }: PrintButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#003A5D] border border-[#003A5D] rounded-md bg-white hover:bg-[#E6F1F7] transition-colors ${className}`}
    >
      <PrinterIcon className="h-4 w-4" />
      {label}
    </button>
  );
}
