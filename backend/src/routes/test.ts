import Router, {Request, Response} from "express";
import path from "path";

const router = Router();

router.get("/api/test", async (req: Request, res: Response) => {
    return res.status(200).json('ok');
});

// Debug endpoint to check available hardware acceleration
router.get('/api/debug/ffmpeg', async (req: Request, res: Response) => {
    const { exec } = require('child_process');
    const results: any = {};

    // Check available encoders
    const checkEncoders = () => new Promise((resolve) => {
        exec('ffmpeg -encoders | grep -E "h264|hevc"', (error: any, stdout: string) => {
            results.encoders = stdout || 'No encoders found';
            resolve(null);
        });
    });

    // Check hardware devices
    const checkDevices = () => new Promise((resolve) => {
        exec('ls -la /dev/dri/', (error: any, stdout: string) => {
            results.devices = stdout || 'No devices found';
            resolve(null);
        });
    });

    // Check NVIDIA
    const checkNvidia = () => new Promise((resolve) => {
        exec('nvidia-smi', (error: any, stdout: string) => {
            results.nvidia = error ? 'NVIDIA not available' : stdout;
            resolve(null);
        });
    });

    await Promise.all([checkEncoders(), checkDevices(), checkNvidia()]);

    res.json({
        ffmpegHwAccel: process.env.FFMPEG_HWACCEL || 'not set',
        results
    });
});

router.get('/api/test/transcode/:filename', async (req: Request, res: Response) => {
    const { filename } = req.params;
    const ffmpeg = require('fluent-ffmpeg');

    const inputPath = path.join(process.env.MEDIA_PATH || '/media', filename);

    res.setHeader('Content-Type', 'video/mp2t');

    const command = ffmpeg(inputPath)
        .seekInput(0)
        .duration(10)
        .videoCodec('libx264')  // Start with software encoding for testing
        .audioCodec('aac')
        .outputOptions([
            '-preset', 'veryfast',
            '-pix_fmt', 'yuv420p',
            '-movflags', 'frag_keyframe+empty_moov',
            '-f', 'mpegts'
        ])
        .on('start', (cmd: any) => {
            console.log('Test transcode started:', cmd);
        })
        .on('error', (err: any) => {
            console.error('Test transcode error:', err);
        })
        .pipe(res, { end: true });
});

export default router;