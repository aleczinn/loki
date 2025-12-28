/**
 * Returns a number whose value is limited to the given range.
 * @param value the value that should be clamped
 * @param min min The lower boundary of the output range
 * @param max max The upper boundary of the output range
 * @return A number in the range [min, max]
 */
export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Format file size to correct unit
 * @param bytes
 */
export function formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatBitrate(bps: number): string {
    if (!Number.isFinite(bps) || bps <= 0) {
        return '0 bps';
    }

    const units = ['bps', 'kbps', 'Mbps', 'Gbps'];
    let value = bps;
    let unitIndex = 0;

    while (value >= 1000 && unitIndex < units.length - 1) {
        value /= 1000;
        unitIndex++;
    }

    const decimals = value < 10 ? 1 : 0;
    return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

