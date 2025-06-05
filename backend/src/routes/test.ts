import Router, {Request, Response} from "express";

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

export default router;