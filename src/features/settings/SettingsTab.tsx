import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';

export const SettingsTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [previewTab, setPreviewTab] = useState<'before' | 'after'>('after');

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

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
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
            </select>
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
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
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

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Gallery columns: {settings.galleryCols}</div>
            <input
              type="range"
              min="1"
              max="6"
              value={settings.galleryCols}
              onChange={(e) => updateSetting('galleryCols', Number(e.target.value))}
              style={{ width: '100%' }}
            />
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
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'oklch(50% 0.01 250)' }}>Live preview — sample article</div>
            <div style={{ display: 'flex', gap: '4px', background: 'oklch(95% 0.005 250)', borderRadius: '8px', padding: '3px' }}>
              <button
                type="button"
                onClick={() => setPreviewTab('before')}
                style={{
                  border: 'none',
                  background: previewTab === 'before' ? 'white' : 'transparent',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: previewTab === 'before' ? '0 1px 2px oklch(0% 0 0 / 0.05)' : 'none',
                }}
              >
                Before
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('after')}
                style={{
                  border: 'none',
                  background: previewTab === 'after' ? 'white' : 'transparent',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: previewTab === 'after' ? '0 1px 2px oklch(0% 0 0 / 0.05)' : 'none',
                }}
              >
                After
              </button>
            </div>
          </div>

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
            {previewTab === 'before' ? (
              <div style={{ fontSize: '14px', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '100px',
                      height: '70px',
                      flexShrink: 0,
                      borderRadius: '6px',
                      background: 'repeating-linear-gradient(45deg, oklch(92% 0.005 250), oklch(92% 0.005 250) 8px, oklch(96% 0.003 250) 8px, oklch(96% 0.003 250) 16px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      color: 'oklch(55% 0.01 250)',
                    }}
                  >
                    [hero.jpg]
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px' }}>Legacy Heading (H1)</h3>
                    <p style={{ margin: '0 0 8px', color: 'oklch(35% 0.01 250)' }}>
                      The team spent six weeks rebuilding the onboarding flow from scratch, focusing on reducing drop-off at step three...
                    </p>
                    <div
                      style={{
                        background: 'oklch(95% 0.005 250)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: 'oklch(45% 0.01 250)',
                        display: 'inline-block',
                      }}
                    >
                      [button link=&quot;https://example.com/report&quot; text=&quot;Read full report&quot;]
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '14px', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ textAlign: settings.imageAlign === 'none' ? 'left' : (settings.imageAlign as any), marginBottom: settings.autoSpacing ? `${settings.spacerSize}px` : '0' }}>
                  <div
                    style={{
                      width: settings.imageSize === 'thumbnail' ? '150px' : settings.imageSize === 'medium' ? '300px' : settings.imageSize === 'large' ? '500px' : '100%',
                      height: settings.imageSize === 'thumbnail' ? '100px' : '220px',
                      background: 'oklch(94% 0.02 265)',
                      border: '2px solid oklch(85% 0.05 265)',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'oklch(50% 0.16 265)',
                      fontWeight: 600,
                      fontSize: '13px',
                      maxWidth: '100%',
                    }}
                  >
                    Gutenberg Image Block ({settings.imageSize}, align: {settings.imageAlign})
                  </div>
                </div>

                <div style={{ fontSize: settings.headingShift > 0 ? '16px' : '20px', fontWeight: 700 }}>
                  Converted Heading (H{1 + settings.headingShift})
                </div>

                <p style={{ margin: '0 0 8px', color: 'oklch(25% 0.01 250)' }}>
                  The team spent six weeks rebuilding the onboarding flow from scratch, focusing on reducing drop-off at step three...
                </p>

                <div>
                  {settings.buttonRender === 'button' ? (
                    <a
                      href="https://example.com/report"
                      target={settings.linksNewTab ? '_blank' : '_self'}
                      rel={settings.linksNewTab ? 'noreferrer' : undefined}
                      style={{
                        display: 'inline-block',
                        background: 'oklch(50% 0.16 265)',
                        color: 'white',
                        padding: '10px 18px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '13px',
                        textDecoration: 'none',
                      }}
                    >
                      Read full report {settings.linksNewTab && '↗'}
                    </a>
                  ) : (
                    <a
                      href="https://example.com/report"
                      target={settings.linksNewTab ? '_blank' : '_self'}
                      rel={settings.linksNewTab ? 'noreferrer' : undefined}
                      style={{ color: 'oklch(50% 0.16 265)', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Read full report {settings.linksNewTab && '↗'}
                    </a>
                  )}
                </div>
              </div>
            )}
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
