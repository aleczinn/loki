export interface ParsedUserAgent {
    raw: string;
    browser: {
        name: string;
        version: string;
        major: number;
    };
    os: {
        name: string;
        version: string;
        platform: string;
    };
    device: {
        type: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'unknown';
        model?: string;
    };
    engine: {
        name: string;
        version: string;
    };
}