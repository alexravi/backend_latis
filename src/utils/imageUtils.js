// Image utility functions for extracting metadata
const sharp = require('sharp');

/**
 * Extract aspect ratio from image buffer
 */
const extractAspectRatio = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    if (metadata.width && metadata.height) {
      return metadata.width / metadata.height;
    }
    return null;
  } catch (error) {
    console.error('Failed to extract aspect ratio', error.message);
    return null;
  }
};

/**
 * Extract dominant color from image
 * Returns hex color code
 * Uses Sharp's statistics to find the most common color
 */
const extractDominantColor = async (buffer) => {
  try {
    // Resize to small size for faster processing
    const resized = await sharp(buffer)
      .resize(150, 150, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = resized;
    const { width, height, channels } = info;
    
    // Count color frequencies (simplified - use average of all pixels)
    let rSum = 0, gSum = 0, bSum = 0;
    const pixelCount = width * height;
    
    for (let i = 0; i < data.length; i += channels) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }
    
    const r = Math.round(rSum / pixelCount);
    const g = Math.round(gSum / pixelCount);
    const b = Math.round(bSum / pixelCount);
    
    // Convert to hex
    const hex = `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
    
    return hex;
  } catch (error) {
    console.error('Failed to extract dominant color', error.message);
    // Return a default color if extraction fails
    return '#cccccc';
  }
};

/**
 * Extract image metadata (width, height, format, etc.)
 */
const extractImageMetadata = async (buffer) => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      hasAlpha: metadata.hasAlpha,
      orientation: metadata.orientation,
      space: metadata.space,
    };
  } catch (error) {
    console.error('Failed to extract image metadata', error.message);
    return null;
  }
};

module.exports = {
  extractAspectRatio,
  extractDominantColor,
  extractImageMetadata,
};
