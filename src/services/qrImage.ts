/**
 * 增强二维码图片生成
 *
 * @author Telegram @Mhuai8
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import QRCode from 'qrcode';
import sharp from 'sharp';
import type { LoggerLike } from '../types';

export interface EnhancedQrOptions {
  topText?: string;
  bottomText?: string;
  logoUrl?: string;
  logoPath?: string;
  width?: number;
}

function createTextSvg(text: string, width: number, height: number, fontSize: number): Buffer {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="500" fill="#1a1a1a" font-family="system-ui, -apple-system, sans-serif">${escaped}</text>
</svg>`;
  return Buffer.from(svg);
}

async function loadLogoBuffer(logoUrl?: string, logoPath?: string): Promise<Buffer | null> {
  if (logoUrl) {
    try {
      const res = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 10_000 });
      return Buffer.from(res.data);
    } catch {
      return null;
    }
  }
  if (logoPath) {
    const resolved = path.isAbsolute(logoPath) ? logoPath : path.resolve(process.cwd(), logoPath);
    if (fs.existsSync(resolved)) {
      return fs.readFileSync(resolved);
    }
  }
  return null;
}

export async function buildEnhancedQrImage(
  qrCodeData: string,
  options: EnhancedQrOptions = {},
  logger?: LoggerLike,
): Promise<Buffer> {
  const width = options.width || 600;
  const hasTop = Boolean(options.topText?.trim());
  const hasBottom = Boolean(options.bottomText?.trim());

  const qrPngBuffer = await QRCode.toBuffer(qrCodeData, {
    width,
    margin: 2,
    type: 'png',
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const topHeight = hasTop ? Math.max(36, Math.round(width * 0.06)) : 0;
  const bottomHeight = hasBottom ? Math.max(36, Math.round(width * 0.06)) : 0;
  const fontSize = Math.max(14, Math.round(width * 0.035));

  try {
    let image = sharp(qrPngBuffer);
    if (hasTop || hasBottom) {
      image = image.extend({
        top: topHeight,
        bottom: bottomHeight,
        left: 0,
        right: 0,
        background: { r: 255, g: 255, b: 255 },
      });
    }

    const composites: Array<{ input: Buffer; top?: number; left?: number }> = [];
    if (hasTop) {
      composites.push({
        input: createTextSvg(options.topText!.trim(), width, topHeight, fontSize),
        top: 0,
        left: 0,
      });
    }
    if (hasBottom) {
      composites.push({
        input: createTextSvg(options.bottomText!.trim(), width, bottomHeight, fontSize),
        top: topHeight + width,
        left: 0,
      });
    }

    const defaultLogoPath = path.resolve(process.cwd(), 'assets/logo.png');
    const logoBuffer = await loadLogoBuffer(
      options.logoUrl,
      options.logoPath || (fs.existsSync(defaultLogoPath) ? defaultLogoPath : undefined),
    );
    if (logoBuffer) {
      const logoSize = Math.max(48, Math.round(width * 0.16));
      const logoBgSize = Math.max(60, Math.round(width * 0.2));
      const logoResized = await sharp(logoBuffer).resize(logoSize, logoSize, { fit: 'cover' }).png().toBuffer();
      const centerLeft = Math.round((width - logoBgSize) / 2);
      const centerTop = topHeight + Math.round((width - logoBgSize) / 2);
      const whiteCircle = `<svg xmlns="http://www.w3.org/2000/svg" width="${logoBgSize}" height="${logoBgSize}" viewBox="0 0 ${logoBgSize} ${logoBgSize}">
<circle cx="${logoBgSize / 2}" cy="${logoBgSize / 2}" r="${logoBgSize / 2}" fill="#ffffff"/>
</svg>`;
      composites.push({ input: Buffer.from(whiteCircle), top: centerTop, left: centerLeft });
      composites.push({
        input: logoResized,
        top: topHeight + Math.round((width - logoSize) / 2),
        left: Math.round((width - logoSize) / 2),
      });
    }

    return await image.composite(composites).png().toBuffer();
  } catch (error) {
    logger?.warn?.('[ObeliskUSDT] 二维码增强失败，退回基础二维码', error);
    return qrPngBuffer;
  }
}
