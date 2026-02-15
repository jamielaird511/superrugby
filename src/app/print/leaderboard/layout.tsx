export default function PrintLeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          body {
            zoom: 0.9;
          }

          .print-container table {
            width: 100% !important;
            table-layout: fixed;
          }

          .print-container {
            width: 100%;
            overflow: hidden;
          }
        }
      `}</style>
      {children}
    </>
  );
}
