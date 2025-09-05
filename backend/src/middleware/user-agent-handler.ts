import { Request, Response, NextFunction } from 'express';
import { Browser } from "../browser/browser";
import { Chrome } from "../browser/chrome";
import { Firefox } from "../browser/firefox";
import { Edge } from "../browser/edge";
import { Safari } from "../browser/safari";
import { DefaultBrowser } from "../browser/default-browser";
import { ParsedUserAgent } from "../types/parsed-user-agent";
import { ClientInfo } from "../types/client-info";

declare global {
    namespace Express {
        interface Request {
            clientInfo?: ClientInfo;
        }
    }
}

export function userAgentMiddleware(req: Request, res: Response, next: NextFunction) {
    const userAgent = req.headers['user-agent'] || '';
    const parsed = parseUserAgent(userAgent);
    const browser = createBrowser(parsed);

    req.clientInfo = {
        parsed: parsed,
        browser: browser
    };

    next();
}

export function parseUserAgent(userAgent: string): ParsedUserAgent {
    const ua = userAgent;

    // Initialize result
    const result: ParsedUserAgent = {
        raw: userAgent,
        browser: { name: 'Unknown', version: '0', major: 0 },
        os: { name: 'Unknown', version: '0', platform: 'unknown' },
        device: { type: 'unknown' },
        engine: { name: 'Unknown', version: '0' }
    };

    // OS Detection
    if (ua.includes('Windows NT')) {
        result.os.name = 'Windows';
        result.os.platform = 'windows';
        const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
        if (winMatch) {
            const winVersionMap: Record<string, string> = {
                '10.0': '10/11', // Could be Windows 10 or 11
                '6.3': '8.1',
                '6.2': '8',
                '6.1': '7',
                '6.0': 'Vista'
            };
            result.os.version = winVersionMap[winMatch[1]] || winMatch[1];
        }
    } else if (ua.includes('Mac OS X')) {
        result.os.name = 'macOS';
        result.os.platform = 'macos';
        const macMatch = ua.match(/Mac OS X (\d+[._]\d+)/);
        if (macMatch) {
            result.os.version = macMatch[1].replace('_', '.');
        }
    } else if (ua.includes('Android')) {
        result.os.name = 'Android';
        result.os.platform = 'android';
        const androidMatch = ua.match(/Android (\d+\.?\d*)/);
        if (androidMatch) {
            result.os.version = androidMatch[1];
        }
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
        result.os.name = 'iOS';
        result.os.platform = 'ios';
        const iosMatch = ua.match(/OS (\d+[._]\d+)/);
        if (iosMatch) {
            result.os.version = iosMatch[1].replace('_', '.');
        }
    } else if (ua.includes('Linux')) {
        result.os.name = 'Linux';
        result.os.platform = 'linux';
    }

    // Browser Detection - Order matters!
    if (ua.includes('Edg/')) {
        // Edge (Chromium)
        result.browser.name = 'Edge';
        const edgeMatch = ua.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/);
        if (edgeMatch) {
            result.browser.version = edgeMatch[1];
            result.browser.major = parseInt(edgeMatch[1].split('.')[0]);
        }
        result.engine.name = 'Blink';
    } else if (ua.includes('Firefox/')) {
        // Firefox
        result.browser.name = 'Firefox';
        const firefoxMatch = ua.match(/Firefox\/(\d+\.\d+)/);
        if (firefoxMatch) {
            result.browser.version = firefoxMatch[1];
            result.browser.major = parseInt(firefoxMatch[1].split('.')[0]);
        }
        result.engine.name = 'Gecko';
        const geckoMatch = ua.match(/Gecko\/(\d+)/);
        if (geckoMatch) {
            result.engine.version = geckoMatch[1];
        }
    } else if (ua.includes('Chrome/') && ua.includes('Safari/')) {
        // Chrome (must check after Edge)
        result.browser.name = 'Chrome';
        const chromeMatch = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
        if (chromeMatch) {
            result.browser.version = chromeMatch[1];
            result.browser.major = parseInt(chromeMatch[1].split('.')[0]);
        }
        result.engine.name = 'Blink';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        // Safari (real Safari, not Chrome)
        result.browser.name = 'Safari';
        const safariMatch = ua.match(/Version\/(\d+\.\d+)/);
        if (safariMatch) {
            result.browser.version = safariMatch[1];
            result.browser.major = parseInt(safariMatch[1].split('.')[0]);
        }
        result.engine.name = 'WebKit';
    }

    // Engine version for WebKit/Blink
    if (result.engine.name === 'Blink' || result.engine.name === 'WebKit') {
        const webkitMatch = ua.match(/AppleWebKit\/(\d+\.\d+)/);
        if (webkitMatch) {
            result.engine.version = webkitMatch[1];
        }
    }

    // Device type detection
    if (ua.includes('Mobile') || ua.includes('Android')) {
        result.device.type = 'mobile';
    } else if (ua.includes('Tablet') || ua.includes('iPad')) {
        result.device.type = 'tablet';
    } else if (ua.includes('TV') || ua.includes('AndroidTV') || ua.includes('SmartTV')) {
        result.device.type = 'tv';
    } else if (result.os.platform === 'windows' || result.os.platform === 'macos' || result.os.platform === 'linux') {
        result.device.type = 'desktop';
    }

    // Special device detection
    if (ua.includes('Shield Android TV')) {
        result.device.model = 'NVIDIA Shield';
        result.device.type = 'tv';
    } else if (ua.includes('AFTT')) {
        result.device.model = 'Fire TV';
        result.device.type = 'tv';
    }

    return result;
}

function createBrowser(parsed: ParsedUserAgent): Browser {
    // // Custom app
    // if (userAgent.includes('LokiApp/')) {
    //     return new LokiApp(1, parsed.os.name);
    // }
    //
    // // TV devices
    // if (parsed.device.type === 'tv') {
    //     return new AndroidTV(parsed.os.version, parsed.device.model);
    // }

    // Desktop browsers
    switch (parsed.browser.name) {
        case 'Chrome':
            return new Chrome('chrome', parsed.browser.major, parsed.os.name);
        case 'Firefox':
            return new Firefox('firefox', parsed.browser.major, parsed.os.name);
        case 'Safari':
            return new Safari('safari', parsed.browser.major, parsed.os.name);
        case 'Edge':
            return new Edge('edge', parsed.browser.major, parsed.os.name);
        default:
            return new DefaultBrowser('default', 0, parsed.os.name); // Fallback
    }
}