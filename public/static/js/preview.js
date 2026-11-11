// Keep the resume at its actual paper width while fitting it into its container.
export function fitResumePreview(frame, stage, sheet, paper = 'A4') {
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
}
