import * as path from 'path';
import * as fs from 'fs-extra';
import * as crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import { TRANSCODE_PATH } from "../app";
import { StreamSession } from "../types/types";
import { getCombinedMetadata } from "../utils/media-utils";

const sessions = new Map();
const SEGMENT_DURATION = 10; // Sekunden pro Segment
const BUFFER_SEGMENTS = 3; // 30 Sekunden Puffer (3 * 10s)
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 Minuten