import React, { useMemo } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { writeBlocks } from '../../core/gutenberg/writeBlocks';
import type { IRNode } from '../../core/ir/nodes';

function placeholderImage(label: string, w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#dbe4f5"/><text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(w / 14)}" fill="#4d5fb0" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Builds a minimal but genuinely valid single-page PDF (correct xref
 * offsets computed from the actual object bytes, not hardcoded) so the
 * "embed" pdfRender option has real content to render inline instead of
 * a broken-plugin box pointing at a URL that can never resolve. */
function samplePdfDataUri(): string {
  const contentStream = 'BT /F1 18 Tf 40 150 Td (Sample PDF preview) Tj ET';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 320 200] /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }

  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return `data:application/pdf;base64,${window.btoa(body + xref + trailer)}`;
}

/** A fixed sample article covering every block kind a setting can affect
 * — title, a standalone image (resizing/alignment), two consecutive
 * photos (gallery-combine), a PDF, and a button — so toggling any setting
 * visibly changes this same preview, run through the exact writeBlocks
 * function a real build uses (design spec §5.5), never a hand-mocked
 * approximation. */
const PREVIEW_NODES: IRNode[] = [
  { kind: 'heading', level: 1, html: 'How we rebuilt onboarding' },
  {
    kind: 'paragraph',
    html: 'The team spent six weeks rebuilding the onboarding flow from scratch, focusing on reducing drop-off at step three.',
  },
  { kind: 'image', src: placeholderImage('Resize me', 1024, 683), alt: 'Dashboard screenshot', width: 1024, height: 683 },
  { kind: 'paragraph', html: 'Read the full write-up and methodology in the report below, alongside a few photos from the rollout.' },
  { kind: 'image', src: placeholderImage('Photo 1', 1024, 683), alt: 'Rollout photo 1', width: 1024, height: 683 },
  { kind: 'image', src: placeholderImage('Photo 2', 1024, 683), alt: 'Rollout photo 2', width: 1024, height: 683 },
  { kind: 'file', href: samplePdfDataUri(), fileName: 'full-report.pdf', isPdf: true },
  { kind: 'button', text: 'Read full report', href: 'https://example.com/report' },
];

export const SettingsTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const previewHtml = useMemo(() => writeBlocks(PREVIEW_NODES, state.settings), [state.settings]);

  if (!state.source) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid oklch(90% 0.005 250)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No import yet</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginBottom: '20px' }}>
          Upload a WordPress export first — conversion settings apply to its content.
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'import' })}
          className="btn btn-primary"
        >
          Go to Import tab →
        </button>
      </div>
    );
  }

  const { settings } = state;

  const updateSetting = (key: keyof typeof settings, val: any) => {
    dispatch({ type: 'UPDATE_SETTINGS', settings: { [key]: val } });
  };

  const alignOptions: Array<{ value: 'center' | 'none' | 'left' | 'right'; label: string }> = [
    { value: 'center', label: 'Center' },
    { value: 'none', label: 'None' },
    { value: 'left', label: 'Left' },
    { value: 'right', label: 'Right' },
  ];

  const pdfOptions: Array<{ value: 'embed' | 'link'; label: string }> = [
    { value: 'embed', label: 'Embed iframe' },
    { value: 'link', label: 'Text link' },
  ];

  const buttonOptions: Array<{ value: 'button' | 'link'; label: string }> = [
    { value: 'button', label: 'Button block' },
    { value: 'link', label: 'Text link' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700 }}>Conversion settings</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
          Controls how the old builder&apos;s markup becomes clean Gutenberg blocks. The preview updates as you change these.
        </div>
      </div>

      <div className="settings-grid">
        <div
          style={{
            background: 'white',
            border: '1px solid oklch(90% 0.005 250)',
            borderRadius: '14px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Image size</div>
            <select
              value={settings.imageSize}
              onChange={(e) => updateSetting('imageSize', e.target.value)}
              style={{ width: '100%', padding: '9px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px' }}
            >
              <option value="thumbnail">Thumbnail</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="full">Full size</option>
              <option value="custom">Custom</option>
            </select>
            {settings.imageSize === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)', marginBottom: '4px' }}>Width (px)</div>
                  <input
                    type="number"
                    min="0"
                    placeholder="auto"
                    value={settings.customWidth ?? ''}
                    onChange={(e) => updateSetting('customWidth', e.target.value ? Number(e.target.value) : undefined)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)', marginBottom: '4px' }}>Height (px)</div>
                  <input
                    type="number"
                    min="0"
                    placeholder="auto"
                    value={settings.customHeight ?? ''}
                    onChange={(e) => updateSetting('customHeight', e.target.value ? Number(e.target.value) : undefined)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px' }}
                  />
                </div>
              </div>
            )}
            {settings.imageSize === 'custom' && (
              <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)', marginTop: '6px' }}>
                Set one — the other scales proportionally, just like in WordPress.
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Image alignment</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {alignOptions.map((al) => (
                <button
                  key={al.value}
                  type="button"
                  onClick={() => updateSetting('imageAlign', al.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '7px',
                    border: '1px solid',
                    borderColor: settings.imageAlign === al.value ? 'oklch(50% 0.16 265)' : 'oklch(88% 0.005 250)',
                    background: settings.imageAlign === al.value ? 'oklch(96% 0.04 265)' : 'white',
                    color: settings.imageAlign === al.value ? 'oklch(45% 0.18 265)' : 'oklch(35% 0.01 250)',
                    fontWeight: settings.imageAlign === al.value ? 600 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {al.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Auto-space images next to text</div>
              <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
                Adds margin so wrapped text doesn&apos;t hug the image
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSpacing}
              onChange={(e) => updateSetting('autoSpacing', e.target.checked)}
            />
          </div>

          {settings.autoSpacing && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Spacer height (px): {settings.spacerSize}px</div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.spacerSize}
                onChange={(e) => updateSetting('spacerSize', Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Combine consecutive photos into a gallery</div>
              <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
                Two or more images in a row become a single gallery block instead of separate images
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.combineConsecutiveImages}
              onChange={(e) => updateSetting('combineConsecutiveImages', e.target.checked)}
            />
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Gallery columns: {settings.galleryColumns}</div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={settings.galleryColumns}
              onChange={(e) => updateSetting('galleryColumns', Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Gallery image aspect ratio</div>
            <select
              value={settings.galleryAspectRatio}
              onChange={(e) => updateSetting('galleryAspectRatio', e.target.value)}
              style={{ width: '100%', padding: '9px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px' }}
            >
              <option value="none">Original</option>
              <option value="1">Square — 1:1</option>
              <option value="4/3">Standard — 4:3</option>
              <option value="3/4">Portrait — 3:4</option>
              <option value="3/2">Classic — 3:2</option>
              <option value="2/3">Classic Portrait — 2:3</option>
              <option value="16/9">Wide — 16:9</option>
              <option value="9/16">Tall — 9:16</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Embedded PDFs render as</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {pdfOptions.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateSetting('pdfRender', p.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '7px',
                    border: '1px solid',
                    borderColor: settings.pdfRender === p.value ? 'oklch(50% 0.16 265)' : 'oklch(88% 0.005 250)',
                    background: settings.pdfRender === p.value ? 'oklch(96% 0.04 265)' : 'white',
                    color: settings.pdfRender === p.value ? 'oklch(45% 0.18 265)' : 'oklch(35% 0.01 250)',
                    fontWeight: settings.pdfRender === p.value ? 600 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Buttons render as</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {buttonOptions.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => updateSetting('buttonRender', b.value)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '7px',
                    border: '1px solid',
                    borderColor: settings.buttonRender === b.value ? 'oklch(50% 0.16 265)' : 'oklch(88% 0.005 250)',
                    background: settings.buttonRender === b.value ? 'oklch(96% 0.04 265)' : 'white',
                    color: settings.buttonRender === b.value ? 'oklch(45% 0.18 265)' : 'oklch(35% 0.01 250)',
                    fontWeight: settings.buttonRender === b.value ? 600 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Shift heading levels down</div>
              <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
                Old H1s become H2s, etc., to keep one H1 per page
              </div>
            </div>
            <select
              value={settings.headingShift}
              onChange={(e) => updateSetting('headingShift', Number(e.target.value))}
              style={{ padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px' }}
            >
              <option value="0">None</option>
              <option value="1">Down 1 (H1→H2)</option>
              <option value="2">Down 2 (H1→H3)</option>
              <option value="3">Down 3 (H1→H4)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Links open in new tab</div>
            </div>
            <input
              type="checkbox"
              checked={settings.linksNewTab}
              onChange={(e) => updateSetting('linksNewTab', e.target.checked)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(50% 0.01 250)' }}>Live preview — sample article</div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: 'white',
              border: '1px solid oklch(90% 0.005 250)',
              borderRadius: '12px',
              padding: '24px',
              overflowY: 'auto',
              boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)',
            }}
          >
            <div className="wp-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'articles' })}
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          Continue to Articles →
        </button>
      </div>
    </div>
  );
};
