import { fitResumePreview } from './preview.js';

const frame = document.getElementById('resume-content');
const stage = document.getElementById('template-preview');
const sheet = document.getElementById('template-sheet');
const fit = () => fitResumePreview(frame, stage, sheet);

frame.addEventListener('load', fit);
new ResizeObserver(fit).observe(stage);
fit();
