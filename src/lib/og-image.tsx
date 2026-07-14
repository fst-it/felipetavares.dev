import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { siteConfig } from '../config/site';

// Build-time only: satori's bundled OpenType parser can't read the `fvar` variation table in
// the site's self-hosted @fontsource-variable (client-facing) fonts, so OG generation uses the
// static-weight @fontsource/{inter,sora} packages instead — plain .woff, which satori supports
// directly (only WOFF2, which needs brotli decompression, is unsupported). Dev dependency only;
// never shipped to the client, which still gets the variable fonts as before.
//
// Resolved from process.cwd() (the project root, wherever `astro build`/`astro dev` is invoked
// from) rather than import.meta.url: this module gets bundled into dist/_worker.js/... during
// the build, at which point a path relative to the *source* file's location no longer points at
// node_modules.
function resolveFontPath(pkg: string, file: string): string {
  return path.join(process.cwd(), 'node_modules', pkg, 'files', file);
}

let cachedFonts: { name: string; data: Buffer; weight: 400 | 700; style: 'normal' }[] | null = null;

function loadFonts() {
  if (cachedFonts) return cachedFonts;

  const soraBold = readFileSync(resolveFontPath('@fontsource/sora', 'sora-latin-700-normal.woff'));
  const interRegular = readFileSync(resolveFontPath('@fontsource/inter', 'inter-latin-400-normal.woff'));

  cachedFonts = [
    { name: 'Sora', data: soraBold, weight: 700, style: 'normal' },
    { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
  ];
  return cachedFonts;
}

// Brand glyph PNG (64×64, transparent, generated from docs/brand/ by Commit 2 pipeline).
// Loaded once at build time and embedded as a data URI so satori can render it without
// network access (satori does not support external URLs in <img> src).
let cachedGlyphDataUri: string | null = null;

function loadGlyphDataUri(): string {
  if (cachedGlyphDataUri) return cachedGlyphDataUri;
  const glyphPath = path.join(process.cwd(), 'src', 'assets', 'brand', 'brand-glyph-64.png');
  const b64 = readFileSync(glyphPath).toString('base64');
  cachedGlyphDataUri = `data:image/png;base64,${b64}`;
  return cachedGlyphDataUri;
}

export interface OgImageInput {
  eyebrow: string;
  title: string;
}

/**
 * Renders a per-page OG image (spec section 10: "name, page title, accent brand frame") at
 * build time via satori (JSX -> SVG) + resvg (SVG -> PNG). Never invoked at request time.
 */
export async function renderOgImage({ eyebrow, title }: OgImageInput): Promise<Buffer> {
  const fonts = loadFonts();
  const glyphDataUri = loadGlyphDataUri();

  const svg = await satori(
    <div
      style={{
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: '#0b0e14',
        backgroundImage:
          'radial-gradient(circle at 15% 15%, rgba(79,140,255,0.35), transparent 55%), radial-gradient(circle at 90% 90%, rgba(125,178,255,0.28), transparent 55%)',
        fontFamily: 'Inter',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid rgba(255,255,255,0.14)',
          borderRadius: '28px',
          padding: '64px',
          width: '100%',
          height: '100%',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: '28px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#4f8cff',
            fontFamily: 'Inter',
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '64px',
            fontFamily: 'Sora',
            fontWeight: 700,
            color: '#e6eaf2',
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '30px',
            color: '#8a93a6',
            fontFamily: 'Inter',
          }}
        >
          {/* Brand glyph — raster PNG (dual-gradient brain + arch), embedded as data URI.
              Commit 2: replaces the generative SVG constellation. Satori renders <img> with
              data: URI sources directly; no network access required. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={glyphDataUri} width="64" height="64" alt="" />
          <span>{siteConfig.name} · {siteConfig.domain}</span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts,
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  return resvg.render().asPng();
}
