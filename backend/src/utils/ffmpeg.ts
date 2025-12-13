import ffmpegStatic from 'ffmpeg-static';

if (!ffmpegStatic) {
    throw new Error('FFmpeg binary not found. Please ensure ffmpeg-static is properly installed.');
}

export const FFMPEG_PATH: string = ffmpegStatic && typeof ffmpegStatic === 'string' ? ffmpegStatic : 'ffmpeg';