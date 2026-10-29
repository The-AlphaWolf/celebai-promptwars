import { jsPDF } from 'jspdf';
import { summarizeBudget } from '../domain/planner';

export function exportPlanToPdf(plan) {
  if (!plan) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
  let y = margin;

  function checkPageBreak(requiredSpace = 40) {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
  }

  function drawHeader() {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 160);
    doc.text('CelebAI event plan', margin, 25);
    doc.setDrawColor(220, 220, 235);
    doc.line(margin, 28, pageWidth - margin, 28);
  }

  // Cover / Header Banner
  drawHeader();
  y = 48;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(30, 25, 50);
  doc.text(plan.title || 'Event Plan Dossier', margin, y);
  y += 24;

  // Event Meta Tagline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const typeColor = plan.eventType === 'wedding' ? [217, 119, 6] : plan.eventType === 'birthday' ? [225, 29, 72] : [79, 70, 229];
  doc.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
  doc.text((plan.eventType || 'Event').toUpperCase() + ' MASTER PLAN', margin, y);
  y += 18;

  // Details Pill Grid
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 95);

  const metaItems = [
    `Date: ${plan.date || 'TBD'}`,
    `Guests: ${plan.guestCount || 'N/A'} attendees`,
    `Budget: $${(plan.budget || 0).toLocaleString()} USD`,
    `Location: ${plan.location || 'TBD'}`
  ];
  doc.text(metaItems.join('   |   '), margin, y);
  y += 20;

  // Theme & Vision
  if (plan.theme) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 60);
    doc.text('Theme & Vibe:', margin, y);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(70, 70, 90);
    doc.text(plan.theme, margin + 75, y);
    y += 18;
  }

  if (plan.summary) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 110);
    const summaryLines = doc.splitTextToSize(plan.summary, contentWidth);
    doc.text(summaryLines, margin, y);
    y += (summaryLines.length * 12) + 14;
  }

  doc.setDrawColor(230, 230, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  // Section 1: Budget Breakdown
  checkPageBreak(80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 25, 50);
  doc.text('1. Financial Budget Breakdown', margin, y);
  y += 18;

  const budgetRows = summarizeBudget(plan).items;
  if (budgetRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 120);
    doc.text('Category', margin, y);
    doc.text('Share', margin + 200, y);
    doc.text('Allocated', margin + 300, y);
    doc.text('Status/Spent', margin + 400, y);
    y += 12;

    doc.setDrawColor(240, 240, 245);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 55);

    budgetRows.forEach((b) => {
      checkPageBreak(18);
      doc.text(b.category, margin, y);
      doc.text(`${b.percentage}%`, margin + 200, y);
      doc.text(`$${(b.allocated || 0).toLocaleString()}`, margin + 300, y);
      doc.text(`$${(b.spent || 0).toLocaleString()}`, margin + 400, y);
      y += 14;
    });
    y += 14;
  }

  // Section 2: Timeline & Milestones
  checkPageBreak(100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 25, 50);
  doc.text('2. Execution Timeline & Milestones', margin, y);
  y += 18;

  if (plan.timeline && plan.timeline.length > 0) {
    plan.timeline.forEach((t) => {
      checkPageBreak(38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 50, 80);
      doc.text(`[${[t.dueDate, t.time !== t.dueDate ? t.time : ''].filter(Boolean).join(' ') || t.phase}] ${t.title}`, margin, y);
      y += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 120);
      const descLines = doc.splitTextToSize(t.description || '', contentWidth - 10);
      doc.text(descLines, margin + 10, y);
      y += (descLines.length * 10) + 8;
    });
    y += 8;
  }

  // Section 3: Vendor Checklist
  checkPageBreak(100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 25, 50);
  doc.text('3. Vendor & Partner Checklist', margin, y);
  y += 18;

  if (plan.vendors && plan.vendors.length > 0) {
    plan.vendors.forEach((v) => {
      checkPageBreak(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 60);
      doc.text(`${v.category}: ${v.name}`, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 130);
      doc.text(`Status: ${v.status} | Priority: ${v.priority} | Est: $${(v.cost || 0).toLocaleString()}`, margin + 220, y);
      y += 12;

      if (v.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(`Notes: ${v.notes}`, margin + 10, y);
        y += 12;
      }
      y += 4;
    });
    y += 10;
  }

  // Section 4: Bespoke Creative Ideas
  checkPageBreak(100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 25, 50);
  doc.text('4. Signature Creative Concepts & Touchpoints', margin, y);
  y += 18;

  if (plan.creativeIdeas && plan.creativeIdeas.length > 0) {
    plan.creativeIdeas.forEach((c) => {
      checkPageBreak(32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(120, 50, 160);
      doc.text(`✨ ${c.title} (${c.category})`, margin, y);
      y += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 95);
      const ideaLines = doc.splitTextToSize(c.description || '', contentWidth - 10);
      doc.text(ideaLines, margin + 10, y);
      y += (ideaLines.length * 10) + 8;
    });
  }

  // Final Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 175);
  doc.text('Generated by CelebAI. Figures are planning estimates, not quotes.', margin, pageHeight - 20);

  // Download
  const filename = `${(plan.title || 'event_plan').toLowerCase().replace(/[^a-z0-9]/g, '_')}_celebai.pdf`;
  doc.save(filename);
}
