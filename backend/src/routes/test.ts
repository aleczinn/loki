import Router, {Request, Response} from "express";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
const fs = require('fs').promises;

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

// Erweitere den Debug-Endpoint in media.ts
router.get('/api/debug/qsv', async (req: Request, res: Response) => {
    const { exec } = require('child_process');
    const results: any = {};

    // Check Intel GPU
    const checkIntelGPU = () => new Promise((resolve) => {
        exec('ls -la /dev/dri/', (error: any, stdout: string) => {
            results.devices = stdout || 'No devices found';
            resolve(null);
        });
    });

    // Check VAAPI info
    const checkVainfo = () => new Promise((resolve) => {
        exec('vainfo', (error: any, stdout: string, stderr: string) => {
            results.vainfo = error ? stderr : stdout;
            resolve(null);
        });
    });

    // Check QSV support in FFmpeg
    const checkQSV = () => new Promise((resolve) => {
        exec('ffmpeg -hwaccels 2>&1 | grep qsv', (error: any, stdout: string) => {
            results.qsvSupport = stdout || 'QSV not found in hwaccels';
            resolve(null);
        });
    });

    // Test QSV encoding
    const testQSVEncoding = () => new Promise((resolve) => {
        exec('ffmpeg -init_hw_device qsv=hw -filter_hw_device hw -f lavfi -i testsrc=duration=1:size=1280x720:rate=30 -vf hwupload=extra_hw_frames=64,format=qsv -c:v h264_qsv -f null - 2>&1',
            (error: any, stdout: string, stderr: string) => {
                results.qsvTest = error ? 'QSV encoding failed: ' + stderr : 'QSV encoding works';
                resolve(null);
            });
    });

    await Promise.all([checkIntelGPU(), checkVainfo(), checkQSV(), testQSVEncoding()]);

    res.json({
        ffmpegHwAccel: process.env.FFMPEG_HWACCEL || 'not set',
        results
    });
});

router.get('/api/debug/qsv-detailed', async (req: Request, res: Response) => {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const results: any = {};

    try {
        // 1. Detaillierte VAAPI-Diagnose
        try {
            const { stdout: vainfoVerbose, stderr: vainfoErr } = await execAsync('vainfo --display drm --device /dev/dri/card0 2>&1');
            results.vainfoDetailed = vainfoVerbose || vainfoErr;
        } catch (error) {
            results.vainfoDetailed = `Detailed VAINFO failed: ${error}`;
        }

        // 2. Verfügbare VA-Treiber prüfen
        try {
            const { stdout: drivers } = await execAsync('find /usr/lib -name "*va*" -o -name "*iHD*" -o -name "*i965*" 2>/dev/null | head -20');
            results.vaDriverFiles = drivers;
        } catch (error) {
            results.vaDriverFiles = 'No VA drivers found';
        }

        // 3. Manuelle Treiber-Tests
        try {
            const { stdout: driverTest } = await execAsync(`
                echo "=== Testing iHD driver ==="
                LIBVA_DRIVER_NAME=iHD LIBVA_DRIVERS_PATH=/usr/lib/x86_64-linux-gnu/dri vainfo --display drm --device /dev/dri/renderD128 2>&1 | head -10
                echo -e "\n=== Testing i965 driver ==="
                LIBVA_DRIVER_NAME=i965 LIBVA_DRIVERS_PATH=/usr/lib/x86_64-linux-gnu/dri vainfo --display drm --device /dev/dri/renderD128 2>&1 | head -10
            `);
            results.manualDriverTests = driverTest;
        } catch (error) {
            results.manualDriverTests = `Driver tests failed: ${error}`;
        }

        // 4. Direkte FFmpeg QSV-Tests mit verschiedenen Parametern
        try {
            const { stdout: qsvDirect } = await execAsync('ffmpeg -hide_banner -hwaccel qsv -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -f null - 2>&1');
            results.qsvDirectTest = 'QSV direct test successful';
        } catch (error) {
            results.qsvDirectTest = `QSV direct test failed: ${error}`;
        }

        // 5. QSV ohne VA-API (über Intel Media SDK)
        try {
            const { stdout: qsvNoVaapi } = await execAsync('MFX_IMPL_SELECTOR=SW ffmpeg -hide_banner -init_hw_device qsv=hw:MFX_IMPL_sw -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -f null - 2>&1');
            results.qsvSoftwareTest = 'QSV software implementation works';
        } catch (error) {
            results.qsvSoftwareTest = `QSV software test failed: ${error}`;
        }

        // 6. Alternative: VAAPI über DRM
        try {
            const { stdout: vaapiDrm } = await execAsync('ffmpeg -hide_banner -hwaccel vaapi -hwaccel_device /dev/dri/renderD128 -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -f null - 2>&1');
            results.vaapiDrmTest = 'VAAPI DRM test successful';
        } catch (error) {
            results.vaapiDrmTest = `VAAPI DRM test failed: ${error}`;
        }

        // 7. DRM Device Info
        try {
            const { stdout: drmInfo } = await execAsync('cat /sys/class/drm/card0/device/uevent 2>/dev/null || echo "No DRM info available"');
            results.drmDeviceInfo = drmInfo;
        } catch (error) {
            results.drmDeviceInfo = 'DRM info not available';
        }

        // 8. Intel GPU Info (falls verfügbar)
        try {
            const { stdout: intelInfo } = await execAsync('lspci | grep -i "vga\|display\|3d" || echo "No GPU info from lspci"');
            results.gpuInfo = intelInfo;
        } catch (error) {
            results.gpuInfo = 'GPU info not available';
        }

        // 9. FFmpeg mit expliziten QSV-Parametern
        try {
            const { stdout: qsvExplicit } = await execAsync(`
                ffmpeg -hide_banner -y \\
                -init_hw_device qsv=qsv:hw \\
                -hwaccel qsv \\
                -hwaccel_output_format qsv \\
                -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 \\
                -vf format=nv12,hwupload=extra_hw_frames=64 \\
                -c:v h264_qsv \\
                -f null - 2>&1
            `);
            results.qsvExplicitTest = 'QSV explicit test successful';
        } catch (error) {
            results.qsvExplicitTest = `QSV explicit test failed: ${error}`;
        }

        // 10. Environment und Library Paths
        results.environment = {
            LIBVA_DRIVER_NAME: process.env.LIBVA_DRIVER_NAME,
            LIBVA_DRIVERS_PATH: process.env.LIBVA_DRIVERS_PATH || '/usr/lib/x86_64-linux-gnu/dri',
            LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
            XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
        };

    } catch (globalError) {
        results.globalError = `Global error: ${globalError}`;
    }

    res.json({
        timestamp: new Date().toISOString(),
        container: 'loki-backend',
        note: 'This is a detailed QSV diagnosis',
        results
    });
});

router.get('/api/debug/nvidia', async (req: Request, res: Response) => {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const results: any = {};

    try {
        // 1. NVIDIA System Info
        try {
            const { stdout: nvidiaSmi } = await execAsync('nvidia-smi --query-gpu=name,driver_version,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits 2>/dev/null');
            results.nvidiaInfo = nvidiaSmi.trim();
        } catch (error) {
            results.nvidiaInfo = `NVIDIA SMI failed: ${error}`;
        }

        // 2. NVIDIA Container Support
        try {
            const { stdout: containerSupport } = await execAsync('nvidia-smi -L 2>/dev/null');
            results.nvidiaContainerSupport = containerSupport.trim();
        } catch (error) {
            results.nvidiaContainerSupport = `NVIDIA container support failed: ${error}`;
        }

        // 3. FFmpeg NVENC Support
        try {
            const { stdout: nvencSupport } = await execAsync('ffmpeg -hide_banner -encoders 2>&1 | grep nvenc');
            results.nvencEncoders = nvencSupport;
        } catch (error) {
            results.nvencEncoders = 'No NVENC encoders found';
        }

        // 4. CUDA Devices
        try {
            const { stdout: cudaDevices } = await execAsync('ls -la /dev/nvidia* 2>/dev/null || echo "No NVIDIA devices found"');
            results.cudaDevices = cudaDevices;
        } catch (error) {
            results.cudaDevices = 'CUDA device check failed';
        }

        // 5. Simple NVENC Test
        try {
            const { stdout: nvencTest } = await execAsync(`
                timeout 10s ffmpeg -hide_banner -y \\
                -f lavfi -i testsrc=duration=0.5:size=640x480:rate=30 \\
                -c:v h264_nvenc \\
                -preset fast \\
                -b:v 1M \\
                -f null - 2>&1
            `);
            results.nvencBasicTest = 'NVENC basic test successful';
        } catch (error) {
            results.nvencBasicTest = `NVENC basic test failed: ${error}`;
        }

        // 6. NVENC with CUDA acceleration
        try {
            const { stdout: nvencCuda } = await execAsync(`
                timeout 10s ffmpeg -hide_banner -y \\
                -hwaccel cuda \\
                -f lavfi -i testsrc=duration=0.5:size=640x480:rate=30 \\
                -c:v h264_nvenc \\
                -preset slow \\
                -rc vbr \\
                -cq 23 \\
                -f null - 2>&1
            `);
            results.nvencCudaTest = 'NVENC + CUDA test successful';
        } catch (error) {
            results.nvencCudaTest = `NVENC + CUDA test failed: ${error}`;
        }

        // 7. Performance Test (longer encoding)
        try {
            const startTime = Date.now();
            await execAsync(`
                timeout 15s ffmpeg -hide_banner -y \\
                -f lavfi -i testsrc=duration=2:size=1920x1080:rate=30 \\
                -c:v h264_nvenc \\
                -preset medium \\
                -b:v 5M \\
                -f null - 2>&1
            `);
            const duration = Date.now() - startTime;
            results.nvencPerformanceTest = `NVENC 1080p test completed in ${duration}ms`;
        } catch (error) {
            results.nvencPerformanceTest = `NVENC performance test failed: ${error}`;
        }

        // 8. Available NVENC presets
        try {
            const { stdout: presets } = await execAsync('ffmpeg -hide_banner -h encoder=h264_nvenc 2>&1 | grep -A 20 "Supported presets"');
            results.nvencPresets = presets;
        } catch (error) {
            results.nvencPresets = 'Could not get NVENC presets';
        }

        // 10. Docker GPU Support Test
        try {
            const { stdout: dockerGpu } = await execAsync('nvidia-smi --query-gpu=count --format=csv,noheader 2>/dev/null');
            results.dockerGpuSupport = `${dockerGpu.trim()} GPU(s) available to container`;
        } catch (error) {
            results.dockerGpuSupport = `Docker GPU support check failed: ${error}`;
        }

    } catch (globalError) {
        results.globalError = `Global error: ${globalError}`;
    }

    res.json({
        timestamp: new Date().toISOString(),
        container: 'loki-backend',
        note: 'NVIDIA NVENC capability test',
        results
    });
});

router.get('/api/debug/nvidia-detailed', async (req: Request, res: Response) => {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const results: any = {};

    try {
        // 1. Detaillierte CUDA-Bibliotheken prüfen
        try {
            const { stdout: cudaLibs } = await execAsync('find /usr -name "*cuda*" -o -name "*nvenc*" -o -name "*nvidia*" 2>/dev/null | grep -v "/proc" | head -20');
            results.cudaLibraries = cudaLibs;
        } catch (error) {
            results.cudaLibraries = 'No CUDA libraries found';
        }

        // 2. FFmpeg CUDA-Unterstützung prüfen
        try {
            const { stdout: ffmpegCuda } = await execAsync('ffmpeg -hide_banner -hwaccels 2>&1');
            results.ffmpegHwaccels = ffmpegCuda;
        } catch (error) {
            results.ffmpegHwaccels = `FFmpeg hwaccels failed: ${error}`;
        }

        // 3. Detaillierte NVENC-Encoder-Info
        try {
            const { stdout: nvencDetails } = await execAsync('ffmpeg -hide_banner -h encoder=h264_nvenc 2>&1 | head -30');
            results.nvencEncoderDetails = nvencDetails;
        } catch (error) {
            results.nvencEncoderDetails = `NVENC encoder details failed: ${error}`;
        }

        // 4. Einfachster NVENC-Test ohne Parameter
        try {
            const { stdout: simpleNvenc, stderr: nvencErr } = await execAsync('ffmpeg -hide_banner -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -c:v h264_nvenc -f null - 2>&1');
            results.simpleNvencTest = 'Simple NVENC test successful';
        } catch (error) {
            results.simpleNvencTest = `Simple NVENC test failed: ${error}`;
        }

        // 5. NVENC ohne CUDA (Software-Pfad)
        try {
            const { stdout: nvencNoCuda } = await execAsync('ffmpeg -hide_banner -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -c:v h264_nvenc -preset ultrafast -f null - 2>&1');
            results.nvencWithoutCuda = 'NVENC without CUDA successful';
        } catch (error) {
            results.nvencWithoutCuda = `NVENC without CUDA failed: ${error}`;
        }

        // 6. GPU Memory und Status
        try {
            const { stdout: gpuStatus } = await execAsync('nvidia-smi --query-gpu=memory.used,memory.free,temperature.gpu,utilization.gpu,utilization.memory --format=csv,noheader 2>/dev/null');
            results.gpuStatus = gpuStatus.trim();
        } catch (error) {
            results.gpuStatus = `GPU status failed: ${error}`;
        }

        // 7. CUDA Runtime Test
        try {
            const { stdout: cudaTest } = await execAsync('nvidia-smi --query-gpu=cuda_version --format=csv,noheader 2>/dev/null');
            results.cudaVersion = cudaTest.trim();
        } catch (error) {
            results.cudaVersion = `CUDA version check failed: ${error}`;
        }

        // 8. Verfügbare GPU-Devices
        try {
            const { stdout: gpuDevices } = await execAsync('ls -la /dev/nvidia* 2>/dev/null && echo "---" && ls -la /proc/driver/nvidia/gpus/ 2>/dev/null');
            results.gpuDeviceDetails = gpuDevices;
        } catch (error) {
            results.gpuDeviceDetails = `GPU device details failed: ${error}`;
        }

        // 9. FFmpeg mit expliziten GPU-Parameter
        try {
            const { stdout: explicitGpu } = await execAsync('ffmpeg -hide_banner -vsync 0 -hwaccel cuda -hwaccel_output_format cuda -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -c:v h264_nvenc -f null - 2>&1');
            results.explicitGpuTest = 'Explicit GPU test successful';
        } catch (error) {
            results.explicitGpuTest = `Explicit GPU test failed: ${error}`;
        }

        // 10. Container-spezifische NVIDIA-Tests
        try {
            const { stdout: containerNvidia } = await execAsync('nvidia-ml-py3 --version 2>/dev/null || echo "nvidia-ml-py3 not available"');
            results.nvidiaMLSupport = containerNvidia.trim();
        } catch (error) {
            results.nvidiaMLSupport = 'NVIDIA ML not available';
        }

        // 11. Debugging: FFmpeg mit Verbose-Output
        try {
            const { stdout: verboseNvenc, stderr: verboseErr } = await execAsync('ffmpeg -v verbose -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -c:v h264_nvenc -f null - 2>&1 | head -50');
            results.verboseNvencOutput = verboseNvenc || verboseErr;
        } catch (error) {
            results.verboseNvencOutput = `Verbose NVENC failed: ${error}`;
        }

        // 12. Alternative: Software-Encoder als Baseline
        try {
            const { stdout: softwareTest } = await execAsync('ffmpeg -hide_banner -f lavfi -i testsrc=duration=0.1:size=320x240:rate=1 -c:v libx264 -preset ultrafast -f null - 2>&1');
            results.softwareEncoderTest = 'Software encoder works';
        } catch (error) {
            results.softwareEncoderTest = `Software encoder failed: ${error}`;
        }

    } catch (globalError) {
        results.globalError = `Global error: ${globalError}`;
    }

    res.json({
        timestamp: new Date().toISOString(),
        container: 'loki-backend',
        note: 'Detailed NVIDIA NVENC diagnosis',
        summary: {
            gpuDetected: !!results.nvidiaInfo,
            containerSupport: !!results.dockerGpuSupport,
            nvencAvailable: !!results.nvencEncoders,
            mainIssue: 'NVENC encoding fails despite GPU detection'
        },
        results
    });
});

// GPU-Capabilities testen
router.get('/api/debug/gpu-info', async (req, res) => {
    try {
        // NVIDIA GPU Info
        const { exec } = require('child_process');

        const nvidiaInfo = await new Promise((resolve, reject) => {
            exec('nvidia-smi --query-gpu=name,memory.total,memory.free,memory.used --format=csv,noheader,nounits',
                (error: any, stdout: string, stderr: any) => {
                    if (error) resolve('NVIDIA GPU nicht verfügbar');
                    else resolve(stdout.trim());
                });
        });

        // FFmpeg GPU-Support prüfen
        const ffmpegSupport = await new Promise((resolve, reject) => {
            exec('ffmpeg -hide_banner -encoders | grep nvenc', (error: any, stdout: string, stderr: any) => {
                if (error) resolve('Keine NVENC-Encoder gefunden');
                else resolve(stdout.trim());
            });
        });

        // Hardware-Beschleunigung prüfen
        const hwAccels = await new Promise((resolve, reject) => {
            exec('ffmpeg -hide_banner -hwaccels', (error: any, stdout: string, stderr: any) => {
                if (error) resolve('Keine HW-Beschleunigung verfügbar');
                else resolve(stdout.trim());
            });
        });

        res.json({
            nvidia_gpu: nvidiaInfo,
            nvenc_encoders: ffmpegSupport,
            hardware_accelerations: hwAccels,
            test_url: '/api/nvenc-test/upload',
            quick_test_url: '/api/nvenc-test/quick-test'
        });
    } catch (error) {
        // @ts-ignore
        res.status(500).json({ error: error.message });
    }
});

export default router;