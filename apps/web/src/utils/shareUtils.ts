import domToImage from 'dom-to-image-more';

/**
 * Capture a DOM element as an image (Blob)
 */
export async function captureElementAsBlob(element: HTMLElement, format: 'jpeg' | 'png' = 'jpeg'): Promise<Blob | null> {
  // Flash effect (Motion Master)
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.inset = '0';
  flash.style.backgroundColor = 'white';
  flash.style.opacity = '0';
  flash.style.zIndex = '9999';
  flash.style.transition = 'opacity 0.1s ease-out';
  flash.style.pointerEvents = 'none';
  document.body.appendChild(flash);

  // Trigger flash
  requestAnimationFrame(() => {
    flash.style.opacity = '0.8';
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => document.body.removeChild(flash), 100);
    }, 100);
  });

  try {
    const dataUrl = format === 'png' 
      ? await domToImage.toPng(element, { quality: 1 })
      : await domToImage.toJpeg(element, { quality: 0.95 });
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch (err) {
    console.error('Failed to capture image', err);
    return null;
  }
}

export async function downloadImageBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function copyImageBlobToClipboard(blob: Blob) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([10, 30, 10]);
      }
      return true;
    }
  } catch (err) {
    console.error('Clipboard image copy failed', err);
  }
  return false;
}

/**
 * Share via Native Share Sheet or fallback to Clipboard (State Manager)
 */
export async function shareImageNative(blob: Blob, fileName: string = 'vinyla-share.jpg') {
  const file = new File([blob], fileName, { type: blob.type });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'VinylA Collection',
        text: 'Check out my vinyl collection!',
        files: [file],
      });
      return true;
    } catch (error) {
      console.log('Share canceled or failed', error);
      return false;
    }
  } else {
    // Fallback: Copy to clipboard if possible
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        alert('이미지가 클립보드에 복사되었습니다.');
        return true;
      }
    } catch (err) {
      console.error('Clipboard fallback failed', err);
    }
    
    // Final fallback: Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([10, 30, 10]); // Success pattern
    }
    return true;
  } catch (err) {
    console.error('Failed to copy', err);
    return false;
  }
}
