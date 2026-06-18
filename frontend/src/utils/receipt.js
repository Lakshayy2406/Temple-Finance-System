import jsPDF from "jspdf";
import { getTransactionDate } from "./dateFilter";

export const RECEIPT_TEMPLE_NAME = "SHREE XYZ TEMPLE";

function receiptDateSource(receipt) {
  const date = getTransactionDate(receipt);
  if (date && String(date).includes("T")) return date;
  return receipt?.created_at || date;
}

export function receiptParts(receipt) {
  const parsed = new Date(receiptDateSource(receipt));
  if (Number.isNaN(parsed.getTime())) {
    return { date: "-", time: "-" };
  }

  return {
    date: parsed.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: parsed.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

export function receiptAmount(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-IN")} /-`;
}

export function receiptFileName(receiptNo) {
  return `receipt_${String(receiptNo || "pending")
    .replace(/^#/, "")
    .replace("-", "_")
    .toLowerCase()}.pdf`;
}

export function downloadReceiptPdf(receipt) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const { date, time } = receiptParts(receipt);
  const width = doc.internal.pageSize.getWidth();
  const left = 38;
  let y = 30;

  doc.setDrawColor(122, 101, 85);
  doc.setLineWidth(0.4);
  doc.line(left, y, width - left, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(RECEIPT_TEMPLE_NAME, width / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(13);
  doc.text("DONATION RECEIPT", width / 2, y, { align: "center" });
  y += 9;
  doc.line(left, y, width - left, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Receipt No: ${receipt.receipt_no || "Pending"}`, left, y);
  y += 11;

  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${date}`, left, y);
  y += 8;
  doc.text(`Time: ${time}`, left, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.text("Received From:", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(String(receipt.Name || receipt.description || "-"), left, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Amount:", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.text(receiptAmount(receipt.Amount ?? receipt.amount), left, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Payment Mode:", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text(String(receipt.Mode || receipt.category || "-"), left, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Thank You For Your Contribution", width / 2, y, { align: "center" });
  y += 12;
  doc.line(left, y, width - left, y);

  doc.save(receiptFileName(receipt.receipt_no));
}
