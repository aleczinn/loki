import { Browser } from "../browser/browser";
import { ParsedUserAgent } from "./parsed-user-agent";

export interface ClientInfo {
    parsed: ParsedUserAgent;
    browser: Browser;
}