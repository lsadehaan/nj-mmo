import { FALLBACK_ICON, getItemIconPath, getSkillIconPath } from './icon-manifest';

const MIN_ICON_PX = 16;

export interface CreateIconImgOptions {
  kind: 'skill' | 'item';
  id: number;
  alt: string;
  sizePx: number;
}

export function isFallbackIconPath(src: string): boolean {
  return src === FALLBACK_ICON;
}

export function createIconImg(options: CreateIconImgOptions): HTMLImageElement {
  const sizePx = Math.max(MIN_ICON_PX, options.sizePx);
  const src =
    options.kind === 'skill'
      ? getSkillIconPath(options.id)
      : getItemIconPath(options.id);

  const img = document.createElement('img');
  img.src = src;
  img.alt = options.alt;
  img.width = sizePx;
  img.height = sizePx;
  img.draggable = false;

  if (options.kind === 'skill') {
    img.dataset['iconSkillId'] = String(options.id);
  } else {
    img.dataset['iconItemId'] = String(options.id);
  }

  if (isFallbackIconPath(src)) {
    img.dataset['iconFallback'] = 'true';
  }

  return img;
}
