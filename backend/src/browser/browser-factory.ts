import { Browser } from './browser';
import { Chrome } from './chrome';
import { Firefox } from './firefox';
import { Safari } from './safari';
import { Edge } from './edge';
import { Opera } from './opera';
import { DefaultBrowser } from './default-browser';

export class BrowserFactory {
    static create(userAgent: string): Browser {
        const ua = userAgent.toLowerCase();

        // Extract browser and version
        let browser: Browser;

        if (ua.includes('edg/')) {
            const version = this.extractVersion(ua, 'edg/');
            const platform = this.extractPlatform(ua);
            browser = new Edge('Edge', version, platform);
        } else if (ua.includes('chrome/') && !ua.includes('edg/')) {
            const version = this.extractVersion(ua, 'chrome/');
            const platform = this.extractPlatform(ua);
            browser = new Chrome('Chrome', version, platform);
        } else if (ua.includes('firefox/')) {
            const version = this.extractVersion(ua, 'firefox/');
            const platform = this.extractPlatform(ua);
            browser = new Firefox('Firefox', version, platform);
        } else if (ua.includes('safari/') && !ua.includes('chrome')) {
            const version = this.extractVersion(ua, 'version/');
            const platform = this.extractPlatform(ua);
            browser = new Safari('Safari', version, platform);
        } else if (ua.includes('opr/') || ua.includes('opera/')) {
            const version = this.extractVersion(ua, ua.includes('opr/') ? 'opr/' : 'opera/');
            const platform = this.extractPlatform(ua);
            browser = new Opera('Opera', version, platform);
        } else {
            browser = new DefaultBrowser('Unknown', 0, 'Unknown');
        }

        return browser;
    }

    private static extractVersion(ua: string, pattern: string): number {
        const match = ua.match(new RegExp(pattern + '(\\d+)'));
        return match ? parseInt(match[1]) : 0;
    }

    private static extractPlatform(ua: string): string {
        if (ua.includes('windows')) return 'Windows';
        if (ua.includes('mac')) return 'macOS';
        if (ua.includes('linux')) return 'Linux';
        if (ua.includes('android')) return 'Android';
        if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
        return 'Unknown';
    }
}