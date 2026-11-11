// Marks where each printed page ends, so long resumes show their page boundaries.
function markPageBreaks(sheet, pageHeight, totalHeight) {
  // Ignore a sliver of overflow, so a resume that just fills a page shows no break.
  const wanted = Math.max(0, Math.ceil(totalHeight / pageHeight - 0.01) - 1);
  const marks = sheet.querySelectorAll('.page-break');
  for (const extra of [...marks].slice(wanted)) extra.remove();
  for (let index = marks.length; index < wanted; index++) {
    const mark = document.createElement('div');
    mark.className = 'page-break';
    sheet.append(mark);
  }
  sheet.querySelectorAll('.page-break').forEach((mark, index) => {
    mark.style.top = `${pageHeight * (index + 1)}px`;
  });
}

// Keep the resume at its actual paper width while fitting it into its container.
export function fitResumePreview(frame, stage, sheet, paper = 'A4', pageBreaks = false) {
  const doc = frame.contentDocument;
  if (!doc?.body) return;
  const width = paper === 'Letter' ? 816 : 210 * 96 / 25.4;
  const height = paper === 'Letter' ? 1056 : 297 * 96 / 25.4;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  const contentHeight = Math.max(height, doc.documentElement.scrollHeight, doc.body.scrollHeight);
  frame.style.height = `${contentHeight}px`;
  const style = getComputedStyle(stage);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const scale = Math.min(1, Math.max(0.1, (stage.clientWidth - padding) / width));
  frame.style.transform = `scale(${scale})`;
  sheet.style.width = `${width * scale}px`;
  sheet.style.height = `${contentHeight * scale}px`;
  if (pageBreaks) markPageBreaks(sheet, height * scale, contentHeight * scale);
}
